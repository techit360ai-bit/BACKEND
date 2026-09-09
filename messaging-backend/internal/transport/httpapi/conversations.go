package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/discovery"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

func identityUser(person discovery.Person) store.User {
	return store.User{ID: person.ID, DisplayName: person.Name, Username: person.Username, AvatarURL: person.AvatarURL, Role: person.Role, Verified: person.Verified, Subscriber: person.Subscriber, SubscriptionTier: person.SubscriptionLabel, CredibilityScore: person.CredibilityScore, IdentityPresent: true}
}
func identityJSON(user store.User) map[string]any {
	return map[string]any{"id": user.ID, "displayName": user.DisplayName, "username": user.Username, "avatarUrl": user.AvatarURL, "role": user.Role, "verified": user.Verified, "subscriber": user.Subscriber, "subscriptionLabel": func() any {
		if user.Subscriber {
			return "Subscriber"
		}
		return nil
	}(), "credibilityScore": user.CredibilityScore}
}

func dmRelationship(d Deps, r *http.Request, me string, user store.User, sharedContext bool) (string, error) {
	blocked, err := d.Feed.IsBlockedBetween(r.Context(), me, user.ID)
	if err != nil {
		return "", err
	}
	if blocked {
		return "unavailable", nil
	}
	forward, err := d.Feed.IsFollowing(r.Context(), me, user.ID)
	if err != nil {
		return "", err
	}
	reverse, err := d.Feed.IsFollowing(r.Context(), user.ID, me)
	if err != nil {
		return "", err
	}
	if (forward && reverse) || sharedContext {
		return "direct", nil
	}
	if user.Verified || user.Subscriber {
		return "request", nil
	}
	return "unavailable", nil
}

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
		body.UserID = strings.TrimSpace(body.UserID)
		if body.UserID == me {
			writeCodeErr(w, http.StatusBadRequest, "self_dm_not_allowed", "You cannot message yourself.")
			return
		}
		if existing, err := d.Conversations.FindDM(r.Context(), me, body.UserID); err == nil {
			blocked, blockErr := d.Feed.IsBlockedBetween(r.Context(), me, body.UserID)
			if blockErr != nil {
				writeErr(w, http.StatusInternalServerError, blockErr.Error())
				return
			}
			if blocked {
				writeCodeErr(w, http.StatusForbidden, "dm_blocked", "Messaging is unavailable for this user.")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": existing.ID, "requestStatus": existing.RequestStatus, "deliveryMode": func() string {
				if existing.RequestStatus == "pending" {
					return "request"
				}
				return "direct"
			}()})
			return
		} else if !errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}

		var recipient store.User
		sharedContext := false
		if d.Discovery != nil {
			person, err := d.Discovery.Person(r.Context(), r.Header.Get("Authorization"), body.UserID)
			if err == nil {
				recipient = identityUser(person)
				sharedContext = person.SharedContext
				_ = d.Users.Upsert(r.Context(), recipient)
			}
		}
		if recipient.ID == "" {
			var err error
			recipient, err = d.Users.Get(r.Context(), body.UserID)
			if err != nil {
				writeCodeErr(w, http.StatusNotFound, "dm_recipient_not_found", "Recipient not found.")
				return
			}
		}
		mode, err := dmRelationship(d, r, me, recipient, sharedContext)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if mode == "unavailable" {
			writeCodeErr(w, http.StatusForbidden, "dm_recipient_not_eligible", "Connect first, or choose a verified or subscribed member.")
			return
		}
		status := "active"
		if mode == "request" {
			status = "pending"
		}
		conv, _, err := d.Conversations.GetOrCreateDMRequest(r.Context(), me, body.UserID, me, status)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": conv.ID, "requestStatus": conv.RequestStatus, "deliveryMode": mode, "recipient": identityJSON(recipient)})
	}
}

func handleSearchUsers(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimPrefix(strings.TrimSpace(r.URL.Query().Get("q")), "@")
		if len(query) < 2 {
			writeJSON(w, http.StatusOK, map[string]any{"users": []any{}})
			return
		}
		limit := 20
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 50 {
				limit = n
			}
		}
		me := currentUser(r)
		shared := map[string]bool{}
		var users []store.User
		if d.Discovery != nil {
			if people, err := d.Discovery.SearchPeople(r.Context(), r.Header.Get("Authorization"), query, limit); err == nil {
				for _, person := range people {
					u := identityUser(person)
					if u.ID == "" || u.ID == me {
						continue
					}
					shared[u.ID] = person.SharedContext
					_ = d.Users.Upsert(r.Context(), u)
					users = append(users, u)
				}
			}
		}
		if len(users) == 0 {
			local, err := d.Users.Search(r.Context(), query, me, limit)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			users = local
		}
		out := make([]map[string]any, 0, len(users))
		for _, user := range users {
			mode, err := dmRelationship(d, r, me, user, shared[user.ID])
			if err != nil {
				continue
			}
			row := identityJSON(user)
			row["deliveryMode"] = mode
			row["canMessage"] = mode != "unavailable"
			row["sharedContext"] = shared[user.ID]
			out = append(out, row)
		}
		writeJSON(w, http.StatusOK, map[string]any{"users": out})
	}
}

