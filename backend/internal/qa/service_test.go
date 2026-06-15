package qa

import (
	"context"
	"errors"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// liveEvent creates an event via demo.Service and drives it to "live".
func liveEvent(t *testing.T, ctx context.Context, ds *demo.Service, host string) string {
	t.Helper()
	ev, err := ds.Create(ctx, host, demo.CreateEventInput{Kind: "startup", Title: "T"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := ds.Transition(ctx, ev.ID, host, "scheduled"); err != nil {
		t.Fatalf("sched: %v", err)
	}
	if _, err := ds.Transition(ctx, ev.ID, host, "live"); err != nil {
		t.Fatalf("live: %v", err)
	}
	return ev.ID
}

func newSvc(st *store.FakeStores) (*Service, *demo.Service) {
	ds := demo.New(st.Demo)
	return New(st.QA, ds, store.NewFakeRouter()), ds
}

func TestAsk_RequiresLiveAndParticipant(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")

	// outsider cannot ask
	if _, err := s.Ask(ctx, id, "stranger", "q?"); !errors.Is(err, demo.ErrNotParticipant) {
		t.Fatalf("outsider want ErrNotParticipant, got %v", err)
	}
	// invite + accept an audience member, then they can ask
	if _, err := ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "aud1", RoomRole: "audience"}); err != nil {
		t.Fatalf("invite: %v", err)
	}
	if _, err := ds.RespondInvite(ctx, id, "aud1", true); err != nil {
		t.Fatalf("accept: %v", err)
	}
	q, err := s.Ask(ctx, id, "aud1", "  why?  ")
	if err != nil {
		t.Fatalf("ask: %v", err)
	}
	if q.Body != "why?" || q.State != "open" || q.AskerID != "aud1" {
		t.Fatalf("bad question: %+v", q)
	}
	// empty body rejected
	if _, err := s.Ask(ctx, id, "host1", "   "); !errors.Is(err, ErrEmptyBody) {
		t.Fatalf("empty want ErrEmptyBody, got %v", err)
	}
}

func TestAsk_NotLive(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	ev, _ := ds.Create(ctx, "host1", demo.CreateEventInput{Kind: "startup", Title: "T"}) // draft
	if _, err := s.Ask(ctx, ev.ID, "host1", "q?"); !errors.Is(err, ErrNotLive) {
		t.Fatalf("draft ask want ErrNotLive, got %v", err)
	}
}

func TestUpvote_Toggle(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	q, _ := s.Ask(ctx, id, "host1", "q?")

	votes, mine, err := s.Upvote(ctx, id, q.ID, "host1")
	if err != nil || votes != 1 || !mine {
		t.Fatalf("first upvote: votes=%d mine=%v err=%v", votes, mine, err)
	}
	votes, mine, err = s.Upvote(ctx, id, q.ID, "host1")
	if err != nil || votes != 0 || mine {
		t.Fatalf("toggle off: votes=%d mine=%v err=%v", votes, mine, err)
	}
}

func TestResolve_HostOrPresenterOnly(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	q, _ := s.Ask(ctx, id, "host1", "q?")

	// audience participant cannot resolve
	_, _ = ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "aud1", RoomRole: "audience"})
	_, _ = ds.RespondInvite(ctx, id, "aud1", true)
	if _, err := s.Resolve(ctx, id, q.ID, "aud1", "answered"); !errors.Is(err, demo.ErrNotHost) {
		t.Fatalf("audience resolve want ErrNotHost, got %v", err)
	}
	// invalid state rejected
	if _, err := s.Resolve(ctx, id, q.ID, "host1", "bogus"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("bad state want ErrInvalidState, got %v", err)
	}
	// presenter can resolve
	_, _ = ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "pres1", RoomRole: "presenter"})
	_, _ = ds.RespondInvite(ctx, id, "pres1", true)
	got, err := s.Resolve(ctx, id, q.ID, "pres1", "answered")
	if err != nil || got.State != "answered" {
		t.Fatalf("presenter resolve: state=%s err=%v", got.State, err)
	}
}

func TestList_ArrivalOrderAndAuthz(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	_, _ = s.Ask(ctx, id, "host1", "first")
	_, _ = s.Ask(ctx, id, "host1", "second")

	views, err := s.List(ctx, id, "host1")
	if err != nil || len(views) != 2 {
		t.Fatalf("list: %v len=%d", err, len(views))
	}
	if views[0].Body != "first" || views[1].Body != "second" {
		t.Fatalf("not arrival order: %+v", views)
	}
	// outsider cannot list
	if _, err := s.List(ctx, id, "stranger"); !errors.Is(err, demo.ErrNotParticipant) {
		t.Fatalf("outsider list want ErrNotParticipant, got %v", err)
	}
}
