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
	if err := st.Migrate(context.Background(), "../migrations/0001_init.sql"); err != nil {
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

const (
	uuidA = "01890000-0000-7000-8000-0000000000aa"
	uuidB = "01890000-0000-7000-8000-0000000000bb"
)
