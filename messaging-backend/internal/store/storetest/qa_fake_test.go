package storetest

import (
	"context"
	"testing"
	"time"
)

func newFakeQA() *FakeQAStore {
	return &FakeQAStore{questions: map[string]DemoQuestion{}, order: nil, votes: map[string]map[string]struct{}{}}
}

func TestFakeQAStore_CreateListVoteState(t *testing.T) {
	s := newFakeQA()
	ctx := context.Background()
	now := time.Now().UTC()
	q := DemoQuestion{ID: "q1", EventID: "e1", AskerID: "u1", Body: "why?", State: "open", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateQuestion(ctx, q); err != nil {
		t.Fatalf("create: %v", err)
	}

	// list as viewer u2 -> one view, 0 votes, not mine
	views, err := s.ListQuestions(ctx, "e1", "u2")
	if err != nil || len(views) != 1 {
		t.Fatalf("list: %v len=%d", err, len(views))
	}
	if views[0].Votes != 0 || views[0].Mine {
		t.Fatalf("unexpected view: %+v", views[0])
	}

	// u2 votes -> inserted true; count 1; mine true for u2
	ins, err := s.AddVote(ctx, "q1", "u2")
	if err != nil || !ins {
		t.Fatalf("addvote: %v ins=%v", err, ins)
	}
	if ins2, _ := s.AddVote(ctx, "q1", "u2"); ins2 {
		t.Fatal("second AddVote should be no-op (false)")
	}
	if n, _ := s.CountVotes(ctx, "q1"); n != 1 {
		t.Fatalf("count=%d want 1", n)
	}
	views, _ = s.ListQuestions(ctx, "e1", "u2")
	if views[0].Votes != 1 || !views[0].Mine {
		t.Fatalf("after vote: %+v", views[0])
	}

	// remove vote -> deleted true; count 0
	del, _ := s.RemoveVote(ctx, "q1", "u2")
	if !del {
		t.Fatal("RemoveVote should report deleted")
	}
	if n, _ := s.CountVotes(ctx, "q1"); n != 0 {
		t.Fatalf("count=%d want 0", n)
	}

	// set state
	if err := s.SetQuestionState(ctx, "q1", "answered"); err != nil {
		t.Fatalf("setstate: %v", err)
	}
	got, _ := s.GetQuestion(ctx, "q1")
	if got.State != "answered" {
		t.Fatalf("state=%s", got.State)
	}

	// not found
	if _, err := s.GetQuestion(ctx, "nope"); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
