// Package feed orchestrates the social feed: create posts, like/unlike, and
// comment, persisting each then broadcasting post.* envelopes to an audience.
package feed

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/mentions"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// ErrPostNotFound is returned when an action targets a missing post.
var ErrPostNotFound = errors.New("post not found")

// ErrInvalidKind is returned when a post kind is not allowed for the author's role.
var ErrInvalidKind = errors.New("invalid post kind for role")

// ErrDuplicatePost is returned when an author submits the same normalized
// content more than once.
var ErrDuplicatePost = errors.New("duplicate post")
var ErrMutationUnsupported = errors.New("feed mutation unsupported")

// Service handles feed posts.
type Service struct {
	posts  store.PostStore
	router store.Router
	users  store.UserStore
	now    func() time.Time
	cache  Cache
}

type scoredPost struct {
	post   store.Post
	score  float64
	reason string
}

func New(p store.PostStore, r store.Router) *Service {
	return &Service{posts: p, router: r, now: time.Now}
}
func (s *Service) SetCache(cache Cache)           { s.cache = cache }
func (s *Service) SetUsers(users store.UserStore) { s.users = users }
func (s *Service) invalidate(ctx context.Context) {
	if s.cache != nil {
		s.cache.Invalidate(ctx)
	}
}

// CreatePost persists a post (stamping author_role + sanitized target audience),
// then broadcasts post.new to recipients (the online users) excluding the author.
func (s *Service) CreatePost(ctx context.Context, authorID, authorRole string, p protocol.CreatePostPayload, recipients []string) (store.Post, error) {
	role := store.NormalizeRole(authorRole)
	kind := p.Kind
	if kind == "" {
		kind = "update"
	} else if !store.AllowedKind(role, kind) {
		return store.Post{}, ErrInvalidKind
	}
	post := store.Post{
		ID:         protocol.NewMsgID(),
		AuthorID:   authorID,
		AuthorRole: role,
		Audience:   store.SanitizeAudience(p.Audience),
		Kind:       kind,
		Body:       p.Body,
		Mentions:   mentions.Resolve(ctx, s.users, p.Body),
		CreatedAt:  s.now().UTC(),
	}
	if p.ExpiresAt != "" {
		if parsed, err := time.Parse(time.RFC3339, p.ExpiresAt); err == nil {
			post.ExpiresAt = &parsed
		}
	}
	post.ContentFingerprint = contentFingerprint(post.AuthorID, post.Kind, post.Body)
	if err := s.posts.CreatePost(ctx, post); err != nil {
		// PostgreSQL enforces the author/content fingerprint uniqueness contract.
		// Keep the API stable across PostgreSQL and fake stores by exposing a
		// domain-level conflict rather than leaking a driver error.
		if strings.Contains(strings.ToLower(err.Error()), "uq_posts_content_fingerprint") {
			return store.Post{}, ErrDuplicatePost
		}
		return store.Post{}, err
	}
	s.invalidate(ctx)
	s.broadcast(ctx, authorID, recipients, protocol.TypePostNew, map[string]any{
		"id": post.ID, "authorId": authorID, "authorRole": post.AuthorRole,
		"audience": post.Audience, "kind": post.Kind, "body": post.Body, "mentions": post.Mentions,
		"ts": post.CreatedAt.Format(time.RFC3339), "expiresAt": post.ExpiresAt,
	})
	s.broadcast(ctx, authorID, mentions.UserIDs(post.Mentions, authorID), protocol.TypeMentionNew, map[string]any{
		"entityType": "post", "entityId": post.ID, "actorId": authorID, "mentions": post.Mentions,
	})
	return post, nil
}

func contentFingerprint(authorID, kind, body string) string {
	normalized := strings.ToLower(strings.Join(strings.Fields(body), " "))
	return fmt.Sprintf("%x", sha256.Sum256([]byte(authorID+"|"+kind+"|"+normalized)))
}

// ListByZone returns posts for a viewer role and zone (delegates to the store).
func (s *Service) ListByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.posts.ListPostsByZone(ctx, store.NormalizeRole(viewerRole), zone, before, limit)
}

