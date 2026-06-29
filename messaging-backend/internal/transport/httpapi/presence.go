package httpapi

import "net/http"

func handleOnline(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ids, err := d.Presence.ListOnline(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"online": ids})
	}
}
