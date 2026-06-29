// Package presence tracks which users are online (Redis set + last-seen) and
// publishes presence changes for broadcast to connected clients.
package presence

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	onlineKey   = "presence:online"   // SET of online user IDs
	lastSeenKey = "presence:lastseen" // HASH userID -> RFC3339
)

// Store persists online membership and last-seen timestamps.
type Store interface {
	Add(ctx context.Context, userID string) error
	Remove(ctx context.Context, userID, lastSeen string) error
	List(ctx context.Context) ([]string, error)
}

// Publisher emits a presence change for cross-instance broadcast.
type Publisher interface {
	PublishPresence(ctx context.Context, userID string, online bool) error
}

// Service is the presence façade used by the gateway.
type Service struct {
	store Store
	pub   Publisher
	now   func() time.Time
}

func New(store Store, pub Publisher) *Service {
	return &Service{store: store, pub: pub, now: time.Now}
}

func (s *Service) Online(ctx context.Context, userID string) error {
	if err := s.store.Add(ctx, userID); err != nil {
		return err
	}
	if s.pub != nil {
		_ = s.pub.PublishPresence(ctx, userID, true)
	}
	return nil
}

func (s *Service) Offline(ctx context.Context, userID string) error {
	if err := s.store.Remove(ctx, userID, s.now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	if s.pub != nil {
		_ = s.pub.PublishPresence(ctx, userID, false)
	}
	return nil
}

func (s *Service) ListOnline(ctx context.Context) ([]string, error) {
	return s.store.List(ctx)
}

// InMemoryStore is a Store for tests / single-instance dev.
type InMemoryStore struct {
	mu     sync.Mutex
	online map[string]struct{}
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{online: map[string]struct{}{}}
}

func (s *InMemoryStore) Add(_ context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.online[userID] = struct{}{}
	return nil
}
func (s *InMemoryStore) Remove(_ context.Context, userID, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.online, userID)
	return nil
}
func (s *InMemoryStore) List(_ context.Context) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]string, 0, len(s.online))
	for u := range s.online {
		out = append(out, u)
	}
	sort.Strings(out)
	return out, nil
}

// RedisStore is the production Store.
type RedisStore struct{ client *redis.Client }

func NewRedisStore(client *redis.Client) *RedisStore { return &RedisStore{client: client} }

func (s *RedisStore) Add(ctx context.Context, userID string) error {
	return s.client.SAdd(ctx, onlineKey, userID).Err()
}
func (s *RedisStore) Remove(ctx context.Context, userID, lastSeen string) error {
	if err := s.client.SRem(ctx, onlineKey, userID).Err(); err != nil {
		return err
	}
	return s.client.HSet(ctx, lastSeenKey, userID, lastSeen).Err()
}
func (s *RedisStore) List(ctx context.Context) ([]string, error) {
	res, err := s.client.SMembers(ctx, onlineKey).Result()
	if err != nil {
		return nil, err
	}
	sort.Strings(res)
	return res, nil
}
