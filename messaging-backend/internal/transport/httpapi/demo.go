package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/demo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

func demoErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, demo.ErrEventNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, demo.ErrNotHost), errors.Is(err, demo.ErrNotParticipant), errors.Is(err, demo.ErrNotInvitee):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, demo.ErrInvalidField), errors.Is(err, demo.ErrBadTransition), errors.Is(err, demo.ErrNotEditable):
		writeErr(w, http.StatusBadRequest, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, err.Error())
	}
}

func eventJSON(e store.DemoEvent) map[string]any {
	return map[string]any{
		"id": e.ID, "hostId": e.HostID, "kind": e.Kind, "title": e.Title,
		"description": e.Description, "assetUrl": e.AssetURL, "assetType": e.AssetType,
		"status": e.Status, "scheduledAt": e.ScheduledAt, "createdAt": e.CreatedAt, "updatedAt": e.UpdatedAt,
	}
}

func rosterJSON(r store.RosterEntry) map[string]any {
	return map[string]any{
		"eventId": r.EventID, "userId": r.UserID, "roomRole": r.RoomRole, "status": r.Status,
	}
}

func handleCreateDemo(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Kind, Title, Description, AssetURL, AssetType string
			ScheduledAt                                   *time.Time `json:"scheduledAt"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ev, err := d.Demo.Create(r.Context(), currentUser(r), demo.CreateEventInput{
			Kind: body.Kind, Title: body.Title, Description: body.Description,
			AssetURL: body.AssetURL, AssetType: body.AssetType, ScheduledAt: body.ScheduledAt,
		})
		if err != nil {
			demoErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, eventJSON(ev))
	}
}

func handleListDemos(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		evs, err := d.Demo.ListEventsForUser(r.Context(), currentUser(r))
		if err != nil {
			demoErr(w, err)
			return
		}
		out := make([]map[string]any, 0, len(evs))
		for _, e := range evs {
			out = append(out, eventJSON(e))
		}
		writeJSON(w, http.StatusOK, map[string]any{"events": out})
	}
}

func handleGetDemo(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		ev, err := d.Demo.GetEvent(r.Context(), id, currentUser(r))
		if err != nil {
			demoErr(w, err)
			return
		}
		roster, err := d.Demo.ListRoster(r.Context(), id, currentUser(r))
		if err != nil {
			demoErr(w, err)
			return
		}
		rj := make([]map[string]any, 0, len(roster))
		for _, e := range roster {
			rj = append(rj, rosterJSON(e))
		}
		resp := eventJSON(ev)
		resp["roster"] = rj
		writeJSON(w, http.StatusOK, resp)
	}
}

func handleUpdateDemo(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title, Description, AssetURL, AssetType *string
			ScheduledAt                             *time.Time `json:"scheduledAt"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ev, err := d.Demo.UpdateEvent(r.Context(), chi.URLParam(r, "id"), currentUser(r), demo.PatchEventInput{
			Title: body.Title, Description: body.Description,
			AssetURL: body.AssetURL, AssetType: body.AssetType, ScheduledAt: body.ScheduledAt,
		})
		if err != nil {
			demoErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, eventJSON(ev))
	}
}

func handleDemoStatus(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Status string `json:"status"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Status == "" {
			writeErr(w, http.StatusBadRequest, "status required")
			return
		}
		ev, err := d.Demo.Transition(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Status)
		if err != nil {
			demoErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, eventJSON(ev))
	}
}

func handleDemoInvite(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			UserID   string `json:"userId"`
			RoomRole string `json:"roomRole"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		entry, err := d.Demo.Invite(r.Context(), chi.URLParam(r, "id"), currentUser(r), demo.InviteInput{
			UserID: body.UserID, RoomRole: body.RoomRole,
		})
		if err != nil {
			demoErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rosterJSON(entry))
	}
}

func handleDemoRespond(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Accept bool `json:"accept"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		entry, err := d.Demo.RespondInvite(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Accept)
		if err != nil {
			demoErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rosterJSON(entry))
	}
}
