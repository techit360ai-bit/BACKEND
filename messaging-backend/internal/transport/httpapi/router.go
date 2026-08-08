// Package httpapi is the REST surface: health, dev token, conversations, and
// presence. Authenticated routes require a Bearer JWT.
package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/auth"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/channel"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/demo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/feed"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/livekit"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/messaging"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/presence"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/qa"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// Deps are the API's collaborators.
type Deps struct {
	Verifier       *auth.Verifier
	Users          store.UserStore
	Conversations  store.ConversationStore
	Messages       store.MessageStore
	Messaging      *messaging.Service
	Channels       *channel.Service
	ChannelStore   store.ChannelStore
	Feed           *feed.Service
	Demo           *demo.Service
	QA             *qa.Service
	LiveKit        *livekit.Service
	Presence       *presence.Service
	EnableDevToken bool
	CORSOrigins    string
}

type ctxKey string

const claimsKey ctxKey = "claims"

// NewRouter builds the chi router.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)

	r.Get("/health", handleHealth)

	r.Route("/api/v1", func(r chi.Router) {
		if d.EnableDevToken {
			r.Get("/dev/token", handleDevToken(d))
		}
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware(d.Verifier))
			r.Post("/conversations", handleCreateConversation(d))
			r.Get("/conversations", handleListConversations(d))
			r.Get("/conversations/{id}/messages", handleHistory(d))
			r.Post("/conversations/{id}/messages", handleRESTSend(d))
			r.Post("/conversations/{id}/read", handleMarkRead(d))
			r.Get("/users/online", handleOnline(d))

			r.Get("/channels", handleListChannels(d))
			r.Get("/channels/{id}/messages", handleChannelHistory(d))
			r.Post("/channels/{id}/messages", handleChannelSend(d))
			r.Post("/channels/{id}/read", handleChannelRead(d))

			r.Get("/posts", handleListPosts(d))
			r.Post("/posts", handleCreatePost(d))
			r.Post("/posts/{id}/like", handleLikePost(d))
			r.Delete("/posts/{id}/like", handleUnlikePost(d))
			r.Post("/posts/{id}/save", handleSavePost(d))
			r.Delete("/posts/{id}/save", handleUnsavePost(d))
			r.Post("/posts/{id}/feedback", handlePostFeedback(d))
			r.Post("/feed/events", handleFeedEvent(d))
			r.Post("/users/{userId}/follow", handleFollowUser(d))
			r.Delete("/users/{userId}/follow", handleUnfollowUser(d))
			r.Post("/users/{userId}/mute", handleCreatorControl(d, "mute", true))
			r.Delete("/users/{userId}/mute", handleCreatorControl(d, "mute", false))
			r.Post("/users/{userId}/block", handleCreatorControl(d, "block", true))
			r.Delete("/users/{userId}/block", handleCreatorControl(d, "block", false))
			r.Get("/posts/{id}/comments", handleListComments(d))
			r.Post("/posts/{id}/comments", handleAddComment(d))

			r.Post("/demos", handleCreateDemo(d))
			r.Get("/demos", handleListDemos(d))
			r.Get("/demos/{id}", handleGetDemo(d))
			r.Patch("/demos/{id}", handleUpdateDemo(d))
			r.Post("/demos/{id}/status", handleDemoStatus(d))
			r.Post("/demos/{id}/invites", handleDemoInvite(d))
			r.Post("/demos/{id}/invites/respond", handleDemoRespond(d))
			r.Post("/demos/{id}/rtc-token", handleDemoRtcToken(d))
			r.Post("/demos/{id}/questions", handleAskQuestion(d))
			r.Get("/demos/{id}/questions", handleListQuestions(d))
			r.Post("/demos/{id}/questions/{qid}/upvote", handleUpvoteQuestion(d))
			r.Post("/demos/{id}/questions/{qid}/resolve", handleResolveQuestion(d))
		})
	})
	return r
}

func authMiddleware(v *auth.Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			token := strings.TrimPrefix(h, "Bearer ")
			if token == h || token == "" {
				writeErr(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			claims, err := v.Verify(token)
			if err != nil {
				writeErr(w, http.StatusUnauthorized, "invalid token")
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func currentUser(r *http.Request) string {
	c, _ := r.Context().Value(claimsKey).(auth.Claims)
	return c.UserID
}
func currentRole(r *http.Request) string {
	c, _ := r.Context().Value(claimsKey).(auth.Claims)
	return c.Role
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
