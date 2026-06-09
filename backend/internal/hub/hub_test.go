package hub

import (
	"context"
	"testing"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
)

func drain(c *Conn, d time.Duration) (protocol.Envelope, bool) {
	select {
	case env := <-c.Out():
		return env, true
	case <-time.After(d):
		return protocol.Envelope{}, false
	}
}

func TestRouteToLocalConnection(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.Run(ctx)

	c := NewConn("u1")
	h.Register(c)
	defer h.Unregister(c)

	local, err := h.RouteToUser(context.Background(), "u1", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil || !local {
		t.Fatalf("expected local delivery: local=%v err=%v", local, err)
	}
	if env, ok := drain(c, time.Second); !ok || env.Type != protocol.TypeMessageNew {
		t.Fatalf("conn did not receive: %+v ok=%v", env, ok)
	}
}

func TestRouteToRemoteViaPubSub(t *testing.T) {
	ps := pubsub.NewInMemory() // shared bus = two "instances"
	h1 := New(ps)
	h2 := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h1.Run(ctx)
	go h2.Run(ctx)
	time.Sleep(50 * time.Millisecond) // let subscriptions register

	// user lives on h2
	c := NewConn("u2")
	h2.Register(c)
	defer h2.Unregister(c)

	// routed from h1 (no local conn) -> should publish -> h2 delivers
	local, err := h1.RouteToUser(context.Background(), "u2", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil {
		t.Fatalf("route: %v", err)
	}
	if local {
		t.Fatal("should not be local on h1")
	}
	if env, ok := drain(c, 2*time.Second); !ok || env.Type != protocol.TypeMessageNew {
		t.Fatalf("remote delivery failed: %+v ok=%v", env, ok)
	}
}

func TestRouteToOfflineUserReturnsFalse(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.Run(ctx)
	time.Sleep(20 * time.Millisecond)
	local, err := h.RouteToUser(context.Background(), "ghost", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil || local {
		t.Fatalf("offline route should be (false,nil): local=%v err=%v", local, err)
	}
}

func TestBroadcastReachesAllLocalConns(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	a, b := NewConn("a"), NewConn("b")
	h.Register(a)
	h.Register(b)
	h.Broadcast(protocol.Envelope{Type: protocol.TypePresenceChanged})
	if _, ok := drain(a, time.Second); !ok {
		t.Error("a missed broadcast")
	}
	if _, ok := drain(b, time.Second); !ok {
		t.Error("b missed broadcast")
	}
}
