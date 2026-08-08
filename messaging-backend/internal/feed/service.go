// Package feed orchestrates the social feed: create posts, like/unlike, and
// comment, persisting each then broadcasting post.* envelopes to an audience.
package feed

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// ErrPostNotFound is returned when an action targets a missing post.
var ErrPostNotFound = errors.New("post not found")

// ErrInvalidKind is returned when a post kind is not allowed for the author's role.
var ErrInvalidKind = errors.New("invalid post kind for role")

// Service handles feed posts.
type Service struct {
	posts  store.PostStore
	router store.Router
	now    func() time.Time
}

func New(p store.PostStore, r store.Router) *Service {
	return &Service{posts: p, router: r, now: time.Now}
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
		CreatedAt:  s.now().UTC(),
	}
	if err := s.posts.CreatePost(ctx, post); err != nil {
		return store.Post{}, err
	}
	s.broadcast(ctx, authorID, recipients, protocol.TypePostNew, map[string]any{
		"id": post.ID, "authorId": authorID, "authorRole": post.AuthorRole,
		"audience": post.Audience, "kind": post.Kind, "body": post.Body,
		"ts": post.CreatedAt.Format(time.RFC3339),
	})
	return post, nil
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
	if limit <= 0 || limit > 200 { limit = 50 }
	posts, err := s.ListByZone(ctx, viewerRole, zone, before, limit*4)
	if err != nil { return nil, err }
	suppressed, err := s.posts.SuppressedPostIDs(ctx, viewerID)
	if err != nil { suppressed = nil }
	blocked := map[string]struct{}{}; for _, id := range suppressed { blocked[id] = struct{}{} }
	filtered := make([]store.Post, 0, len(posts))
	for _, post := range posts {
		if _, hidden := blocked[post.ID]; hidden { continue }
		if store.MatchesCategory(post.Kind, category) { filtered = append(filtered, post) }
	}
	// Wave 2 ranking: freshness, lightweight engagement, role relevance, and
	// opportunity value. The store remains the source of truth for all signals.
	type scored struct { post store.Post; score float64; reason string }
	scoredPosts := make([]scored, 0, len(filtered))
	for _, post := range filtered {
		ageHours := math.Max(0, time.Since(post.CreatedAt).Hours())
		freshness := math.Exp(-ageHours / 72)
		likes, _ := s.posts.LikeCount(ctx, post.ID)
		comments, _ := s.posts.ListComments(ctx, post.ID)
		engagement := math.Min(1, float64(likes+len(comments))/20)
		roleMatch := 0.0
		if post.AuthorRole == store.NormalizeRole(viewerRole) { roleMatch = 1 }
		opportunity := 0.0
		if post.Kind == "opportunity-post" || post.Kind == "investment-signal" || post.Kind == "role-available" || post.Kind == "collab-call" { opportunity = 1 }
		score := freshness*0.35 + engagement*0.25 + roleMatch*0.15 + opportunity*0.15 + 0.10
		reason := "Fresh activity from the TechIT community"
		if roleMatch > 0 { reason = "Relevant to your role and community" } else if opportunity > 0 { reason = "Actionable opportunity" }
		post.RankingVersion = "feed-v2"
		post.RecommendationReason = reason
		post.MatchedSignals = []string{store.CategoryForKind(post.Kind)}
		scoredPosts = append(scoredPosts, scored{post: post, score: score, reason: reason})
	}
	sort.SliceStable(scoredPosts, func(i, j int) bool { return scoredPosts[i].score > scoredPosts[j].score })
	creatorCount := map[string]int{}
	out := make([]store.Post, 0, limit)
	for _, item := range scoredPosts { if creatorCount[item.post.AuthorID] >= 2 { continue }; creatorCount[item.post.AuthorID]++; out = append(out, item.post); if len(out) >= limit { break } }
	return out, nil
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
	c := store.Comment{ID: protocol.NewMsgID(), PostID: postID, AuthorID: authorID, Body: p.Body, CreatedAt: s.now().UTC()}
	if err := s.posts.AddComment(ctx, c); err != nil {
		return store.Comment{}, err
	}
	s.broadcast(ctx, authorID, audience, protocol.TypePostComment, map[string]any{
		"id": c.ID, "postId": postID, "authorId": authorID, "body": c.Body, "ts": c.CreatedAt.Format(time.RFC3339),
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

func (s *Service) SavePost(ctx context.Context, postID, userID string, saved bool) error { return s.posts.SavePost(ctx, postID, userID, saved) }
func (s *Service) SetPostFeedback(ctx context.Context, postID, userID, feedback string) error { return s.posts.SetPostFeedback(ctx, postID, userID, feedback) }
func (s *Service) FollowUser(ctx context.Context, followerID, followeeID string, following bool) error { return s.posts.FollowUser(ctx, followerID, followeeID, following) }
func (s *Service) RecordEvent(ctx context.Context, event store.FeedEvent) error { return s.posts.RecordFeedEvent(ctx, event) }
func (s *Service) SuppressedPostIDs(ctx context.Context, userID string) ([]string, error) { return s.posts.SuppressedPostIDs(ctx, userID) }

func (s *Service) broadcast(ctx context.Context, actor string, audience []string, typ string, data map[string]any) {
	raw, _ := json.Marshal(data)
	env := protocol.Envelope{Type: typ, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
	for _, u := range audience {
		if u != actor {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
}
