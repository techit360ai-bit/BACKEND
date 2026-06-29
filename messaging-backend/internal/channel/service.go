// Package channel orchestrates group/Hangout channel messaging: membership-gated
// send with persist-before-ack and fan-out to other members, plus typing relay.
package channel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// ErrNotMember is returned when a user is not a member of the channel.
var ErrNotMember = errors.New("not a channel member")

// Service handles channel messaging.
type Service struct {
	chans  store.ChannelStore
	router store.Router
	now    func() time.Time
}

// New constructs a channel Service.
func New(c store.ChannelStore, r store.Router) *Service {
	return &Service{chans: c, router: r, now: time.Now}
}

// AckResult is returned to the sender after a durable write.
type AckResult struct {
	ClientMsgID string
	MsgID       string
	TS          string
}

// SendChannel validates membership, persists the message BEFORE acking, then
// fans out message.new to every other member. Idempotent on
// (channelID, sender, clientMsgID).
func (s *Service) SendChannel(ctx context.Context, senderID string, p protocol.SendPayload) (AckResult, error) {
	if p.ChannelID == "" {
		return AckResult{}, errors.New("channelId required")
	}
	member, err := s.chans.IsMember(ctx, p.ChannelID, senderID)
	if err != nil {
		return AckResult{}, err
	}
	if !member {
		return AckResult{}, ErrNotMember
	}

	if p.ClientMsgID != "" {
		if id, found, err := s.chans.ExistsByClientMsgID(ctx, p.ChannelID, senderID, p.ClientMsgID); err != nil {
			return AckResult{}, err
		} else if found {
			return AckResult{ClientMsgID: p.ClientMsgID, MsgID: id, TS: s.now().UTC().Format(time.RFC3339)}, nil
		}
	}

	msgType := p.Type
	if msgType == "" {
		msgType = "text"
	}
	m := store.Message{
		ID:        protocol.NewMsgID(),
		ChannelID: p.ChannelID,
		SenderID:  senderID,
		Type:      msgType,
		Body:      p.Body,
		CreatedAt: s.now().UTC(),
	}
	if err := s.chans.InsertChannelMessage(ctx, m, p.ClientMsgID); err != nil {
		return AckResult{}, fmt.Errorf("persist: %w", err)
	}
	ack := AckResult{ClientMsgID: p.ClientMsgID, MsgID: m.ID, TS: m.CreatedAt.Format(time.RFC3339)}

	members, err := s.chans.Members(ctx, p.ChannelID)
	if err != nil {
		return ack, nil // ack already durable; fan-out is best-effort
	}
	env := mustEnvelope(protocol.TypeMessageNew, map[string]any{
		"id": m.ID, "channelId": m.ChannelID, "senderId": senderID,
		"type": m.Type, "body": m.Body, "ts": ack.TS,
	})
	for _, u := range members {
		if u != senderID {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
	return ack, nil
}

// RelayTyping broadcasts an ephemeral typing indicator to other channel members.
func (s *Service) RelayTyping(ctx context.Context, fromUser, channelID string, isTyping bool) error {
	member, err := s.chans.IsMember(ctx, channelID, fromUser)
	if err != nil {
		return err
	}
	if !member {
		return ErrNotMember
	}
	members, err := s.chans.Members(ctx, channelID)
	if err != nil {
		return err
	}
	env := mustEnvelope(protocol.TypeTypingIndicator, map[string]any{
		"channelId": channelID, "userId": fromUser, "isTyping": isTyping,
	})
	for _, u := range members {
		if u != fromUser {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
	return nil
}

func mustEnvelope(t string, data map[string]any) protocol.Envelope {
	raw, _ := json.Marshal(data)
	return protocol.Envelope{Type: t, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
}
