//go:build integration

package pubsub

import (
	"context"
	"os"
	"testing"
	"time"
)

func testRedisURL() string {
	if v := os.Getenv("TEST_REDIS_URL"); v != "" {
		return v
	}
	return "redis://localhost:56379"
}

func TestRedisPublishSubscribe(t *testing.T) {
	ps, err := NewRedis(testRedisURL())
	if err != nil {
		t.Fatalf("new redis: %v", err)
	}
	defer ps.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch, err := ps.Subscribe(ctx, "itroom")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	// redis subscription is async; give it a moment to register
	time.Sleep(150 * time.Millisecond)
	if err := ps.Publish(context.Background(), "itroom", []byte("hi")); err != nil {
		t.Fatalf("publish: %v", err)
	}
	select {
	case msg := <-ch:
		if string(msg) != "hi" {
			t.Errorf("got %q", msg)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout")
	}
}
