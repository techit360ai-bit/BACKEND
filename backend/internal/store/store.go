// Package store defines domain models and persistence interfaces for the
// messaging service. Services depend on these interfaces, not concrete DBs.
package store

import (
	"context"
	"errors"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// ErrNotFound is returned by stores when a row does not exist.
var ErrNotFound = errors.New("not found")

// User is the minimal identity record, upserted from JWT claims on first connect.
type User struct {
	ID          string
	DisplayName string
	AvatarURL   string
	Role        string
	CreatedAt   time.Time
}

// Message is a DM or channel message. Exactly one of ConversationID / ChannelID
// is set. Body is opaque (plaintext in Phase 1, ciphertext when E2EE lands).
type Message struct {
	ID             string
	ConversationID string // empty for channel messages
	ChannelID      string // empty for DM messages
	SenderID       string
	Type           string
	Body           string
	CreatedAt      time.Time
}

// ReceiptState enumerates per-recipient DM delivery states.
type ReceiptState string

const (
	ReceiptSent      ReceiptState = "sent"
	ReceiptDelivered ReceiptState = "delivered"
	ReceiptRead      ReceiptState = "read"
)

// Conversation is a 1:1 DM (exactly two participants in Phase 1).
type Conversation struct {
	ID        string
	CreatedAt time.Time
}

// UserStore upserts and reads users.
type UserStore interface {
	Upsert(ctx context.Context, u User) error
	Get(ctx context.Context, id string) (User, error)
}

// ConversationStore manages 1:1 conversations and read cursors.
type ConversationStore interface {
	// GetOrCreateDM returns the existing conversation between the two users or
	// creates one. The returned bool is true if newly created.
	GetOrCreateDM(ctx context.Context, userA, userB string) (Conversation, bool, error)
	// Participants returns the user IDs in a conversation.
	Participants(ctx context.Context, convID string) ([]string, error)
	// IsParticipant reports whether userID belongs to convID.
	IsParticipant(ctx context.Context, convID, userID string) (bool, error)
	// ListForUser returns conversation IDs the user participates in.
	ListForUser(ctx context.Context, userID string) ([]string, error)
	// SetReadCursor advances last_read_msg_id for a participant.
	SetReadCursor(ctx context.Context, convID, userID, msgID string) error
}

// MessageStore persists and reads messages and DM receipts.
type MessageStore interface {
	// InsertDM stores a DM message (carrying its clientMsgID for dedup) and
	// creates a 'sent' receipt for recipientID, atomically. clientMsgID may be "".
	InsertDM(ctx context.Context, m Message, recipientID, clientMsgID string) error
	// SetReceipt upserts the receipt state for (msgID, userID).
	SetReceipt(ctx context.Context, msgID, userID string, state ReceiptState) error
	// MessagesByConversation returns up to limit messages with id < before
	// (before == "" means latest), ordered by id DESC.
	MessagesByConversation(ctx context.Context, convID, before string, limit int) ([]Message, error)
	// ExistsByClientMsgID reports whether a message from senderID in convID with
	// the given clientMsgID already exists (idempotency/dedup).
	ExistsByClientMsgID(ctx context.Context, convID, senderID, clientMsgID string) (string, bool, error)
}

// Router delivers a server->client envelope to a user's live connections.
// Implemented by the hub in Plan 2; the messaging service depends only on this.
type Router interface {
	// RouteToUser delivers data to all of userID's connections (local + remote).
	// Returns true if at least one local connection received it.
	RouteToUser(ctx context.Context, userID string, env protocol.Envelope) (bool, error)
}
