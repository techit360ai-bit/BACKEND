package storetest

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

func TestFakeChannelSendAndQuery(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	f.Channels.AddMember("ch1", "u1")
	f.Channels.AddMember("ch1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000010", ChannelID: "ch1", SenderID: "u1", Type: "text", Body: "hey team"}
	if err := f.Channels.InsertChannelMessage(ctx, m, "c1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, _ := f.Channels.MessagesByChannel(ctx, "ch1", "", 10)
	if len(got) != 1 || got[0].Body != "hey team" {
		t.Fatalf("query: %v", got)
	}
	members, _ := f.Channels.Members(ctx, "ch1")
	if len(members) != 2 {
		t.Fatalf("members: %v", members)
	}
}

func TestFakePostLifecycle(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	_ = f.Posts.CreatePost(ctx, Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "hi"})
	_ = f.Posts.Like(ctx, "p1", "u2")
	_ = f.Posts.Like(ctx, "p1", "u2") // idempotent
	n, _ := f.Posts.LikeCount(ctx, "p1")
	if n != 1 {
		t.Fatalf("like count = %d, want 1", n)
	}
	_ = f.Posts.AddComment(ctx, Comment{ID: "cm1", PostID: "p1", AuthorID: "u3", Body: "nice"})
	cs, _ := f.Posts.ListComments(ctx, "p1")
	if len(cs) != 1 {
		t.Fatalf("comments: %v", cs)
	}
}

func TestFakeListPostsByZone(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	_ = f.Posts.CreatePost(ctx, Post{ID: "p1", AuthorID: "f1", AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "founder post"})
	_ = f.Posts.CreatePost(ctx, Post{ID: "p2", AuthorID: "c1", AuthorRole: "collaborator", Audience: []string{"all"}, Kind: "update", Body: "collab post"})
	_ = f.Posts.CreatePost(ctx, Post{ID: "p3", AuthorID: "o1", AuthorRole: "organisation", Audience: []string{"collaborator"}, Kind: "opportunity", Body: "role open"})

	// collaborator's tribe = own-role posts + posts targeting collaborator
	tribe, _ := f.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 50)
	ids := map[string]bool{}
	for _, p := range tribe {
		ids[p.ID] = true
	}
	if !ids["p2"] || !ids["p3"] || ids["p1"] {
		t.Fatalf("collaborator tribe wrong: %v", ids)
	}
	// global = everything
	global, _ := f.Posts.ListPostsByZone(ctx, "collaborator", "global", "", 50)
	if len(global) != 3 {
		t.Fatalf("global want 3, got %d", len(global))
	}
}

func TestNormalizeRole(t *testing.T) {
	if NormalizeRole("") != "community" || NormalizeRole("FOUNDER") != "founder" || NormalizeRole("alien") != "community" {
		t.Fatal("NormalizeRole bad")
	}
	if NormalizeRole("collaborator") != "collaborator" {
		t.Fatal("known role dropped")
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

func TestFakeConversationSummaries(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c, _, _ := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000101", ConversationID: c.ID, SenderID: "u2", Type: "text", Body: "yo"}
	_ = f.Messages.InsertDM(ctx, m, "u1", "x1")
	sums, err := f.Conversations.SummariesForUser(ctx, "u1")
	if err != nil {
		t.Fatalf("summaries: %v", err)
	}
	if len(sums) != 1 {
		t.Fatalf("want 1 summary, got %d", len(sums))
	}
	s := sums[0]
	if s.ConversationID != c.ID || s.OtherUserID != "u2" || s.LastBody != "yo" || s.Unread != 1 {
		t.Fatalf("bad summary: %+v", s)
	}
}
