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
	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// Deps are the API's collaborators.
type Deps struct {
	Verifier       *auth.Verifier
	Users          store.UserStore
	Conversations  store.ConversationStore
	Messages       store.MessageStore
	Messaging      *messaging.Service
	Presence       *presence.Service
	EnableDevToken bool
	CORSOrigins    string
}

type ctxKey string

const userIDKey ctxKey = "userID"

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
			r.Get("/conversations/{id}/messages", handleHistory(d))
			r.Post("/conversations/{id}/messages", handleRESTSend(d))
			r.Post("/conversations/{id}/read", handleMarkRead(d))
			r.Get("/users/online", handleOnline(d))
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
			ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func currentUser(r *http.Request) string {
	v, _ := r.Context().Value(userIDKey).(string)
	return v
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
