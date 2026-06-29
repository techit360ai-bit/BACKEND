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

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// ErrNotParticipant is returned when a sender is not part of the conversation.
var ErrNotParticipant = errors.New("not a participant")

// ErrMessageNotInConversation is returned when a referenced message does not
// belong to the conversation it is being acted on within.
var ErrMessageNotInConversation = errors.New("message not in conversation")

// Service handles DM messaging.
type Service struct {
	convos store.ConversationStore
	msgs   store.MessageStore
	router store.Router
	now    func() time.Time
}

// New constructs a messaging Service.
func New(c store.ConversationStore, m store.MessageStore, r store.Router) *Service {
	return &Service{convos: c, msgs: m, router: r, now: time.Now}
}

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
		"type": m.Type, "body": m.Body, "ts": ack.TS,
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

func mustEnvelope(t string, data map[string]any) protocol.Envelope {
	raw, _ := json.Marshal(data)
	return protocol.Envelope{Type: t, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
}
