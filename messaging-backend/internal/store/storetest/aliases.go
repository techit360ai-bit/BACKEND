// Package storetest contains the in-memory store doubles used only by tests.
//
// The doubles used to live in the production `store` package, which meant every
// binary that imported `store` also compiled them in even though nothing in
// production constructs them (the server is Postgres-only). They are isolated
// here so `go build ./...` links no in-memory store and only `go test ./...`
// pulls them in.
package storetest

import "github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"

// Type aliases let the doubles below be written against the real store types
// without qualifying every reference.
type (
	User             = store.User
	Conversation     = store.Conversation
	Message          = store.Message
	Channel          = store.Channel
	Post             = store.Post
	Comment          = store.Comment
	ReceiptState     = store.ReceiptState
	DiscoveryProfile = store.DiscoveryProfile
	ConvSummary      = store.ConvSummary
	FeedEvent        = store.FeedEvent
	RosterEntry      = store.RosterEntry
	DemoEvent        = store.DemoEvent
	DemoQuestion     = store.DemoQuestion
	QuestionView     = store.QuestionView
	RankingDecision  = store.RankingDecision
	RankingMetrics   = store.RankingMetrics
	UserStore        = store.UserStore
	ConversationStore = store.ConversationStore
	MessageStore     = store.MessageStore
	ChannelStore     = store.ChannelStore
	PostStore        = store.PostStore
	DemoStore        = store.DemoStore
	QAStore          = store.QAStore
	Router           = store.Router
)

// ErrNotFound mirrors store.ErrNotFound so the doubles return the same sentinel.
var ErrNotFound = store.ErrNotFound

// Receipt constants used by the doubles.
const (
	ReceiptSent      = store.ReceiptSent
	ReceiptDelivered = store.ReceiptDelivered
	ReceiptRead      = store.ReceiptRead
)

// Helpers used by the doubles' tests.
var (
	KnownDemoKind         = store.KnownDemoKind
	NormalizeRole         = store.NormalizeRole
	AllowedDemoTransition = store.AllowedDemoTransition
)
