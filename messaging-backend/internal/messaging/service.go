// Package messaging orchestrates direct-message send/deliver/receipt logic.
// It persists before acknowledging (durability), then routes delivery via the
// Router. It has no transport knowledge.
package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/mentions"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// ErrNotParticipant is returned when a sender is not part of the conversation.
var ErrNotParticipant = errors.New("not a participant")

// ErrMessageNotInConversation is returned when a referenced message does not
// belong to the conversation it is being acted on within.
var ErrMessageNotInConversation = errors.New("message not in conversation")
var ErrMessageRequestPending = errors.New("message request is pending")
var ErrMessageRequestDeclined = errors.New("message request was declined")
var ErrMutationUnsupported = errors.New("message mutation unsupported")

// Service handles DM messaging.
type Service struct {
	convos store.ConversationStore
	msgs   store.MessageStore
	router store.Router
	users  store.UserStore
	now    func() time.Time
}

// New constructs a messaging Service.
func New(c store.ConversationStore, m store.MessageStore, r store.Router) *Service {
	return &Service{convos: c, msgs: m, router: r, now: time.Now}
}
func (s *Service) SetUsers(users store.UserStore) { s.users = users }

// AckResult is returned to the sender after a durable write.
type AckResult struct {
	ClientMsgID string
	MsgID       string
	TS          string
}

// SendDM validates membership, persists the message (and a 'sent' receipt for the
// recipient) BEFORE returning the ack, then routes message.new to the recipient
// and a delivered receipt back to the sender if the recipient is connected.
// Idempotent on (convID, sender, clientMsgID).
func (s *Service) SendDM(ctx context.Context, senderID string, p protocol.SendPayload) (AckResult, error) {
	if p.ConvID == "" {
		return AckResult{}, errors.New("convId required")
	}
	ok, err := s.convos.IsParticipant(ctx, p.ConvID, senderID)
	if err != nil {
		return AckResult{}, err
	}
	if !ok {
		return AckResult{}, ErrNotParticipant
	}
	conversation, err := s.convos.Get(ctx, p.ConvID)
	if err != nil {
		return AckResult{}, err
	}
	if conversation.RequestStatus == "declined" {
		return AckResult{}, ErrMessageRequestDeclined
	}
	if conversation.RequestStatus == "pending" {
		if senderID != conversation.InitiatedBy {
			return AckResult{}, ErrMessageRequestPending
		}
		count, err := s.msgs.CountByConversationSender(ctx, p.ConvID, senderID)
		if err != nil {
			return AckResult{}, err
		}
		if count > 0 {
			return AckResult{}, ErrMessageRequestPending
		}
	}

	// dedup
	if p.ClientMsgID != "" {
		if existingID, found, err := s.msgs.ExistsByClientMsgID(ctx, p.ConvID, senderID, p.ClientMsgID); err != nil {
			return AckResult{}, err
		} else if found {
			return AckResult{ClientMsgID: p.ClientMsgID, MsgID: existingID, TS: s.now().UTC().Format(time.RFC3339)}, nil
		}
	}

	parts, err := s.convos.Participants(ctx, p.ConvID)
	if err != nil {
		return AckResult{}, err
	}
	recipientID := ""
	for _, u := range parts {
		if u != senderID {
			recipientID = u
		}
	}
	if recipientID == "" {
		return AckResult{}, errors.New("no recipient in conversation")
	}

	msgType := p.Type
	if msgType == "" {
		msgType = "text"
	}
	m := store.Message{
		ID:             protocol.NewMsgID(),
		ConversationID: p.ConvID,
		SenderID:       senderID,
		Type:           msgType,
		Body:           p.Body,
		Mentions:       mentions.Resolve(ctx, s.users, p.Body),
		CreatedAt:      s.now().UTC(),
	}
	// PERSIST BEFORE ACK
	if err := s.msgs.InsertDM(ctx, m, recipientID, p.ClientMsgID); err != nil {
		return AckResult{}, fmt.Errorf("persist: %w", err)
	}
	ack := AckResult{ClientMsgID: p.ClientMsgID, MsgID: m.ID, TS: m.CreatedAt.Format(time.RFC3339)}

	// route message.new to recipient
	newEnv := mustEnvelope(protocol.TypeMessageNew, map[string]any{
		"id": m.ID, "convId": m.ConversationID, "senderId": senderID,
		"type": m.Type, "body": m.Body, "mentions": m.Mentions, "ts": ack.TS,
	})
	delivered, err := s.router.RouteToUser(ctx, recipientID, newEnv)
	if err != nil {
		return ack, nil // ack already valid; delivery is best-effort
	}
	if delivered {
		_ = s.msgs.SetReceipt(ctx, m.ID, recipientID, store.ReceiptDelivered)
		recEnv := mustEnvelope(protocol.TypeReceiptUpdate, map[string]any{
			"msgId": m.ID, "userId": recipientID, "state": string(store.ReceiptDelivered),
		})
		_, _ = s.router.RouteToUser(ctx, senderID, recEnv)
	}
	for _, mentionedID := range mentions.UserIDs(m.Mentions, senderID) {
		_, _ = s.router.RouteToUser(ctx, mentionedID, mustEnvelope(protocol.TypeMentionNew, map[string]any{"entityType": "message", "entityId": m.ID, "conversationId": m.ConversationID, "actorId": senderID, "mentions": m.Mentions}))
	}
	return ack, nil
}

