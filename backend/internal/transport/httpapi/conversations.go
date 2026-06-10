package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func handleCreateConversation(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		var body struct {
			UserID string `json:"userId"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.UserID == "" {
			writeErr(w, http.StatusBadRequest, "userId required")
			return
		}
		conv, _, err := d.Conversations.GetOrCreateDM(r.Context(), me, body.UserID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"id": conv.ID})
	}
}

func handleHistory(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		ok, err := d.Conversations.IsParticipant(r.Context(), convID, me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !ok {
			writeErr(w, http.StatusForbidden, "not a participant")
			return
		}
		before := r.URL.Query().Get("before")
		msgs, err := d.Messages.MessagesByConversation(r.Context(), convID, before, 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(msgs))
		for _, m := range msgs {
			out = append(out, map[string]any{
				"id": m.ID, "convId": m.ConversationID, "senderId": m.SenderID,
				"type": m.Type, "body": m.Body, "ts": m.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": out})
	}
}

func handleRESTSend(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		var body struct {
			ClientMsgID string `json:"clientMsgId"`
			Type        string `json:"type"`
			Body        string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ack, err := d.Messaging.SendDM(r.Context(), me, protocol.SendPayload{
			ConvID: convID, ClientMsgID: body.ClientMsgID, Type: body.Type, Body: body.Body,
		})
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"clientMsgId": ack.ClientMsgID, "msgId": ack.MsgID, "ts": ack.TS,
		})
	}
}

func handleMarkRead(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		var body struct {
			MsgID string `json:"msgId"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.MsgID == "" {
			writeErr(w, http.StatusBadRequest, "msgId required")
			return
		}
		if err := d.Messaging.MarkRead(r.Context(), me, protocol.ReadUptoPayload{ConvID: convID, MsgID: body.MsgID}); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func handleListConversations(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		sums, err := d.Conversations.SummariesForUser(r.Context(), me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(sums))
		for _, s := range sums {
			out = append(out, map[string]any{
				"id": s.ConversationID, "otherUserId": s.OtherUserID, "otherName": s.OtherName,
				"lastBody": s.LastBody, "lastTs": s.LastTS, "lastMsgId": s.LastMsgID, "unread": s.Unread,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
	}
}
