package demo

import (
	"context"
	"errors"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() *Service { return New(store.NewFakeStores().Demo) }

func TestCreateStampsDraftAndHostRoster(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	ev, err := s.Create(ctx, "host1", CreateEventInput{Kind: "startup", Title: "Launch"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if ev.Status != "draft" || ev.HostID != "host1" || ev.ID == "" {
		t.Fatalf("bad event: %+v", ev)
	}
	r, err := s.store.GetRosterEntry(ctx, ev.ID, "host1")
	if err != nil || r.RoomRole != "host" || r.Status != "accepted" {
		t.Fatalf("host roster: %+v err=%v", r, err)
	}
}

func TestCreateInvalidKind(t *testing.T) {
	if _, err := newSvc().Create(context.Background(), "h", CreateEventInput{Kind: "nope", Title: "x"}); !errors.Is(err, ErrInvalidField) {
		t.Fatalf("want ErrInvalidField, got %v", err)
	}
}

func TestGetEventOutsiderRejected(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	ev, _ := s.Create(ctx, "host1", CreateEventInput{Kind: "startup", Title: "L"})
	if _, err := s.GetEvent(ctx, ev.ID, "stranger"); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("want ErrNotParticipant, got %v", err)
	}
	if _, err := s.GetEvent(ctx, ev.ID, "host1"); err != nil {
		t.Fatalf("host get: %v", err)
	}
}

func TestTransition(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	ev, _ := s.Create(ctx, "h", CreateEventInput{Kind: "startup", Title: "L"})
	if got, err := s.Transition(ctx, ev.ID, "h", "scheduled"); err != nil || got.Status != "scheduled" {
		t.Fatalf("draft->scheduled: %+v err=%v", got, err)
	}
	if _, err := s.Transition(ctx, ev.ID, "h", "live"); err != nil {
		t.Fatalf("scheduled->live: %v", err)
	}
	if _, err := s.Transition(ctx, ev.ID, "h", "draft"); !errors.Is(err, ErrBadTransition) {
		t.Fatalf("want ErrBadTransition for live->draft, got %v", err)
	}
}

func TestUpdateEventAuthzAndEditability(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	ev, _ := s.Create(ctx, "h", CreateEventInput{Kind: "startup", Title: "L"})
	title := "New"
	if _, err := s.UpdateEvent(ctx, ev.ID, "other", PatchEventInput{Title: &title}); !errors.Is(err, ErrNotHost) {
		t.Fatalf("want ErrNotHost, got %v", err)
	}
	if _, err := s.UpdateEvent(ctx, ev.ID, "h", PatchEventInput{Title: &title}); err != nil {
		t.Fatalf("host update: %v", err)
	}
	_, _ = s.Transition(ctx, ev.ID, "h", "scheduled")
	if _, err := s.UpdateEvent(ctx, ev.ID, "h", PatchEventInput{Title: &title}); !errors.Is(err, ErrNotEditable) {
		t.Fatalf("want ErrNotEditable, got %v", err)
	}
}

func TestInviteAndRespond(t *testing.T) {
	s := newSvc()
	ctx := context.Background()
	ev, _ := s.Create(ctx, "h", CreateEventInput{Kind: "startup", Title: "L"})
	if _, err := s.Invite(ctx, ev.ID, "other", InviteInput{UserID: "judge1", RoomRole: "judge"}); !errors.Is(err, ErrNotHost) {
		t.Fatalf("want ErrNotHost, got %v", err)
	}
	if _, err := s.Invite(ctx, ev.ID, "h", InviteInput{UserID: "judge1", RoomRole: "judge"}); err != nil {
		t.Fatalf("invite: %v", err)
	}
	if _, err := s.RespondInvite(ctx, ev.ID, "nobody", true); !errors.Is(err, ErrNotInvitee) {
		t.Fatalf("want ErrNotInvitee, got %v", err)
	}
	r, err := s.RespondInvite(ctx, ev.ID, "judge1", true)
	if err != nil || r.Status != "accepted" {
		t.Fatalf("respond accept: %+v err=%v", r, err)
	}
}
