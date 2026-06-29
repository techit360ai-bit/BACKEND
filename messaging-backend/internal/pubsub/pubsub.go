// Package pubsub provides a minimal publish/subscribe abstraction used to fan
// out delivery across service instances. It has an in-memory fake (tests,
// single-instance dev) and a Redis-backed implementation (multi-instance).
package pubsub

import (
	"context"
	"sync"
)

// PubSub is a channel-based publish/subscribe bus.
type PubSub interface {
	// Publish sends data to all current subscribers of channel.
	Publish(ctx context.Context, channel string, data []byte) error
	// Subscribe returns a receive channel for messages on channel. The
	// subscription ends (and the returned channel is closed) when ctx is done.
	Subscribe(ctx context.Context, channel string) (<-chan []byte, error)
}

// InMemory is an in-process PubSub for tests and single-instance runs.
type InMemory struct {
	mu   sync.Mutex
	subs map[string][]chan []byte
}

func NewInMemory() *InMemory {
	return &InMemory{subs: map[string][]chan []byte{}}
}

func (m *InMemory) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	ch := make(chan []byte, 64)
	m.mu.Lock()
	m.subs[channel] = append(m.subs[channel], ch)
	m.mu.Unlock()

	go func() {
		<-ctx.Done()
		m.mu.Lock()
		defer m.mu.Unlock()
		cur := m.subs[channel]
		for i, c := range cur {
			if c == ch {
				m.subs[channel] = append(cur[:i], cur[i+1:]...)
				close(ch)
				break
			}
		}
	}()
	return ch, nil
}

func (m *InMemory) Publish(_ context.Context, channel string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ch := range m.subs[channel] {
		select {
		case ch <- data:
		default: // drop for slow subscriber; delivery is best-effort
		}
	}
	return nil
}
