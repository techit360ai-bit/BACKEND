package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/channel"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func handleListChannels(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chans, err := d.ChannelStore.ListForUser(r.Context(), me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(chans))
		for _, c := range chans {
			out = append(out, map[string]any{"id": c.ID, "name": c.Name, "kind": c.Kind})
		}
		writeJSON(w, http.StatusOK, map[string]any{"channels": out})
	}
}

func handleChannelHistory(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		ok, err := d.ChannelStore.IsMember(r.Context(), chID, me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !ok {
			writeErr(w, http.StatusForbidden, "not a member")
			return
		}
		msgs, err := d.ChannelStore.MessagesByChannel(r.Context(), chID, r.URL.Query().Get("before"), 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(msgs))
		for _, m := range msgs {
			out = append(out, map[string]any{
				"id": m.ID, "channelId": m.ChannelID, "senderId": m.SenderID,
				"type": m.Type, "body": m.Body, "ts": m.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": out})
	}
}

func handleChannelSend(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		var body struct {
			ClientMsgID string `json:"clientMsgId"`
			Type        string `json:"type"`
			Body        string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ack, err := d.Channels.SendChannel(r.Context(), me, protocol.SendPayload{
			ChannelID: chID, ClientMsgID: body.ClientMsgID, Type: body.Type, Body: body.Body,
		})
		if err != nil {
			if errors.Is(err, channel.ErrNotMember) {
				writeErr(w, http.StatusForbidden, err.Error())
				return
			}
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"clientMsgId": ack.ClientMsgID, "msgId": ack.MsgID, "ts": ack.TS})
	}
}

func handleChannelRead(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		var body struct {
			MsgID string `json:"msgId"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.MsgID == "" {
			writeErr(w, http.StatusBadRequest, "msgId required")
			return
		}
		if err := d.ChannelStore.SetReadCursor(r.Context(), chID, me, body.MsgID); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