// ListByCategory preserves the existing zone store contract while exposing
// the additive discovery taxonomy to the HTTP API.
func (s *Service) ListByCategory(ctx context.Context, viewerID, viewerRole, zone, category, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	cacheKey := fmt.Sprintf("%s|%s|%s|%s|%s|%d", viewerID, viewerRole, zone, category, before, limit)
	if s.cache != nil {
		if posts, ok := s.cache.Get(ctx, cacheKey); ok {
			return posts, nil
		}
	}
	posts, err := s.ListByZone(ctx, viewerRole, zone, before, limit*4)
	if err != nil {
		return nil, err
	}
	eventCount, _ := s.posts.FeedEventCount(ctx, viewerID)
	followed, _ := s.posts.FollowedUserIDs(ctx, viewerID)
	coldStart := eventCount < 5 && len(followed) == 0
	viewerProfile, _ := s.posts.GetDiscoveryProfile(ctx, viewerID)
	if category == "following" {
		allowed := map[string]struct{}{viewerID: {}}
		for _, id := range followed {
			allowed[id] = struct{}{}
		}
		kept := posts[:0]
		for _, post := range posts {
			if _, ok := allowed[post.AuthorID]; ok {
				kept = append(kept, post)
			}
		}
		posts = kept
	}
	suppressed, err := s.posts.SuppressedPostIDs(ctx, viewerID)
	if err != nil {
		suppressed = nil
	}
	blocked := map[string]struct{}{}
	for _, id := range suppressed {
		blocked[id] = struct{}{}
	}
	filtered := make([]store.Post, 0, len(posts))
	fingerprints := map[string]struct{}{}
	for _, post := range posts {
		if _, hidden := blocked[post.ID]; hidden {
			continue
		}
		if post.ContentFingerprint != "" {
			if _, duplicate := fingerprints[post.ContentFingerprint]; duplicate {
				continue
			}
			fingerprints[post.ContentFingerprint] = struct{}{}
		}
		if store.MatchesCategory(post.Kind, category) {
			filtered = append(filtered, post)
		}
	}
	// Wave 2 ranking: freshness, lightweight engagement, role relevance, and
	// opportunity value. The store remains the source of truth for all signals.
	scoredPosts := make([]scoredPost, 0, len(filtered))
	for _, post := range filtered {
		ageHours := math.Max(0, time.Since(post.CreatedAt).Hours())
		freshness := math.Exp(-ageHours / 72)
		likes, _ := s.posts.LikeCount(ctx, post.ID)
		comments, _ := s.posts.ListComments(ctx, post.ID)
		engagement := math.Min(1, float64(likes+len(comments))/20)
		roleMatch := 0.0
		if post.AuthorRole == store.NormalizeRole(viewerRole) {
			roleMatch = 1
		}
		opportunity := 0.0
		if post.Kind == "opportunity-post" || post.Kind == "investment-signal" || post.Kind == "role-available" || post.Kind == "collab-call" {
			opportunity = 1
		}
		relevance := profileRelevance(viewerProfile, post)
		creatorProfile, _ := s.posts.GetDiscoveryProfile(ctx, post.AuthorID)
		reputation := math.Min(1, (creatorProfile.Credibility+creatorProfile.StartupQuality+creatorProfile.ContributionScore)/300)
		interaction, _ := s.posts.PostInteractionCount(ctx, viewerID, post.ID)
		relationship := math.Min(1, float64(interaction)/5)
		saves, _ := s.posts.SaveCount(ctx, post.ID)
		shares, _ := s.posts.ShareCount(ctx, post.ID)
		engagement = math.Min(1, float64(likes+len(comments)+saves+shares*2)/20)
		exploration := 0.0
		creatorPosts, creatorErr := s.posts.CreatorPostCount(ctx, post.AuthorID)
		if creatorErr == nil && creatorPosts <= 2 && (coldStart || category == "for-you" || category == "ai-recommendations" || category == "") {
			exploration = 1
		}
		score := freshness*0.24 + engagement*0.23 + roleMatch*0.10 + opportunity*0.12 + relevance*0.10 + reputation*0.06 + relationship*0.05 + exploration*0.05 + 0.05
		reason := "Fresh activity from the TechIT community"
		if roleMatch > 0 {
			reason = "Relevant to your role and community"
		} else if opportunity > 0 {
			reason = "Actionable opportunity"
		}
		post.RankingVersion = "feed-v7"
		post.RecommendationReason = reason
		post.MatchedSignals = []string{store.CategoryForKind(post.Kind)}
		if coldStart {
			post.MatchedSignals = append(post.MatchedSignals, "cold-start")
		}
		if exploration > 0 {
			post.MatchedSignals = append(post.MatchedSignals, "exploration")
		}
		if relevance > 0 {
			post.MatchedSignals = append(post.MatchedSignals, "profile-relevance")
		}
		if relationship > 0 {
			post.MatchedSignals = append(post.MatchedSignals, "relationship")
		}
		scoredPosts = append(scoredPosts, scoredPost{post: post, score: score, reason: reason})
	}
	sort.SliceStable(scoredPosts, func(i, j int) bool { return scoredPosts[i].score > scoredPosts[j].score })
	if category == "for-you" || category == "ai-recommendations" || category == "" {
		scoredPosts = balanceCategories(scoredPosts)
	}
	creatorCount := map[string]int{}
	out := make([]store.Post, 0, limit)
	decisions := make([]store.RankingDecision, 0, limit)
	variant := rankingVariant(viewerID, category)
	for _, item := range scoredPosts {
		if creatorCount[item.post.AuthorID] >= 2 {
			continue
		}
		creatorCount[item.post.AuthorID]++
		out = append(out, item.post)
		decisions = append(decisions, store.RankingDecision{ID: protocol.NewMsgID(), UserID: viewerID, PostID: item.post.ID, Category: category, RankingVersion: item.post.RankingVersion, Variant: variant, Score: item.score, Signals: append([]string(nil), item.post.MatchedSignals...), CreatedAt: s.now().UTC()})
		if len(out) >= limit {
			break
		}
	}
	_ = s.posts.RecordRankingDecisions(ctx, decisions)
	if s.cache != nil {
		s.cache.Set(ctx, cacheKey, out)
	}
	return out, nil
}

