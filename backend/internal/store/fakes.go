package store

import (
	"context"
	"sort"
	"sync"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// FakeStores bundles in-memory implementations for unit tests.
type FakeStores struct {
	Users         *FakeUserStore
	Conversations *FakeConversationStore
	Messages      *FakeMessageStore
}

func NewFakeStores() *FakeStores {
	return &FakeStores{
		Users:         &FakeUserStore{m: map[string]User{}},
		Conversations: &FakeConversationStore{convos: map[string][2]string{}, cursors: map[string]string{}},
		Messages:      &FakeMessageStore{byConv: map[string][]Message{}, receipts: map[string]ReceiptState{}, clientIDs: map[string]string{}},
	}
}

type FakeUserStore struct {
	mu sync.Mutex
	m  map[string]User
}

func (s *FakeUserStore) Upsert(_ context.Context, u User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[u.ID] = u
	return nil
}
func (s *FakeUserStore) Get(_ context.Context, id string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.m[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

type FakeConversationStore struct {
	mu      sync.Mutex
	convos  map[string][2]string // convID -> sorted pair
	cursors map[string]string    // convID|userID -> msgID
	seq     int
}

func pairKey(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

func (s *FakeConversationStore) GetOrCreateDM(_ context.Context, a, b string) (Conversation, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lo, hi := pairKey(a, b)
	for id, p := range s.convos {
		if p[0] == lo && p[1] == hi {
			return Conversation{ID: id}, false, nil
		}
	}
	s.seq++
	id := "conv-" + string(rune('a'+s.seq))
	s.convos[id] = [2]string{lo, hi}
	return Conversation{ID: id}, true, nil
}
func (s *FakeConversationStore) Participants(_ context.Context, convID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.convos[convID]
	if !ok {
		return nil, ErrNotFound
	}
	return []string{p[0], p[1]}, nil
}
func (s *FakeConversationStore) IsParticipant(_ context.Context, convID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.convos[convID]
	if !ok {
		return false, nil
	}
	return p[0] == userID || p[1] == userID, nil
}
func (s *FakeConversationStore) ListForUser(_ context.Context, userID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for id, p := range s.convos {
		if p[0] == userID || p[1] == userID {
			out = append(out, id)
		}
	}
	sort.Strings(out)
	return out, nil
}
func (s *FakeConversationStore) SetReadCursor(_ context.Context, convID, userID, msgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cursors[convID+"|"+userID] = msgID
	return nil
}

type FakeMessageStore struct {
	mu        sync.Mutex
	byConv    map[string][]Message
	receipts  map[string]ReceiptState // msgID|userID -> state
	clientIDs map[string]string       // convID|sender|clientMsgID -> msgID
}

func (s *FakeMessageStore) InsertDM(_ context.Context, m Message, recipientID, clientMsgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byConv[m.ConversationID] = append(s.byConv[m.ConversationID], m)
	s.receipts[m.ID+"|"+recipientID] = ReceiptSent
	if clientMsgID != "" {
		s.clientIDs[m.ConversationID+"|"+m.SenderID+"|"+clientMsgID] = m.ID
	}
	return nil
}
func (s *FakeMessageStore) SetReceipt(_ context.Context, msgID, userID string, st ReceiptState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.receipts[msgID+"|"+userID] = st
	return nil
}
func (s *FakeMessageStore) MessagesByConversation(_ context.Context, convID, before string, limit int) ([]Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := s.byConv[convID]
	// return newest-first, applying before (id < before) filter
	out := make([]Message, 0, len(all))
	for i := len(all) - 1; i >= 0; i-- {
		if before != "" && all[i].ID >= before {
			continue
		}
		out = append(out, all[i])
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
func (s *FakeMessageStore) ExistsByClientMsgID(_ context.Context, convID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.clientIDs[convID+"|"+senderID+"|"+clientMsgID]; ok {
		return id, true, nil
	}
	return "", false, nil
}
func (s *FakeMessageStore) BelongsToConversation(_ context.Context, msgID, convID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, m := range s.byConv[convID] {
		if m.ID == msgID {
			return true, nil
		}
	}
	return false, nil
}

// FakeRouter records routed envelopes per user for assertions.
type FakeRouter struct {
	mu   sync.Mutex
	Sent map[string][]protocol.Envelope
	// LocalUsers are considered "connected locally"; RouteToUser returns true for them.
	LocalUsers map[string]bool
}

func NewFakeRouter() *FakeRouter {
	return &FakeRouter{Sent: map[string][]protocol.Envelope{}, LocalUsers: map[string]bool{}}
}
func (r *FakeRouter) RouteToUser(_ context.Context, userID string, env protocol.Envelope) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Sent[userID] = append(r.Sent[userID], env)
	return r.LocalUsers[userID], nil
}
