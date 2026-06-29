//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
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

func TestPostgresDemoLifecycle(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	now := time.Now().UTC()
	// Unique ids per run so the shared DB doesn't accumulate cross-run rows.
	uniq := protocol.NewMsgID()
	host := "host-" + uniq
	invitee := "inv-" + uniq
	ev := store.DemoEvent{
		ID: uniq, HostID: host, Kind: "startup", Title: "Launch",
		Description: "demo", Status: "draft", CreatedAt: now, UpdatedAt: now,
	}
	if err := st.Demo.CreateEvent(ctx, ev); err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := st.Demo.GetEvent(ctx, ev.ID)
	if err != nil || got.Title != "Launch" || got.Status != "draft" {
		t.Fatalf("get: %+v err=%v", got, err)
	}
	for _, r := range []store.RosterEntry{
		{EventID: ev.ID, UserID: host, RoomRole: "host", Status: "accepted", CreatedAt: now, UpdatedAt: now},
		{EventID: ev.ID, UserID: invitee, RoomRole: "judge", Status: "invited", CreatedAt: now, UpdatedAt: now},
	} {
		if err := st.Demo.UpsertRoster(ctx, r); err != nil {
			t.Fatalf("upsert roster %s: %v", r.UserID, err)
		}
	}
	roster, err := st.Demo.ListRoster(ctx, ev.ID)
	if err != nil || len(roster) != 2 {
		t.Fatalf("list roster: n=%d err=%v", len(roster), err)
	}
	forUser, err := st.Demo.ListEventsForUser(ctx, invitee)
	if err != nil || len(forUser) != 1 || forUser[0].ID != ev.ID {
		t.Fatalf("events for invitee: %+v err=%v", forUser, err)
	}
	ev.Status = "scheduled"
	ev.UpdatedAt = time.Now().UTC()
	if err := st.Demo.UpdateEvent(ctx, ev); err != nil {
		t.Fatalf("update: %v", err)
	}
	got2, err := st.Demo.GetEvent(ctx, ev.ID)
	if err != nil || got2.Status != "scheduled" {
		t.Fatalf("get after update: %+v err=%v", got2, err)
	}
}

func TestPostgresQARoundTrip(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	now := time.Now().UTC()
	// unique ids per run (shared DB persists rows across runs)
	suffix := now.Format("150405.000000")
	ev := store.DemoEvent{ID: "qa-ev-" + suffix, HostID: "h-" + suffix, Kind: "startup", Title: "T", Status: "live", CreatedAt: now, UpdatedAt: now}
	if err := st.Demo.CreateEvent(ctx, ev); err != nil {
		t.Fatalf("create event: %v", err)
	}
	q := store.DemoQuestion{ID: "qa-q-" + suffix, EventID: ev.ID, AskerID: "u-" + suffix, Body: "why?", State: "open", CreatedAt: now, UpdatedAt: now}
	if err := st.QA.CreateQuestion(ctx, q); err != nil {
		t.Fatalf("create question: %v", err)
	}

	// vote dedup via PK
	if ins, _ := st.QA.AddVote(ctx, q.ID, "voter-"+suffix); !ins {
		t.Fatal("first AddVote should insert")
	}
	if ins, _ := st.QA.AddVote(ctx, q.ID, "voter-"+suffix); ins {
		t.Fatal("duplicate AddVote should be a no-op (PK conflict)")
	}
	if n, _ := st.QA.CountVotes(ctx, q.ID); n != 1 {
		t.Fatalf("count=%d want 1", n)
	}

	// list view reflects votes + mine
	views, err := st.QA.ListQuestions(ctx, ev.ID, "voter-"+suffix)
	if err != nil || len(views) != 1 || views[0].Votes != 1 || !views[0].Mine {
		t.Fatalf("list: err=%v %+v", err, views)
	}

	// remove + state transition
	if del, _ := st.QA.RemoveVote(ctx, q.ID, "voter-"+suffix); !del {
		t.Fatal("RemoveVote should delete")
	}
	if err := st.QA.SetQuestionState(ctx, q.ID, "dismissed"); err != nil {
		t.Fatalf("set state: %v", err)
	}
	got, _ := st.QA.GetQuestion(ctx, q.ID)
	if got.State != "dismissed" {
		t.Fatalf("state=%s", got.State)
	}
}
