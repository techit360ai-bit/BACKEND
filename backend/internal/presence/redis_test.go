//go:build integration

package presence

import (
	"context"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestRedisStoreAddListRemove(t *testing.T) {
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:56379"
	}
	opt, _ := redis.ParseURL(url)
	client := redis.NewClient(opt)
	defer client.Close()
	client.Del(context.Background(), onlineKey)

	st := NewRedisStore(client)
	ctx := context.Background()
	_ = st.Add(ctx, "ru1")
	on, _ := st.List(ctx)
	if len(on) != 1 || on[0] != "ru1" {
		t.Fatalf("got %v", on)
	}
	_ = st.Remove(ctx, "ru1", "2026-06-08T00:00:00Z")
	on, _ = st.List(ctx)
	if len(on) != 0 {
		t.Fatalf("expected empty, got %v", on)
	}
}
