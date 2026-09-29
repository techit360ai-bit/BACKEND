// Package httpapi is the REST surface: health, dev token, conversations, and
// presence. Authenticated routes require a Bearer JWT.
package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/auth"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/channel"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/demo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/discovery"
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
	Discovery      *discovery.Client
	// RateLimiter protects the messaging surface. A nil limiter is replaced by
	// the service default so a wiring mistake fails closed rather than open.
	RateLimiter *RateLimiter
}

type ctxKey string

const claimsKey ctxKey = "claims"

// NewRouter builds the chi router.
func NewRouter(d Deps) http.Handler {
	if d.RateLimiter == nil {
		d.RateLimiter = NewRateLimiter(120, 0)
	}
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(securityHeaders)
	r.Use(corsMiddleware(d.CORSOrigins))

	r.Get("/health", handleHealth)

	r.Route("/api/v1", func(r chi.Router) {
		// One bucket per caller address, mirroring the Node backend's global
		// limiter. /health stays outside this group so probes are never limited.
		r.Use(rateLimitMiddleware(d.RateLimiter, ClientIPKey))
		if d.EnableDevToken {
			r.Get("/dev/token", handleDevToken(d))
		}
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware(d.Verifier))
			r.Post("/conversations", handleCreateConversation(d))
			r.Get("/users/search", handleSearchUsers(d))
			r.Get("/conversations", handleListConversations(d))
			r.Get("/conversations/{id}/messages", handleHistory(d))
			r.Post("/conversations/{id}/messages", handleRESTSend(d))
			r.Patch("/conversations/{id}/messages/{messageId}", handleEditMessage(d))
			r.Delete("/conversations/{id}/messages/{messageId}", handleDeleteMessage(d))
			r.Post("/conversations/{id}/read", handleMarkRead(d))
			r.Post("/conversations/{id}/request/accept", handleMessageRequestStatus(d, "active"))
			r.Post("/conversations/{id}/request/decline", handleMessageRequestStatus(d, "declined"))
			r.Get("/users/online", handleOnline(d))

			r.Get("/channels", handleListChannels(d))
			r.Get("/channels/{id}/messages", handleChannelHistory(d))
			r.Post("/channels/{id}/messages", handleChannelSend(d))
			r.Patch("/channels/{id}/messages/{messageId}", handleChannelEdit(d))
			r.Delete("/channels/{id}/messages/{messageId}", handleChannelDelete(d))
			r.Post("/channels/{id}/read", handleChannelRead(d))

			r.Get("/posts", handleListPosts(d))
			r.Post("/posts", handleCreatePost(d))
			r.Patch("/posts/{id}", handleEditPost(d))
			r.Delete("/posts/{id}", handleDeletePost(d))
			r.Post("/posts/{id}/like", handleLikePost(d))
			r.Delete("/posts/{id}/like", handleUnlikePost(d))
			r.Post("/posts/{id}/save", handleSavePost(d))
			r.Delete("/posts/{id}/save", handleUnsavePost(d))
			r.Post("/posts/{id}/feedback", handlePostFeedback(d))
			r.Post("/feed/events", handleFeedEvent(d))
			r.Get("/feed/ranking/audit", handleRankingAudit(d))
			r.Get("/moderation/posts", handleModerationQueue(d))
			r.Post("/moderation/posts/{id}/review", handleModerationReview(d))
			r.Get("/feed/ranking/metrics", handleRankingMetrics(d))
			r.Put("/feed/discovery/profile", handleDiscoveryProfile(d))
			r.Get("/feed/modules", handleDiscoveryModules(d))
			r.Post("/users/{userId}/follow", handleFollowUser(d))
			r.Delete("/users/{userId}/follow", handleUnfollowUser(d))
			r.Post("/users/{userId}/mute", handleCreatorControl(d, "mute", true))
			r.Delete("/users/{userId}/mute", handleCreatorControl(d, "mute", false))
			r.Post("/users/{userId}/block", handleCreatorControl(d, "block", true))
			r.Delete("/users/{userId}/block", handleCreatorControl(d, "block", false))
			r.Get("/posts/{id}/comments", handleListComments(d))
			r.Post("/posts/{id}/comments", handleAddComment(d))
			r.Patch("/posts/{id}/comments/{commentId}", handleEditComment(d))
			r.Delete("/posts/{id}/comments/{commentId}", handleDeleteComment(d))

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
			fromCookie := false
			if token == h || token == "" {
				// Browser sessions carry the platform JWT in an HttpOnly cookie and
				// are sent with `credentials: include` rather than a bearer header.
				token = sessionCookieToken(r)
				fromCookie = token != ""
			}
			if token == "" {
				writeErr(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			if fromCookie && !csrfOK(r) {
				writeErr(w, http.StatusForbidden, "csrf_token_invalid")
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

const (
	sessionCookieName = "techit_access"
	csrfCookieName    = "techit_csrf"
)

// securityHeaders mirrors what the Node backend and ai-router already send, so
// the three browser-facing services agree. The WebSocket gateway is mounted
// outside this router and is covered by its own origin check.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		if os.Getenv("ENVIRONMENT") == "production" {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

func cookieValue(r *http.Request, name string) string {
	if c, err := r.Cookie(name); err == nil {
		return c.Value
	}
	return ""
}

func sessionCookieToken(r *http.Request) string { return cookieValue(r, sessionCookieName) }

func unsafeMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

// csrfOK enforces the double-submit token for cookie-authenticated mutations.
// Mirrors BACKEND src/middlewares/csrf.js: a bearer header is an explicit
// caller-supplied credential, but the cookie is ambient, so a state-changing
// request must also prove it originated from the application.
func csrfOK(r *http.Request) bool {
	if !unsafeMethod(r.Method) {
		return true
	}
	expected := cookieValue(r, csrfCookieName)
	supplied := r.Header.Get("X-CSRF-Token")
	if expected == "" || supplied == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(supplied)) == 1
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
func writeCodeErr(w http.ResponseWriter, code int, errorCode, message string) {
	writeJSON(w, code, map[string]string{"error": errorCode, "message": message})
}
