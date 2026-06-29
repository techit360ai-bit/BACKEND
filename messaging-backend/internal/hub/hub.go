// Package hub maintains the per-instance registry of live connections and
// implements store.Router: deliver to a user's local connections, or publish to
// the shared bus so the instance holding that user delivers it.
package hub

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/pubsub"
)

// routeChannel is the pub/sub channel used for cross-instance routing.
const routeChannel = "ws:route"

// Conn is a single client connection's outbound side. The gateway owns the
// socket; the hub only pushes envelopes into Out().
type Conn struct {
	UserID string
	out    chan protocol.Envelope
}

// NewConn creates a connection handle with a buffered outbound queue.
func NewConn(userID string) *Conn {
	return &Conn{UserID: userID, out: make(chan protocol.Envelope, 64)}
}

// Out is the channel the gateway's write pump reads from.
func (c *Conn) Out() <-chan protocol.Envelope { return c.out }

// trySend enqueues without blocking; returns false if the queue is full.
func (c *Conn) trySend(env protocol.Envelope) bool {
	select {
	case c.out <- env:
		return true
	default:
		return false
	}
}

type routeMsg struct {
	UserID string            `json:"userId"`
	Env    protocol.Envelope `json:"env"`
}

// Hub is the connection registry + router for one instance.
type Hub struct {
	ps  pubsub.PubSub
	mu  sync.RWMutex
	reg map[string]map[*Conn]struct{} // userID -> set of conns
}

// New constructs a Hub over a pub/sub bus.
func New(ps pubsub.PubSub) *Hub {
	return &Hub{ps: ps, reg: map[string]map[*Conn]struct{}{}}
}

// Register adds a connection to the local registry.
func (h *Hub) Register(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.reg[c.UserID] == nil {
		h.reg[c.UserID] = map[*Conn]struct{}{}
	}
	h.reg[c.UserID][c] = struct{}{}
}

// Unregister removes a connection.
func (h *Hub) Unregister(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set := h.reg[c.UserID]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.reg, c.UserID)
		}
	}
}

// deliverLocal pushes env to all local conns of userID; returns true if any.
func (h *Hub) deliverLocal(userID string, env protocol.Envelope) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	set := h.reg[userID]
	delivered := false
	for c := range set {
		if c.trySend(env) {
			delivered = true
		}
	}
	return delivered
}

// RouteToUser implements store.Router. Local delivery returns (true,nil).
// Otherwise it publishes to the shared bus and returns (false,nil).
func (h *Hub) RouteToUser(ctx context.Context, userID string, env protocol.Envelope) (bool, error) {
	if h.deliverLocal(userID, env) {
		return true, nil
	}
	if h.ps == nil {
		return false, nil
	}
	payload, err := json.Marshal(routeMsg{UserID: userID, Env: env})
	if err != nil {
		return false, err
	}
	if err := h.ps.Publish(ctx, routeChannel, payload); err != nil {
		return false, err
	}
	return false, nil
}

// Broadcast pushes env to every local connection (used for presence).
func (h *Hub) Broadcast(env protocol.Envelope) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, set := range h.reg {
		for c := range set {
			c.trySend(env)
		}
	}
}

// Run subscribes to the route channel and delivers inbound messages to local
// conns until ctx is cancelled. Call once per instance (e.g. in a goroutine).
func (h *Hub) Run(ctx context.Context) {
	if h.ps == nil {
		return
	}
	ch, err := h.ps.Subscribe(ctx, routeChannel)
	if err != nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case raw, ok := <-ch:
			if !ok {
				return
			}
			var rm routeMsg
			if json.Unmarshal(raw, &rm) != nil {
				continue
			}
			h.deliverLocal(rm.UserID, rm.Env)
		}
	}
}
