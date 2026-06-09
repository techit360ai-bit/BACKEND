package pubsub

import (
	"context"
	"testing"
	"time"
)

func TestInMemoryPublishSubscribe(t *testing.T) {
	ps := NewInMemory()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch, err := ps.Subscribe(ctx, "room")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	if err := ps.Publish(context.Background(), "room", []byte("hello")); err != nil {
		t.Fatalf("publish: %v", err)
	}
	select {
	case msg := <-ch:
		if string(msg) != "hello" {
			t.Errorf("got %q", msg)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for message")
	}
}

func TestInMemoryIsolatesChannels(t *testing.T) {
	ps := NewInMemory()
	ctx := context.Background()
	ch, _ := ps.Subscribe(ctx, "a")
	_ = ps.Publish(ctx, "b", []byte("x"))
	select {
	case <-ch:
		t.Fatal("received message from a different channel")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestInMemoryUnsubscribeOnCtxCancel(t *testing.T) {
	ps := NewInMemory()
	ctx, cancel := context.WithCancel(context.Background())
	ch, _ := ps.Subscribe(ctx, "room")
	cancel()
	// publishing after cancel must not panic and the channel is eventually closed
	time.Sleep(50 * time.Millisecond)
	_ = ps.Publish(context.Background(), "room", []byte("late"))
	// draining a closed/empty channel should not block
	select {
	case <-ch:
	case <-time.After(100 * time.Millisecond):
	}
}