func handleMessageRequestStatus(d Deps, status string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		id := chi.URLParam(r, "id")
		conversation, err := d.Conversations.Get(r.Context(), id)
		if err != nil {
			writeErr(w, http.StatusNotFound, "conversation not found")
			return
		}
		participant, err := d.Conversations.IsParticipant(r.Context(), id, me)
		if err != nil || !participant {
			writeErr(w, http.StatusForbidden, "not a participant")
			return
		}
		if conversation.RequestStatus != "pending" {
			writeCodeErr(w, http.StatusConflict, "message_request_not_pending", "This message request is no longer pending.")
			return
		}
		if conversation.InitiatedBy == me {
			writeCodeErr(w, http.StatusForbidden, "message_request_recipient_required", "Only the recipient can respond to this request.")
			return
		}
		if err := d.Conversations.SetRequestStatus(r.Context(), id, status); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "requestStatus": status})
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
				"type": m.Type, "body": func() string { if m.DeletedAt != nil { return "This message was deleted" }; return m.Body }(), "mentions": m.Mentions, "ts": m.CreatedAt, "editedAt": m.EditedAt, "deletedAt": m.DeletedAt, "editVersion": m.EditVersion,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": out})
	}
}

func handleEditMessage(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct { Body string `json:"body"`; ExpectedVersion int `json:"expectedVersion"` }
		if json.NewDecoder(r.Body).Decode(&body) != nil || strings.TrimSpace(body.Body) == "" { writeErr(w, http.StatusBadRequest, "body required"); return }
		belongs, err := d.Messages.BelongsToConversation(r.Context(), chi.URLParam(r, "messageId"), chi.URLParam(r, "id")); if err != nil || !belongs { writeErr(w, http.StatusNotFound, "message not found"); return }
		m, err := d.Messaging.EditMessage(r.Context(), currentUser(r), chi.URLParam(r, "messageId"), strings.TrimSpace(body.Body), body.ExpectedVersion)
		if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }
		writeJSON(w, http.StatusOK, map[string]any{"id": m.ID, "convId": m.ConversationID, "body": m.Body, "editedAt": m.EditedAt, "editVersion": m.EditVersion})
	}
}

func handleDeleteMessage(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct { ExpectedVersion int `json:"expectedVersion"` }; _ = json.NewDecoder(r.Body).Decode(&body)
		belongs, err := d.Messages.BelongsToConversation(r.Context(), chi.URLParam(r, "messageId"), chi.URLParam(r, "id")); if err != nil || !belongs { writeErr(w, http.StatusNotFound, "message not found"); return }
		m, err := d.Messaging.DeleteMessage(r.Context(), currentUser(r), chi.URLParam(r, "messageId"), body.ExpectedVersion)
		if err != nil { writeErr(w, mutationStatus(err), err.Error()); return }
		writeJSON(w, http.StatusOK, map[string]any{"id": m.ID, "convId": m.ConversationID, "deletedAt": m.DeletedAt, "editVersion": m.EditVersion})
	}
}

func mutationStatus(err error) int { if errors.Is(err, store.ErrNotFound) { return http.StatusNotFound }; if strings.Contains(err.Error(), "forbidden") { return http.StatusForbidden }; if strings.Contains(err.Error(), "conflict") { return http.StatusConflict }; if strings.Contains(err.Error(), "window") { return http.StatusForbidden }; if errors.Is(err, messaging.ErrMutationUnsupported) { return http.StatusNotImplemented }; return http.StatusBadRequest }

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
				"otherUsername": s.OtherUsername, "otherAvatarUrl": s.OtherAvatarURL, "otherRole": s.OtherRole, "otherVerified": s.OtherVerified, "otherSubscriber": s.OtherSubscriber, "otherCredibilityScore": s.OtherCredibilityScore,
				"requestStatus": s.RequestStatus, "initiatedBy": s.InitiatedBy, "lastBody": s.LastBody, "lastTs": s.LastTS, "lastMsgId": s.LastMsgID, "unread": s.Unread,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
	}
}
