package httpapi

import "net/http"

// handleDevToken mints a JWT for local development. Only mounted when
// EnableDevToken is true. NEVER enable in production.
func handleDevToken(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")
		if userID == "" {
			writeErr(w, http.StatusBadRequest, "userId required")
			return
		}
		name := r.URL.Query().Get("name")
		role := r.URL.Query().Get("role")
		tok, err := d.Verifier.Mint(userID, name, role)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"token": tok})
	}
}
