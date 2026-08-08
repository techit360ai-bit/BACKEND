package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
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
	writeErr(w, http.StatusInternalServerError, err.Error())
}

// audience returns the set of users to broadcast feed events to: the currently
// online users (Phase 1 audience = everyone connected).
func audience(d Deps, r *http.Request) []string {
	ids, _ := d.Presence.ListOnline(r.Context())
	return ids
}

func handleListPosts(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		zone := r.URL.Query().Get("zone")
		if zone == "" {
			zone = "global"
		}
		category := r.URL.Query().Get("category")
		if category == "" {
			// Existing URLs remain stable while gaining canonical discovery labels.
			switch zone { case "tribe": category = "following"; case "global": category = "for-you" }
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
		posts, err := d.Feed.ListByCategory(r.Context(), currentUser(r), currentRole(r), zone, category, r.URL.Query().Get("before"), limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(posts))
		for _, p := range posts {
			out = append(out, map[string]any{
				"id": p.ID, "authorId": p.AuthorID, "authorRole": p.AuthorRole,
				"audience": p.Audience, "kind": p.Kind, "category": store.CategoryForKind(p.Kind), "body": p.Body, "ts": p.CreatedAt,
				"recommendationReason": p.RecommendationReason, "matchedSignals": p.MatchedSignals, "rankingVersion": p.RankingVersion,
			})
		}
		nextCursor := ""
		if len(posts) == limit { nextCursor = posts[len(posts)-1].ID }
		writeJSON(w, http.StatusOK, map[string]any{"posts": out, "category": category, "nextCursor": nextCursor, "hasMore": nextCursor != ""})
	}
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
		writeJSON(w, http.StatusOK, map[string]any{
			"id": post.ID, "authorId": post.AuthorID, "authorRole": post.AuthorRole,
			"audience": post.Audience, "kind": post.Kind, "body": post.Body, "ts": post.CreatedAt,
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
	return func(w http.ResponseWriter, r *http.Request) { if err := d.Feed.SavePost(r.Context(), chi.URLParam(r, "id"), currentUser(r), true); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusOK, map[string]any{"saved": true}) }
}
func handleUnsavePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { if err := d.Feed.SavePost(r.Context(), chi.URLParam(r, "id"), currentUser(r), false); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusOK, map[string]any{"saved": false}) }
}
func handlePostFeedback(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { var body struct{ Feedback string `json:"feedback"` }; if json.NewDecoder(r.Body).Decode(&body) != nil || body.Feedback == "" { writeErr(w, http.StatusBadRequest, "feedback required"); return }; if err := d.Feed.SetPostFeedback(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Feedback); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusOK, map[string]any{"feedback": body.Feedback}) }
}
func handleFeedEvent(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { var body struct{ PostID string `json:"postId"`; EventType string `json:"eventType"`; Metadata json.RawMessage `json:"metadata"` }; if json.NewDecoder(r.Body).Decode(&body) != nil || body.EventType == "" { writeErr(w, http.StatusBadRequest, "eventType required"); return }; if len(body.Metadata) == 0 { body.Metadata = json.RawMessage(`{}`) }; if err := d.Feed.RecordEvent(r.Context(), store.FeedEvent{ID: protocol.NewMsgID(), UserID: currentUser(r), PostID: body.PostID, EventType: body.EventType, Metadata: body.Metadata, CreatedAt: time.Now().UTC()}); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusAccepted, map[string]any{"recorded": true}) }
}
func handleFollowUser(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { if err := d.Feed.FollowUser(r.Context(), currentUser(r), chi.URLParam(r, "userId"), true); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusOK, map[string]any{"following": true}) }
}
func handleUnfollowUser(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { if err := d.Feed.FollowUser(r.Context(), currentUser(r), chi.URLParam(r, "userId"), false); err != nil { feedErr(w, err); return }; writeJSON(w, http.StatusOK, map[string]any{"following": false}) }
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
				"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "ts": c.CreatedAt,
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
		writeJSON(w, http.StatusOK, map[string]any{
			"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "ts": c.CreatedAt,
		})
	}
}
