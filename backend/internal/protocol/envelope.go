// Package protocol defines the WebSocket message envelope exchanged between
// clients and the messaging service. It has no infrastructure dependencies and
// is the contract the frontend codes against.
package protocol

import (
	"encoding/json"

	"github.com/google/uuid"
)

// Envelope is the single shape used in both directions over the WebSocket.
type Envelope struct {
	Type string          `json:"type"`
	ID   string          `json:"id"`
	TS   string          `json:"ts"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Client -> server message types.
const (
	TypeMessageSend = "message.send"
	TypeTypingStart = "typing.start"
	TypeTypingStop  = "typing.stop"
	TypeReadUpto    = "read.upto"
)

// Server -> client message types.
const (
	TypeMessageAck      = "message.ack"
	TypeMessageNew      = "message.new"
	TypeReceiptUpdate   = "receipt.update"
	TypeTypingIndicator = "typing.indicator"
	TypePresenceChanged = "presence.changed"
	TypeError           = "error"
	TypePostNew         = "post.new"
	TypePostLiked       = "post.liked"
	TypePostComment     = "post.comment"
)

// SendPayload is the data of a message.send envelope. Exactly one of ConvID or
// ChannelID is set.
type SendPayload struct {
	ConvID      string `json:"convId,omitempty"`
	ChannelID   string `json:"channelId,omitempty"`
	ClientMsgID string `json:"clientMsgId"`
	Type        string `json:"type"`
	Body        string `json:"body"`
}

// ReadUptoPayload advances a read cursor.
type ReadUptoPayload struct {
	ConvID    string `json:"convId,omitempty"`
	ChannelID string `json:"channelId,omitempty"`
	MsgID     string `json:"msgId"`
}

// CreatePostPayload is the body of a create-post request (REST).
type CreatePostPayload struct {
	Kind     string   `json:"kind"`
	Body     string   `json:"body"`
	Audience []string `json:"audience,omitempty"`
}

// CommentPayload is the body of an add-comment request (REST).
type CommentPayload struct {
	Body string `json:"body"`
}

// NewMsgID returns a UUIDv7 string. UUIDv7 is time-ordered, so lexical sort
// equals chronological order — used for message IDs and keyset pagination.
func NewMsgID() string {
	return uuid.Must(uuid.NewV7()).String()
}
