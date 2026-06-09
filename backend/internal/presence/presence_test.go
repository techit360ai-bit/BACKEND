package presence

import (
	"context"
	"testing"
)

func TestServiceOnlineOffline(t *testing.T) {
	st := NewInMemoryStore()
	svc := New(st, nil) // nil publisher is allowed (no-op broadcast)
	ctx := context.Background()

	if err := svc.Online(ctx, "u1"); err != nil {
		t.Fatalf("online: %v", err)
	}
	on, _ := svc.ListOnline(ctx)
	if len(on) != 1 || on[0] != "u1" {
		t.Fatalf("expected [u1], got %v", on)
	}
	if err := svc.Offline(ctx, "u1"); err != nil {
		t.Fatalf("offline: %v", err)
	}
	on, _ = svc.ListOnline(ctx)
	if len(on) != 0 {
		t.Fatalf("expected empty, got %v", on)
	}
}

func TestServiceOnlinePublishesChange(t *testing.T) {
	st := NewInMemoryStore()
	pub := &recordingPublisher{}
	svc := New(st, pub)
	_ = svc.Online(context.Background(), "u9")
	if pub.count == 0 {
		t.Fatal("expected a presence change to be published")
	}
}

type recordingPublisher struct{ count int }

func (r *recordingPublisher) PublishPresence(_ context.Context, userID string, online bool) error {
	r.count++
	return nil
}
