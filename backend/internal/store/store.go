// Package store defines domain models and persistence interfaces for the
// messaging service. Services depend on these interfaces, not concrete DBs.
package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// ErrNotFound is returned by stores when a row does not exist.
var ErrNotFound = errors.New("not found")

// KnownRoles is the closed set of viewer/author roles.
var KnownRoles = map[string]bool{
	"founder": true, "collaborator": true, "investor": true,
	"organisation": true, "community": true,
}

// NormalizeRole lowercases a role and maps anything unknown/empty to "community".
func NormalizeRole(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	if KnownRoles[r] {
		return r
	}
	return "community"
}

// SanitizeAudience keeps only known roles plus "all"; empty -> {"all"}.
func SanitizeAudience(aud []string) []string {
	out := make([]string, 0, len(aud))
	for _, a := range aud {
		la := strings.ToLower(strings.TrimSpace(a))
		if la == "all" || KnownRoles[la] {
			out = append(out, la)
		}
	}
	if len(out) == 0 {
		return []string{"all"}
	}
	return out
}

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

// ConvSummary is a read-model row for the DM list: the other participant, the
// last message, and the unread count for the requesting user.
type ConvSummary struct {
	ConversationID string
	OtherUserID    string
	OtherName      string
	LastBody       string
	LastTS         time.Time
	LastMsgID      string
	Unread         int
}

// Channel is a group/Hangout channel.
type Channel struct {
	ID        string
	Name      string
	Kind      string // hangout|workspace
	CreatedAt time.Time
}

// Post is a social-feed post.
type Post struct {
	ID         string
	AuthorID   string
	AuthorRole string
	Audience   []string
	Kind       string
	Body       string
	CreatedAt  time.Time
}

// Comment is a comment on a Post.
type Comment struct {
	ID        string
	PostID    string
	AuthorID  string
	Body      string
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
	// SummariesForUser returns the DM list read-model for userID, newest first.
	SummariesForUser(ctx context.Context, userID string) ([]ConvSummary, error)
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
	// BelongsToConversation reports whether msgID is a message in convID.
	BelongsToConversation(ctx context.Context, msgID, convID string) (bool, error)
}

// ChannelStore manages group channels, membership, and read cursors.
type ChannelStore interface {
	// ListForUser returns channels the user is a member of.
	ListForUser(ctx context.Context, userID string) ([]Channel, error)
	// Members returns the user IDs in a channel.
	Members(ctx context.Context, channelID string) ([]string, error)
	// IsMember reports whether userID belongs to channelID.
	IsMember(ctx context.Context, channelID, userID string) (bool, error)
	// MessagesByChannel returns up to limit messages with id < before
	// (before == "" means latest), ordered by id DESC.
	MessagesByChannel(ctx context.Context, channelID, before string, limit int) ([]Message, error)
	// InsertChannelMessage stores a channel message (carrying clientMsgID for dedup).
	InsertChannelMessage(ctx context.Context, m Message, clientMsgID string) error
	// ExistsByClientMsgID reports an existing channel message id for dedup.
	ExistsByClientMsgID(ctx context.Context, channelID, senderID, clientMsgID string) (string, bool, error)
	// SetReadCursor advances last_read_msg_id for a member.
	SetReadCursor(ctx context.Context, channelID, userID, msgID string) error
}

// PostStore manages feed posts, likes, and comments.
type PostStore interface {
	CreatePost(ctx context.Context, p Post) error
	ListPosts(ctx context.Context, before string, limit int) ([]Post, error)
	// ListPostsByZone returns posts for a viewer role + zone, newest-first
	// (keyset id < before; before=="" means latest). zone "tribe" = author_role
	// matches viewer OR viewer in audience; any other zone = all posts.
	ListPostsByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]Post, error)
	Like(ctx context.Context, postID, userID string) error
	Unlike(ctx context.Context, postID, userID string) error
	LikeCount(ctx context.Context, postID string) (int, error)
	AddComment(ctx context.Context, c Comment) error
	ListComments(ctx context.Context, postID string) ([]Comment, error)
	PostExists(ctx context.Context, postID string) (bool, error)
}

// Router delivers a server->client envelope to a user's live connections.
// Implemented by the hub in Plan 2; the messaging service depends only on this.
type Router interface {
	// RouteToUser delivers data to all of userID's connections (local + remote).
	// Returns true if at least one local connection received it.
	RouteToUser(ctx context.Context, userID string, env protocol.Envelope) (bool, error)
}
