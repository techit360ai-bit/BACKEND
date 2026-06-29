package httpapi

import (
	"net/http"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// handleDevToken mints a JWT for local development and upserts the user so a
// dev/smoke identity exists in the DB. Only mounted when EnableDevToken is true.
// NEVER enable in production. userId must be a valid UUID (users.id is UUID).
func handleDevToken(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")
		if userID == "" {
			writeErr(w, http.StatusBadRequest, "userId required")
			return
		}
		name := r.URL.Query().Get("name")
		role := r.URL.Query().Get("role")
		if err := d.Users.Upsert(r.Context(), store.User{ID: userID, DisplayName: name, Role: role}); err != nil {
			writeErr(w, http.StatusBadRequest, "could not create dev user (userId must be a UUID): "+err.Error())
			return
		}
		tok, err := d.Verifier.Mint(userID, name, role)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"token": tok})
	}
}
