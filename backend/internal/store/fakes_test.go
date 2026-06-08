package store

import (
	"context"
	"testing"
)

func TestFakeConversationGetOrCreateDMStable(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c1, created1, err := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	if err != nil || !created1 {
		t.Fatalf("first create: created=%v err=%v", created1, err)
	}
	c2, created2, _ := f.Conversations.GetOrCreateDM(ctx, "u2", "u1") // order-insensitive
	if created2 {
		t.Error("second call should not create")
	}
	if c1.ID != c2.ID {
		t.Errorf("ids differ: %s vs %s", c1.ID, c2.ID)
	}
}

func TestFakeInsertDMAndQuery(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c, _, _ := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000001", ConversationID: c.ID, SenderID: "u1", Type: "text", Body: "hi"}
	if err := f.Messages.InsertDM(ctx, m, "u2", "client-1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := f.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi" {
		t.Fatalf("query: got=%v err=%v", got, err)
	}
}