func profileRelevance(profile store.DiscoveryProfile, post store.Post) float64 {
	body := strings.ToLower(post.Body)
	matched := 0
	for _, term := range append(append(profile.Skills, profile.Industries...), profile.Interests...) {
		if strings.Contains(body, strings.ToLower(term)) {
			matched++
		}
	}
	if matched > 0 {
		return math.Min(1, float64(matched)/3)
	}
	return 0
}

func rankingVariant(userID, category string) string {
	digest := sha256.Sum256([]byte(userID + "|" + category + "|feed-v6"))
	if digest[0]%2 == 0 {
		return "control"
	}
	return "treatment"
}

// balanceCategories interleaves the highest-ranked post from each available
// category. This keeps discovery varied without inventing content and falls
// back naturally when a category has no eligible posts.
func balanceCategories(items []scoredPost) []scoredPost {
	if len(items) < 2 {
		return items
	}
	buckets := map[string][]scoredPost{}
	order := make([]string, 0, 5)
	for _, item := range items {
		cat := store.CategoryForKind(item.post.Kind)
		if _, ok := buckets[cat]; !ok {
			order = append(order, cat)
		}
		buckets[cat] = append(buckets[cat], item)
	}
	// Buckets inherit global score order; round-robin preserves each bucket's
	// ranking while avoiding consecutive same-category results where possible.
	out := make([]scoredPost, 0, len(items))
	for len(out) < len(items) {
		added := false
		for _, cat := range order {
			bucket := buckets[cat]
			if len(bucket) == 0 {
				continue
			}
			out = append(out, bucket[0])
			buckets[cat] = bucket[1:]
			added = true
		}
		if !added {
			break
		}
	}
	return out
}

