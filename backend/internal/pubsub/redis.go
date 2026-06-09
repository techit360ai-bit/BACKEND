package pubsub

import (
	"context"

	"github.com/redis/go-redis/v9"
)

// Redis is a Redis-backed PubSub for multi-instance fan-out.
type Redis struct {
	client *redis.Client
}

// NewRedis connects to Redis from a redis:// URL.
func NewRedis(url string) (*Redis, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &Redis{client: client}, nil
}

func (r *Redis) Close() error { return r.client.Close() }

func (r *Redis) Publish(ctx context.Context, channel string, data []byte) error {
	return r.client.Publish(ctx, channel, data).Err()
}

func (r *Redis) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	sub := r.client.Subscribe(ctx, channel)
	out := make(chan []byte, 64)
	go func() {
		defer close(out)
		defer sub.Close()
		redisCh := sub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-redisCh:
				if !ok {
					return
				}
				select {
				case out <- []byte(msg.Payload):
				default: // drop for slow consumer
				}
			}
		}
	}()
	return out, nil
}

// Client exposes the underlying redis client for stores that need commands
// beyond pub/sub (e.g. presence sets).
func (r *Redis) Client() *redis.Client { return r.client }
