package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/discovery"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/feed"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// feedErr maps a feed-service error to an HTTP status: missing post -> 404,
// otherwise 500.
func feedErr(w http.ResponseWriter, err error) {
	if errors.Is(err, feed.ErrPostNotFound) {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, feed.ErrInvalidKind) {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, feed.ErrDuplicatePost) {
		writeErr(w, http.StatusConflict, err.Error())
		return
	}
	writeErr(w, http.StatusInternalServerError, err.Error())
}

// audience returns the set of users to broadcast feed events to: the currently
// online users (Phase 1 audience = everyone connected).
func audience(d Deps, r *http.Request) []string {
	ids, _ := d.Presence.ListOnline(r.Context())
	return ids
}

func forwardDiscovery(d Deps, r *http.Request, eventType, entityType, entityID string, metadata map[string]any) {
	if d.Discovery == nil {
		return
	}
	d.Discovery.Enqueue(discovery.Event{
		Token: r.Header.Get("Authorization"), EventType: eventType,
		EntityType: entityType, EntityID: entityID, Surface: "feed", Metadata: metadata,
	})
}

func userWire(d Deps, r *http.Request, userID string) any {
	user, err := d.Users.Get(r.Context(), userID)
	if err != nil {
		return nil
	}
	return identityJSON(user)
}

func mentionIDs(items []store.Mention) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		out = append(out, item.UserID)
	}
	return out
}

func handleListPosts(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		zone := r.URL.Query().Get("zone")
		if zone == "" {
			zone = "global"
		}
		category := r.URL.Query().Get("category")
		categoryProvided := category != ""
		if category == "" {
			// Existing URLs remain stable while gaining canonical discovery labels.
			switch zone {
			case "tribe":
				category = "following"
			case "global":
				category = "for-you"
			}
		}
		limit := 50
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > 200 {
				writeErr(w, http.StatusBadRequest, "limit must be between 1 and 200")
				return
			}
			limit = parsed
		}
		// Preserve the legacy tribe zone contract: an omitted category means
		// role/audience filtering, while an explicit Following category opts into
		// persisted follow filtering.
		serviceCategory := category
		if zone == "tribe" && !categoryProvided {
			serviceCategory = ""
		}
		posts, err := d.Feed.ListByCategory(r.Context(), currentUser(r), currentRole(r), zone, serviceCategory, r.URL.Query().Get("before"), limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(posts))
		for _, p := range posts {
			out = append(out, map[string]any{
				"id": p.ID, "authorId": p.AuthorID, "authorRole": p.AuthorRole,
				"author": userWire(d, r, p.AuthorID), "audience": p.Audience, "kind": p.Kind, "category": store.CategoryForKind(p.Kind), "body": p.Body, "mentions": p.Mentions, "ts": p.CreatedAt, "expiresAt": p.ExpiresAt, "editedAt": p.EditedAt, "editVersion": p.EditVersion,
				"recommendationReason": p.RecommendationReason, "matchedSignals": p.MatchedSignals, "rankingVersion": p.RankingVersion, "moderationStatus": p.ModerationStatus,
			})
		}
		nextCursor := ""
		if len(posts) == limit {
			nextCursor = posts[len(posts)-1].ID
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": out, "category": category, "nextCursor": nextCursor, "hasMore": nextCursor != ""})
	}
}