// Like records a like (idempotent), returns the new like count, and broadcasts.
func (s *Service) Like(ctx context.Context, postID, userID string, audience []string) (int, error) {
	ok, err := s.posts.PostExists(ctx, postID)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, ErrPostNotFound
	}
	if err := s.posts.Like(ctx, postID, userID); err != nil {
		return 0, err
	}
	s.invalidate(ctx)
	n, err := s.posts.LikeCount(ctx, postID)
	if err != nil {
		return 0, err
	}
	s.broadcast(ctx, userID, audience, protocol.TypePostLiked, map[string]any{
		"postId": postID, "userId": userID, "likeCount": n,
	})
	return n, nil
}

// Unlike removes a like (idempotent) and returns the new count.
func (s *Service) Unlike(ctx context.Context, postID, userID string) (int, error) {
	if err := s.posts.Unlike(ctx, postID, userID); err != nil {
		return 0, err
	}
	return s.posts.LikeCount(ctx, postID)
}

// AddComment persists a comment then broadcasts post.comment.
func (s *Service) AddComment(ctx context.Context, postID, authorID string, p protocol.CommentPayload, audience []string) (store.Comment, error) {
	ok, err := s.posts.PostExists(ctx, postID)
	if err != nil {
		return store.Comment{}, err
	}
	if !ok {
		return store.Comment{}, ErrPostNotFound
	}
	c := store.Comment{ID: protocol.NewMsgID(), PostID: postID, AuthorID: authorID, Body: p.Body, Mentions: mentions.Resolve(ctx, s.users, p.Body), CreatedAt: s.now().UTC()}
	if err := s.posts.AddComment(ctx, c); err != nil {
		return store.Comment{}, err
	}
	s.invalidate(ctx)
	s.broadcast(ctx, authorID, audience, protocol.TypePostComment, map[string]any{
		"id": c.ID, "postId": postID, "authorId": authorID, "body": c.Body, "mentions": c.Mentions, "ts": c.CreatedAt.Format(time.RFC3339),
	})
	s.broadcast(ctx, authorID, mentions.UserIDs(c.Mentions, authorID), protocol.TypeMentionNew, map[string]any{
		"entityType": "comment", "entityId": c.ID, "postId": postID, "actorId": authorID, "mentions": c.Mentions,
	})
	return c, nil
}

// ListPosts returns recent posts (keyset paginated).
func (s *Service) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.posts.ListPosts(ctx, before, limit)
}

// ListComments returns a post's comments.
func (s *Service) ListComments(ctx context.Context, postID string) ([]store.Comment, error) {
	return s.posts.ListComments(ctx, postID)
}

func (s *Service) EditPost(ctx context.Context, actorID, postID, body string, expectedVersion int, audience []string) (store.Post, error) {
	p, err := s.posts.EditPost(ctx, postID, actorID, strings.TrimSpace(body), expectedVersion, s.now().UTC()); if err != nil { return store.Post{}, err }
	s.invalidate(ctx); s.broadcast(ctx, actorID, audience, protocol.TypePostUpdated, map[string]any{"id": p.ID, "authorId": p.AuthorID, "body": p.Body, "editedAt": p.EditedAt, "editVersion": p.EditVersion}); return p, nil
}

func (s *Service) DeletePost(ctx context.Context, actorID, postID string, expectedVersion int, audience []string) (store.Post, error) {
	p, err := s.posts.DeletePost(ctx, postID, actorID, expectedVersion, s.now().UTC()); if err != nil { return store.Post{}, err }
	s.invalidate(ctx); s.broadcast(ctx, actorID, audience, protocol.TypePostDeleted, map[string]any{"id": p.ID, "authorId": p.AuthorID, "deletedAt": p.DeletedAt, "editVersion": p.EditVersion}); return p, nil
}

