package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/feed"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// feedErr maps a feed-service error to an HTTP status: missing post -> 404,
// otherwise 500.
func feedErr(w http.ResponseWriter, err error) {
	if errors.Is(err, feed.ErrPostNotFound) {
		writeErr(w, http.StatusNotFound, err.Error())
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
		posts, err := d.Feed.ListPosts(r.Context(), r.URL.Query().Get("before"), 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(posts))
		for _, p := range posts {
			out = append(out, map[string]any{
				"id": p.ID, "authorId": p.AuthorID, "kind": p.Kind, "body": p.Body, "ts": p.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": out})
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
		post, err := d.Feed.CreatePost(r.Context(), me, p, audience(d, r))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": post.ID, "authorId": post.AuthorID, "kind": post.Kind, "body": post.Body, "ts": post.CreatedAt,
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