// MarkRead advances the reader's cursor and notifies the original sender(s) with
// a read receipt.
func (s *Service) MarkRead(ctx context.Context, readerID string, p protocol.ReadUptoPayload) error {
	if p.ConvID == "" || p.MsgID == "" {
		return errors.New("convId and msgId required")
	}
	ok, err := s.convos.IsParticipant(ctx, p.ConvID, readerID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotParticipant
	}
	belongs, err := s.msgs.BelongsToConversation(ctx, p.MsgID, p.ConvID)
	if err != nil {
		return err
	}
	if !belongs {
		return ErrMessageNotInConversation
	}
	if err := s.convos.SetReadCursor(ctx, p.ConvID, readerID, p.MsgID); err != nil {
		return err
	}
	_ = s.msgs.SetReceipt(ctx, p.MsgID, readerID, store.ReceiptRead)
	parts, err := s.convos.Participants(ctx, p.ConvID)
	if err != nil {
		return err
	}
	recEnv := mustEnvelope(protocol.TypeReceiptUpdate, map[string]any{
		"msgId": p.MsgID, "userId": readerID, "state": string(store.ReceiptRead),
	})
	for _, u := range parts {
		if u != readerID {
			_, _ = s.router.RouteToUser(ctx, u, recEnv)
		}
	}
	return nil
}

func (s *Service) EditMessage(ctx context.Context, actorID, messageID, body string, expectedVersion int) (store.Message, error) {
	mutator, ok := s.msgs.(store.MessageMutationStore); if !ok { return store.Message{}, ErrMutationUnsupported }
	m, err := mutator.EditMessage(ctx, messageID, actorID, body, expectedVersion, s.now().UTC()); if err != nil { return store.Message{}, err }
	s.broadcastMutation(ctx, m, protocol.TypeMessageUpdated); return m, nil
}

func (s *Service) DeleteMessage(ctx context.Context, actorID, messageID string, expectedVersion int) (store.Message, error) {
	mutator, ok := s.msgs.(store.MessageMutationStore); if !ok { return store.Message{}, ErrMutationUnsupported }
	m, err := mutator.DeleteMessage(ctx, messageID, actorID, expectedVersion, s.now().UTC()); if err != nil { return store.Message{}, err }
	s.broadcastMutation(ctx, m, protocol.TypeMessageDeleted); return m, nil
}

func (s *Service) broadcastMutation(ctx context.Context, m store.Message, typ string) {
	if m.ConversationID == "" { return }; parts, err := s.convos.Participants(ctx, m.ConversationID); if err != nil { return }
	data := map[string]any{"id": m.ID, "convId": m.ConversationID, "senderId": m.SenderID, "body": m.Body, "type": m.Type, "ts": m.CreatedAt, "editedAt": m.EditedAt, "deletedAt": m.DeletedAt, "editVersion": m.EditVersion}
	for _, userID := range parts { _, _ = s.router.RouteToUser(ctx, userID, mustEnvelope(typ, data)) }
}

func mustEnvelope(t string, data map[string]any) protocol.Envelope {
	raw, _ := json.Marshal(data)
	return protocol.Envelope{Type: t, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
}