func (s *Service) EditComment(ctx context.Context, actorID, commentID, body string, expectedVersion int, audience []string) (store.Comment, error) {
	c, err := s.posts.EditComment(ctx, commentID, actorID, strings.TrimSpace(body), expectedVersion, s.now().UTC()); if err != nil { return store.Comment{}, err }
	s.invalidate(ctx); s.broadcast(ctx, actorID, audience, protocol.TypeCommentUpdated, map[string]any{"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "editedAt": c.EditedAt, "editVersion": c.EditVersion}); return c, nil
}

func (s *Service) DeleteComment(ctx context.Context, actorID, commentID string, expectedVersion int, audience []string) (store.Comment, error) {
	c, err := s.posts.DeleteComment(ctx, commentID, actorID, expectedVersion, s.now().UTC()); if err != nil { return store.Comment{}, err }
	s.invalidate(ctx); s.broadcast(ctx, actorID, audience, protocol.TypeCommentDeleted, map[string]any{"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "deletedAt": c.DeletedAt, "editVersion": c.EditVersion}); return c, nil
}

func (s *Service) SavePost(ctx context.Context, postID, userID string, saved bool) error {
	err := s.posts.SavePost(ctx, postID, userID, saved)
	if err == nil {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) SetPostFeedback(ctx context.Context, postID, userID, feedback string) error {
	err := s.posts.SetPostFeedback(ctx, postID, userID, feedback)
	if err == nil {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) FollowUser(ctx context.Context, followerID, followeeID string, following bool) error {
	err := s.posts.FollowUser(ctx, followerID, followeeID, following)
	if err == nil {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) RecordEvent(ctx context.Context, event store.FeedEvent) error {
	err := s.posts.RecordFeedEvent(ctx, event)
	if err == nil && (event.EventType == "share" || event.EventType == "save" || event.EventType == "comment" || event.EventType == "like") {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) RankingMetrics(ctx context.Context) ([]store.RankingMetrics, error) {
	return s.posts.RankingMetrics(ctx)
}
func (s *Service) UpsertDiscoveryProfile(ctx context.Context, profile store.DiscoveryProfile) error {
	existing, err := s.posts.GetDiscoveryProfile(ctx, profile.UserID)
	if err != nil {
		return err
	}
	profile.Credibility = existing.Credibility
	profile.StartupQuality = existing.StartupQuality
	profile.ContributionScore = existing.ContributionScore
	err = s.posts.UpsertDiscoveryProfile(ctx, profile)
	if err == nil {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) SuppressedPostIDs(ctx context.Context, userID string) ([]string, error) {
	return s.posts.SuppressedPostIDs(ctx, userID)
}
func (s *Service) SetCreatorControl(ctx context.Context, userID, creatorID, control string, enabled bool) error {
	err := s.posts.SetCreatorControl(ctx, userID, creatorID, control, enabled)
	if err == nil {
		s.invalidate(ctx)
	}
	return err
}
func (s *Service) IsFollowing(ctx context.Context, followerID, followeeID string) (bool, error) {
	return s.posts.IsFollowing(ctx, followerID, followeeID)
}
func (s *Service) IsBlockedBetween(ctx context.Context, a, b string) (bool, error) {
	blocked, err := s.posts.HasCreatorControl(ctx, a, b, "block")
	if err != nil {
		return false, err
	}
	reverse, err := s.posts.HasCreatorControl(ctx, b, a, "block")
	return blocked || reverse, err
}
func (s *Service) ListRankingDecisions(ctx context.Context, userID string, limit int) ([]store.RankingDecision, error) {
	return s.posts.ListRankingDecisions(ctx, userID, limit)
}
func (s *Service) ListModerationQueue(ctx context.Context, limit int) ([]store.Post, error) {
	return s.posts.ListModerationQueue(ctx, limit)
}
func (s *Service) ReviewPost(ctx context.Context, postID, reviewerID, status, reason string) error {
	return s.posts.ReviewPost(ctx, postID, reviewerID, status, reason)
}

func (s *Service) broadcast(ctx context.Context, actor string, audience []string, typ string, data map[string]any) {
	raw, _ := json.Marshal(data)
	env := protocol.Envelope{Type: typ, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
	for _, u := range audience {
		if u != actor {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
}
