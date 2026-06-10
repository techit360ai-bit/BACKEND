//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func testDSN() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return "postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable"
}

func setup(t *testing.T) *Store {
	t.Helper()
	st, err := Open(context.Background(), testDSN())
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := st.MigrateAll(context.Background(), "../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

func TestPostgresDMRoundTrip(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	// users must exist (FK)
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	c, created, err := st.Conversations.GetOrCreateDM(ctx, uuidA, uuidB)
	if err != nil || !created {
		t.Fatalf("create dm: created=%v err=%v", created, err)
	}
	m := store.Message{ID: protocol.NewMsgID(), ConversationID: c.ID, SenderID: uuidA, Type: "text", Body: "hi"}
	if err := st.Messages.InsertDM(ctx, m, uuidB, "client-1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	// dedup
	id, found, err := st.Messages.ExistsByClientMsgID(ctx, c.ID, uuidA, "client-1")
	if err != nil || !found || id != m.ID {
		t.Fatalf("dedup lookup: id=%s found=%v err=%v", id, found, err)
	}
	got, err := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi" {
		t.Fatalf("query: %v err=%v", got, err)
	}
}

func TestGetOrCreateDMIdempotent(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	// Use a fresh user pair so this test is independent of others sharing the DB.
	const uuidC = "01890000-0000-7000-8000-0000000000cc"
	const uuidD = "01890000-0000-7000-8000-0000000000dd"
	_ = st.Users.Upsert(ctx, store.User{ID: uuidC, DisplayName: "C"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidD, DisplayName: "D"})

	c1, created1, err := st.Conversations.GetOrCreateDM(ctx, uuidC, uuidD)
	if err != nil || !created1 {
		t.Fatalf("first create: created=%v err=%v", created1, err)
	}
	// second call returns the same conversation, created=false
	c2, created2, err := st.Conversations.GetOrCreateDM(ctx, uuidC, uuidD)
	if err != nil || created2 || c2.ID != c1.ID {
		t.Fatalf("second call not idempotent: id=%s (want %s) created=%v err=%v", c2.ID, c1.ID, created2, err)
	}
	// order-insensitive: swapping args yields the same conversation
	c3, created3, err := st.Conversations.GetOrCreateDM(ctx, uuidD, uuidC)
	if err != nil || created3 || c3.ID != c1.ID {
		t.Fatalf("order-insensitive failed: id=%s (want %s) created=%v err=%v", c3.ID, c1.ID, created3, err)
	}
}

const (
	uuidA = "01890000-0000-7000-8000-0000000000aa"
	uuidB = "01890000-0000-7000-8000-0000000000bb"
)

func TestPostgresChannelMessage(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	chID := protocol.NewMsgID()
	if _, err := st.pool.Exec(ctx, `INSERT INTO channels (id, name) VALUES ($1,'hangout')`, chID); err != nil {
		t.Fatalf("seed channel: %v", err)
	}
	if _, err := st.pool.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1,$2)`, chID, uuidA); err != nil {
		t.Fatalf("seed member: %v", err)
	}
	ok, err := st.Channels.IsMember(ctx, chID, uuidA)
	if err != nil || !ok {
		t.Fatalf("IsMember: ok=%v err=%v", ok, err)
	}
	m := store.Message{ID: protocol.NewMsgID(), ChannelID: chID, SenderID: uuidA, Type: "text", Body: "hi chan"}
	if err := st.Channels.InsertChannelMessage(ctx, m, "cc1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := st.Channels.MessagesByChannel(ctx, chID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi chan" {
		t.Fatalf("query: %v err=%v", got, err)
	}
	// dedup backstop (migration 0003): a second insert with the same
	// (channel_id, sender_id, client_msg_id) must be rejected by the unique index.
	dup := store.Message{ID: protocol.NewMsgID(), ChannelID: chID, SenderID: uuidA, Type: "text", Body: "dup"}
	if err := st.Channels.InsertChannelMessage(ctx, dup, "cc1"); err == nil {
		t.Fatal("expected unique-violation on duplicate channel client_msg_id")
	}
}

func TestPostgresPostLifecycle(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	pid := protocol.NewMsgID()
	if err := st.Posts.CreatePost(ctx, store.Post{ID: pid, AuthorID: uuidA, Kind: "update", Body: "hello feed"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	_ = st.Posts.Like(ctx, pid, uuidB)
	_ = st.Posts.Like(ctx, pid, uuidB)
	n, _ := st.Posts.LikeCount(ctx, pid)
	if n != 1 {
		t.Fatalf("like count = %d, want 1", n)
	}
	cid := protocol.NewMsgID()
	if err := st.Posts.AddComment(ctx, store.Comment{ID: cid, PostID: pid, AuthorID: uuidB, Body: "nice"}); err != nil {
		t.Fatalf("comment: %v", err)
	}
	cs, _ := st.Posts.ListComments(ctx, pid)
	if len(cs) != 1 {
		t.Fatalf("comments: %v", cs)
	}
}

func TestPostgresListPostsByZone(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	// isolate from other tests that may have inserted posts
	if _, err := st.pool.Exec(ctx, `TRUNCATE posts CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	_ = st.Posts.CreatePost(ctx, store.Post{ID: protocol.NewMsgID(), AuthorID: uuidA, AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "f"})
	_ = st.Posts.CreatePost(ctx, store.Post{ID: protocol.NewMsgID(), AuthorID: uuidB, AuthorRole: "organisation", Audience: []string{"collaborator"}, Kind: "opportunity", Body: "o"})
	tribe, err := st.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 50)
	if err != nil {
		t.Fatalf("zone query: %v", err)
	}
	if len(tribe) != 1 || tribe[0].Body != "o" {
		t.Fatalf("tribe wrong: %+v", tribe)
	}
	all, _ := st.Posts.ListPostsByZone(ctx, "collaborator", "global", "", 50)
	if len(all) != 2 {
		t.Fatalf("global want 2, got %d", len(all))
	}
}

func TestPostgresConversationSummaries(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "Alice"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "Bob"})
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, uuidA, uuidB)
	m := store.Message{ID: protocol.NewMsgID(), ConversationID: c.ID, SenderID: uuidB, Type: "text", Body: "hi alice"}
	if err := st.Messages.InsertDM(ctx, m, uuidA, "s1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	sums, err := st.Conversations.SummariesForUser(ctx, uuidA)
	if err != nil {
		t.Fatalf("summaries: %v", err)
	}
	if len(sums) != 1 {
		t.Fatalf("want 1, got %d", len(sums))
	}
	s := sums[0]
	if s.OtherUserID != uuidB || s.OtherName != "Bob" || s.LastBody != "hi alice" || s.Unread != 1 {
		t.Fatalf("bad summary: %+v", s)
	}
}
