package store

import (
	"context"
	"testing"
	"time"
)

func TestDemoValidationAndTransitions(t *testing.T) {
	if !KnownDemoKind["mentorship"] || KnownDemoKind["x"] {
		t.Fatal("kind allow-set wrong")
	}
	if !AllowedDemoTransition("draft", "scheduled") || AllowedDemoTransition("ended", "live") {
		t.Fatal("transition rules wrong")
	}
	if AllowedDemoTransition("draft", "live") {
		t.Fatal("draft->live must be illegal")
	}
}

func TestFakeDemoStore(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	e := DemoEvent{ID: "e1", HostID: "h1", Kind: "startup", Title: "T", Status: "draft", CreatedAt: time.Now()}
	if err := f.Demo.CreateEvent(ctx, e); err != nil {
		t.Fatal(err)
	}
	if got, err := f.Demo.GetEvent(ctx, "e1"); err != nil || got.Title != "T" {
		t.Fatalf("get: %+v %v", got, err)
	}
	_ = f.Demo.UpsertRoster(ctx, RosterEntry{EventID: "e1", UserID: "h1", RoomRole: "host", Status: "accepted"})
	_ = f.Demo.UpsertRoster(ctx, RosterEntry{EventID: "e1", UserID: "g1", RoomRole: "audience", Status: "invited"})
	if rs, _ := f.Demo.ListRoster(ctx, "e1"); len(rs) != 2 {
		t.Fatalf("roster len %d", len(rs))
	}
	// invitee sees the event via roster
	if evs, _ := f.Demo.ListEventsForUser(ctx, "g1"); len(evs) != 1 {
		t.Fatalf("invitee list %d", len(evs))
	}
	if evs, _ := f.Demo.ListEventsForUser(ctx, "h1"); len(evs) != 1 {
		t.Fatalf("host list %d", len(evs))
	}
}
