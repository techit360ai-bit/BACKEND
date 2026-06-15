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
	Channels      *FakeChannelStore
	Posts         *FakePostStore
	Demo          *FakeDemoStore
	QA            *FakeQAStore
}

func NewFakeStores() *FakeStores {
	st := &FakeStores{
		Users:         &FakeUserStore{m: map[string]User{}},
		Conversations: &FakeConversationStore{convos: map[string][2]string{}, cursors: map[string]string{}},
		Messages:      &FakeMessageStore{byConv: map[string][]Message{}, receipts: map[string]ReceiptState{}, clientIDs: map[string]string{}},
		Channels:      &FakeChannelStore{members: map[string]map[string]struct{}{}, byChan: map[string][]Message{}, clientIDs: map[string]string{}, cursors: map[string]string{}},
		Posts:         &FakePostStore{posts: map[string]Post{}, order: nil, likes: map[string]map[string]struct{}{}, comments: map[string][]Comment{}},
		Demo:          &FakeDemoStore{events: map[string]DemoEvent{}, roster: map[string][]RosterEntry{}},
		QA:            &FakeQAStore{questions: map[string]DemoQuestion{}, order: nil, votes: map[string]map[string]struct{}{}},
	}
	st.Conversations.msgs = st.Messages
	st.Conversations.users = st.Users
	return st
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
	msgs    *FakeMessageStore
	users   *FakeUserStore
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

func (s *FakeConversationStore) SummariesForUser(ctx context.Context, userID string) ([]ConvSummary, error) {
	ids, _ := s.ListForUser(ctx, userID)
	out := make([]ConvSummary, 0, len(ids))
	for _, convID := range ids {
		parts, _ := s.Participants(ctx, convID)
		other := ""
		for _, u := range parts {
			if u != userID {
				other = u
			}
		}
		msgs, _ := s.msgs.MessagesByConversation(ctx, convID, "", 1) // newest first
		var sum ConvSummary
		sum.ConversationID = convID
		sum.OtherUserID = other
		if s.users != nil {
			if u, err := s.users.Get(ctx, other); err == nil {
				sum.OtherName = u.DisplayName
			}
		}
		if len(msgs) > 0 {
			sum.LastBody = msgs[0].Body
			sum.LastTS = msgs[0].CreatedAt
			sum.LastMsgID = msgs[0].ID
		}
		// unread = messages strictly after the user's read cursor
		cursor := s.cursors[convID+"|"+userID]
		all, _ := s.msgs.MessagesByConversation(ctx, convID, "", 1000)
		for _, m := range all {
			if m.SenderID != userID && (cursor == "" || m.ID > cursor) {
				sum.Unread++
			}
		}
		out = append(out, sum)
	}
	return out, nil
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

// FakeChannelStore is an in-memory ChannelStore.
type FakeChannelStore struct {
	mu        sync.Mutex
	members   map[string]map[string]struct{} // channelID -> set of userIDs
	byChan    map[string][]Message
	clientIDs map[string]string // channelID|sender|clientMsgID -> msgID
	cursors   map[string]string // channelID|userID -> msgID
}

// AddMember is a test helper to seed membership.
func (s *FakeChannelStore) AddMember(channelID, userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.members[channelID] == nil {
		s.members[channelID] = map[string]struct{}{}
	}
	s.members[channelID][userID] = struct{}{}
}

func (s *FakeChannelStore) ListForUser(_ context.Context, userID string) ([]Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Channel
	for ch, set := range s.members {
		if _, ok := set[userID]; ok {
			out = append(out, Channel{ID: ch, Name: ch, Kind: "hangout"})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}
func (s *FakeChannelStore) Members(_ context.Context, channelID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for u := range s.members[channelID] {
		out = append(out, u)
	}
	sort.Strings(out)
	return out, nil
}
func (s *FakeChannelStore) IsMember(_ context.Context, channelID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.members[channelID][userID]
	return ok, nil
}
func (s *FakeChannelStore) MessagesByChannel(_ context.Context, channelID, before string, limit int) ([]Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := s.byChan[channelID]
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
func (s *FakeChannelStore) InsertChannelMessage(_ context.Context, m Message, clientMsgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byChan[m.ChannelID] = append(s.byChan[m.ChannelID], m)
	if clientMsgID != "" {
		s.clientIDs[m.ChannelID+"|"+m.SenderID+"|"+clientMsgID] = m.ID
	}
	return nil
}
func (s *FakeChannelStore) ExistsByClientMsgID(_ context.Context, channelID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.clientIDs[channelID+"|"+senderID+"|"+clientMsgID]; ok {
		return id, true, nil
	}
	return "", false, nil
}
func (s *FakeChannelStore) SetReadCursor(_ context.Context, channelID, userID, msgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cursors[channelID+"|"+userID] = msgID
	return nil
}

// FakePostStore is an in-memory PostStore.
type FakePostStore struct {
	mu       sync.Mutex
	posts    map[string]Post
	order    []string // post IDs in creation order
	likes    map[string]map[string]struct{}
	comments map[string][]Comment
}

func (s *FakePostStore) CreatePost(_ context.Context, p Post) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.posts[p.ID] = p
	s.order = append(s.order, p.ID)
	return nil
}
func (s *FakePostStore) ListPosts(_ context.Context, before string, limit int) ([]Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Post, 0, limit)
	for i := len(s.order) - 1; i >= 0; i-- {
		id := s.order[i]
		if before != "" && id >= before {
			continue
		}
		out = append(out, s.posts[id])
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
func (s *FakePostStore) ListPostsByZone(_ context.Context, viewerRole, zone, before string, limit int) ([]Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	matchTribe := func(p Post) bool {
		if p.AuthorRole == viewerRole {
			return true
		}
		for _, a := range p.Audience {
			if a == viewerRole {
				return true
			}
		}
		return false
	}
	out := make([]Post, 0, limit)
	for i := len(s.order) - 1; i >= 0; i-- {
		id := s.order[i]
		if before != "" && id >= before {
			continue
		}
		p := s.posts[id]
		if zone == "tribe" && !matchTribe(p) {
			continue
		}
		out = append(out, p)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
func (s *FakePostStore) Like(_ context.Context, postID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.likes[postID] == nil {
		s.likes[postID] = map[string]struct{}{}
	}
	s.likes[postID][userID] = struct{}{}
	return nil
}
func (s *FakePostStore) Unlike(_ context.Context, postID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.likes[postID], userID)
	return nil
}
func (s *FakePostStore) LikeCount(_ context.Context, postID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.likes[postID]), nil
}
func (s *FakePostStore) AddComment(_ context.Context, c Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.comments[c.PostID] = append(s.comments[c.PostID], c)
	return nil
}
func (s *FakePostStore) ListComments(_ context.Context, postID string) ([]Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Comment(nil), s.comments[postID]...), nil
}
func (s *FakePostStore) PostExists(_ context.Context, postID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.posts[postID]
	return ok, nil
}

var (
	_ ChannelStore = (*FakeChannelStore)(nil)
	_ PostStore    = (*FakePostStore)(nil)
)