func mutationBody(r *http.Request) (string, int, error) {
	var body struct { Body string `json:"body"`; ExpectedVersion int `json:"expectedVersion"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Body) == "" { return "", 0, errors.New("body required") }
	return strings.TrimSpace(body.Body), body.ExpectedVersion, nil
}

func handleEditPost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { body, version, err := mutationBody(r); if err != nil { writeErr(w, http.StatusBadRequest, err.Error()); return }; p, err := d.Feed.EditPost(r.Context(), currentUser(r), chi.URLParam(r, "id"), body, version, audience(d, r)); if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }; writeJSON(w, http.StatusOK, map[string]any{"id": p.ID, "authorId": p.AuthorID, "body": p.Body, "editedAt": p.EditedAt, "editVersion": p.EditVersion}) }
}

func handleDeletePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { var body struct { ExpectedVersion int `json:"expectedVersion"` }; _ = json.NewDecoder(r.Body).Decode(&body); p, err := d.Feed.DeletePost(r.Context(), currentUser(r), chi.URLParam(r, "id"), body.ExpectedVersion, audience(d, r)); if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }; writeJSON(w, http.StatusOK, map[string]any{"id": p.ID, "authorId": p.AuthorID, "deletedAt": p.DeletedAt, "editVersion": p.EditVersion}) }
}

func handleEditComment(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { body, version, err := mutationBody(r); if err != nil { writeErr(w, http.StatusBadRequest, err.Error()); return }; c, err := d.Feed.EditComment(r.Context(), currentUser(r), chi.URLParam(r, "commentId"), body, version, audience(d, r)); if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }; writeJSON(w, http.StatusOK, map[string]any{"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "editedAt": c.EditedAt, "editVersion": c.EditVersion}) }
}

func handleDeleteComment(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { var body struct { ExpectedVersion int `json:"expectedVersion"` }; _ = json.NewDecoder(r.Body).Decode(&body); c, err := d.Feed.DeleteComment(r.Context(), currentUser(r), chi.URLParam(r, "commentId"), body.ExpectedVersion, audience(d, r)); if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }; writeJSON(w, http.StatusOK, map[string]any{"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "deletedAt": c.DeletedAt, "editVersion": c.EditVersion}) }
}

func handleCreatePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		var p protocol.CreatePostPayload
		if json.NewDecoder(r.Body).Decode(&p) != nil || p.Body == "" {
			writeErr(w, http.StatusBadRequest, "body required")
			return
		}
		post, err := d.Feed.CreatePost(r.Context(), me, currentRole(r), p, audience(d, r))
		if err != nil {
			feedErr(w, err)
			return
		}
		forwardDiscovery(d, r, "content_created", "content", post.ID, map[string]any{"kind": post.Kind})
		if len(post.Mentions) > 0 {
			forwardDiscovery(d, r, "mention", "content", post.ID, map[string]any{"targetUserIds": mentionIDs(post.Mentions), "linkTo": "/feed/post/" + post.ID})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": post.ID, "authorId": post.AuthorID, "authorRole": post.AuthorRole,
			"author": userWire(d, r, post.AuthorID), "audience": post.Audience, "kind": post.Kind, "body": post.Body, "mentions": post.Mentions, "ts": post.CreatedAt, "expiresAt": post.ExpiresAt,
		})
	}
}

func handleLikePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		n, err := d.Feed.Like(r.Context(), postID, me, audience(d, r))
		if err != nil {
			feedErr(w, err)
			return
		}
		forwardDiscovery(d, r, "like", "content", postID, nil)
		writeJSON(w, http.StatusOK, map[string]any{"likeCount": n})
	}
}

func handleUnlikePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		n, err := d.Feed.Unlike(r.Context(), postID, me)
		if err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"likeCount": n})
	}
}

func handleSavePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := d.Feed.SavePost(r.Context(), id, currentUser(r), true); err != nil {
			feedErr(w, err)
			return
		}
		forwardDiscovery(d, r, "save", "content", id, nil)
		writeJSON(w, http.StatusOK, map[string]any{"saved": true})
	}
}
func handleUnsavePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := d.Feed.SavePost(r.Context(), chi.URLParam(r, "id"), currentUser(r), false); err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"saved": false})
	}
}
func handlePostFeedback(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Feedback string `json:"feedback"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Feedback == "" {
			writeErr(w, http.StatusBadRequest, "feedback required")
			return
		}
		switch body.Feedback {
		case "hide", "not_interested", "mute", "block", "report":
		default:
			writeErr(w, http.StatusBadRequest, "unsupported feedback")
			return
		}
		id := chi.URLParam(r, "id")
		if err := d.Feed.SetPostFeedback(r.Context(), id, currentUser(r), body.Feedback); err != nil {
			feedErr(w, err)
			return
		}
		forwardDiscovery(d, r, body.Feedback, "content", id, nil)
		writeJSON(w, http.StatusOK, map[string]any{"feedback": body.Feedback})
	}
}

func handleCreatorControl(d Deps, control string, enabled bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		creatorID := chi.URLParam(r, "userId")
		if creatorID == currentUser(r) {
			writeErr(w, http.StatusBadRequest, "cannot control your own account")
			return
		}
		if err := d.Feed.SetCreatorControl(r.Context(), currentUser(r), creatorID, control, enabled); err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{control: enabled})
	}
}

func handleRankingAudit(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > 100 {
				writeErr(w, http.StatusBadRequest, "limit must be between 1 and 100")
				return
			}
			limit = parsed
		}
		decisions, err := d.Feed.ListRankingDecisions(r.Context(), currentUser(r), limit)
		if err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"decisions": decisions, "rankingVersion": "feed-v6"})
	}
}

