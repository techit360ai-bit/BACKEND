package httpapi

import (
	"net/http"
	"strings"
)

// corsMiddleware answers cross-origin requests from the configured allow-list.
// The SPA authenticates with the ambient HttpOnly cookie, so credentials are
// allowed and the response echoes the exact request origin: a literal `*` is
// never emitted, because a wildcard cannot carry credentials and would authorise
// every site. Wildcard configuration is only reachable in development —
// config.Load rejects it outside development and test — and is treated there as
// "allow any origin", still echoing the origin rather than `*`.
func corsMiddleware(origins string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	wildcard := false
	for _, origin := range strings.Split(origins, ",") {
		origin = strings.TrimSpace(strings.TrimRight(origin, "/"))
		switch {
		case origin == "":
		case origin == "*":
			wildcard = true
		default:
			allowed[origin] = true
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimRight(r.Header.Get("Origin"), "/")
			permitted := false
			if origin != "" {
				permitted = wildcard || allowed[origin]
				h := w.Header()
				h.Add("Vary", "Origin")
				if permitted {
					h.Set("Access-Control-Allow-Origin", origin)
					h.Set("Access-Control-Allow-Credentials", "true")
				}
			}
			if r.Method == http.MethodOptions {
				// Preflight: answer here so chi never sees an unrouted OPTIONS.
				if permitted {
					h := w.Header()
					h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-CSRF-Token")
					h.Set("Access-Control-Max-Age", "600")
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
