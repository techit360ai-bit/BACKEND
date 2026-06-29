package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/livekit"
)

// grantForRole maps a demo room role to LiveKit publish permission.
// Host and presenter publish; judge and audience are view-only.
func grantForRole(roomRole string) livekit.Grant {
	return livekit.Grant{CanPublish: roomRole == "host" || roomRole == "presenter"}
}

func handleDemoRtcToken(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		id := chi.URLParam(r, "id")

		// authorize + load event (host or rostered participant)
		ev, err := d.Demo.GetEvent(r.Context(), id, me)
		if err != nil {
			demoErr(w, err)
			return
		}
		if ev.Status != "live" {
			writeErr(w, http.StatusBadRequest, "event is not live")
			return
		}
		if d.LiveKit == nil || !d.LiveKit.Enabled() {
			writeErr(w, http.StatusServiceUnavailable, "live video not configured")
			return
		}

		// determine room role: host, else the requester's roster role
		roomRole := "audience"
		if ev.HostID == me {
			roomRole = "host"
		} else {
			roster, err := d.Demo.ListRoster(r.Context(), id, me)
			if err != nil {
				demoErr(w, err)
				return
			}
			for _, e := range roster {
				if e.UserID == me {
					roomRole = e.RoomRole
					break
				}
			}
		}

		grant := grantForRole(roomRole)
		token, err := d.LiveKit.Token(id, me, grant)
		if err != nil {
			if errors.Is(err, livekit.ErrDisabled) {
				writeErr(w, http.StatusServiceUnavailable, "live video not configured")
				return
			}
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"token": token, "url": d.LiveKit.URL(), "room": id,
			"identity": me, "canPublish": grant.CanPublish,
		})
	}
}