func requireModerator(r *http.Request) bool {
	role := currentRole(r)
	return role == "admin" || role == "super_admin" || role == "moderator"
}
func handleModerationQueue(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireModerator(r) {
			writeErr(w, http.StatusForbidden, "moderator access required")
			return
		}
		posts, err := d.Feed.ListModerationQueue(r.Context(), 100)
		if err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
	}
}
func handleModerationReview(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireModerator(r) {
			writeErr(w, http.StatusForbidden, "moderator access required")
			return
		}
		var body struct {
			Status string `json:"status"`
			Reason string `json:"reason"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || (body.Status != "visible" && body.Status != "blocked" && body.Status != "pending_review") {
			writeErr(w, http.StatusBadRequest, "status must be visible, blocked, or pending_review")
			return
		}
		if err := d.Feed.ReviewPost(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Status, body.Reason); err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"reviewed": true, "status": body.Status})
	}
}
func handleRankingMetrics(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireModerator(r) {
			writeErr(w, http.StatusForbidden, "moderator access required")
			return
		}
		metrics, err := d.Feed.RankingMetrics(r.Context())
		if err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"metrics": metrics, "rankingVersion": "feed-v7"})
	}
}
func handleDiscoveryProfile(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p store.DiscoveryProfile
		if json.NewDecoder(r.Body).Decode(&p) != nil {
			writeErr(w, http.StatusBadRequest, "invalid discovery profile")
			return
		}
		p.UserID = currentUser(r)
		if err := d.Feed.UpsertDiscoveryProfile(r.Context(), p); err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"saved": true})
	}
}
func handleFeedEvent(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PostID    string          `json:"postId"`
			EventType string          `json:"eventType"`
			Metadata  json.RawMessage `json:"metadata"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.EventType == "" {
			writeErr(w, http.StatusBadRequest, "eventType required")
			return
		}
		switch body.EventType {
		case "impression", "open", "like", "comment", "share", "save", "dismiss":
		default:
			writeErr(w, http.StatusBadRequest, "unsupported event type")
			return
		}
		body.Metadata = sanitizeFeedMetadata(body.Metadata)
		if err := d.Feed.RecordEvent(r.Context(), store.FeedEvent{ID: protocol.NewMsgID(), UserID: currentUser(r), PostID: body.PostID, EventType: body.EventType, Metadata: body.Metadata, CreatedAt: time.Now().UTC()}); err != nil {
			feedErr(w, err)
			return
		}
		var metadata map[string]any
		_ = json.Unmarshal(body.Metadata, &metadata)
		forwardDiscovery(d, r, body.EventType, "content", body.PostID, metadata)
		writeJSON(w, http.StatusAccepted, map[string]any{"recorded": true})
	}
}

func sanitizeFeedMetadata(raw json.RawMessage) json.RawMessage {
	var input map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &input) != nil {
		return json.RawMessage(`{}`)
	}
	allowed := map[string]bool{"category": true, "position": true, "rankingVersion": true, "surface": true}
	clean := map[string]any{}
	for key, value := range input {
		if allowed[key] {
			clean[key] = value
		}
	}
	out, err := json.Marshal(clean)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return out
}
func handleFollowUser(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "userId")
		if err := d.Feed.FollowUser(r.Context(), currentUser(r), id, true); err != nil {
			feedErr(w, err)
			return
		}
		forwardDiscovery(d, r, "follow", "person", id, nil)
		writeJSON(w, http.StatusOK, map[string]any{"following": true})
	}
}

func handleDiscoveryModules(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if d.Discovery == nil {
			writeErr(w, http.StatusServiceUnavailable, "discovery integration disabled")
			return
		}
		body, status, err := d.Discovery.Modules(r.Context(), r.Header.Get("Authorization"), r.URL.Query())
		if err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}
}
func handleUnfollowUser(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := d.Feed.FollowUser(r.Context(), currentUser(r), chi.URLParam(r, "userId"), false); err != nil {
			feedErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"following": false})
	}
}

// handleFollowCounts reports explicit follower/following counts for a user.
// Tribe membership is derived from post audience, not follow edges, so it is
// never counted here.
func handleFollowCounts(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := chi.URLParam(r, "userId")
		if userID == "" {
			writeErr(w, http.StatusBadRequest, "userId is required")
			return
		}
		followers, following, err := d.Feed.FollowCounts(r.Context(), userID)
		if err != nil {
			feedErr(w, err)
			return
		}
		viewerFollows := false
		if viewer := currentUser(r); viewer != "" && viewer != userID {
			if following, err := d.Feed.IsFollowing(r.Context(), viewer, userID); err == nil {
				viewerFollows = following
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"userId": userID, "followers": followers, "following": following, "viewerFollows": viewerFollows})
	}
}

func handleListComments(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		postID := chi.URLParam(r, "id")
		cs, err := d.Feed.ListComments(r.Context(), postID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(cs))
		for _, c := range cs {
			out = append(out, map[string]any{
				"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "author": userWire(d, r, c.AuthorID), "body": func() string { if c.DeletedAt != nil { return "This comment was deleted" }; return c.Body }(), "mentions": c.Mentions, "ts": c.CreatedAt, "editedAt": c.EditedAt, "deletedAt": c.DeletedAt, "editVersion": c.EditVersion,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"comments": out})
	}
}

func handleAddComment(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		var p protocol.CommentPayload
		if json.NewDecoder(r.Body).Decode(&p) != nil || p.Body == "" {
			writeErr(w, http.StatusBadRequest, "body required")
			return
		}
		c, err := d.Feed.AddComment(r.Context(), postID, me, p, audience(d, r))
		if err != nil {
			feedErr(w, err)
			return
		}
		if len(c.Mentions) > 0 {
			forwardDiscovery(d, r, "mention", "comment", c.ID, map[string]any{"targetUserIds": mentionIDs(c.Mentions), "linkTo": "/feed/post/" + postID})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "author": userWire(d, r, c.AuthorID), "body": c.Body, "mentions": c.Mentions, "ts": c.CreatedAt,
		})
	}
}
