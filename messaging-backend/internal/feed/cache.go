package feed

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type Cache interface { Get(context.Context,string)([]store.Post,bool); Set(context.Context,string,[]store.Post); Invalidate(context.Context) }
type RedisCache struct { client *redis.Client; ttl time.Duration }
func NewRedisCache(client *redis.Client) *RedisCache { return &RedisCache{client:client,ttl:30*time.Second} }
func (c *RedisCache) key(ctx context.Context, raw string) string { version,_:=c.client.Get(ctx,"feed:cache:version").Result(); sum:=sha256.Sum256([]byte(raw)); return fmt.Sprintf("feed:cache:%s:%x",version,sum) }
func (c *RedisCache) Get(ctx context.Context, raw string)([]store.Post,bool){ data,err:=c.client.Get(ctx,c.key(ctx,raw)).Bytes();if err!=nil{return nil,false};var posts []store.Post;if json.Unmarshal(data,&posts)!=nil{return nil,false};return posts,true }
func (c *RedisCache) Set(ctx context.Context, raw string, posts []store.Post){ data,err:=json.Marshal(posts);if err==nil{_ = c.client.Set(ctx,c.key(ctx,raw),data,c.ttl).Err()} }
func (c *RedisCache) Invalidate(ctx context.Context){ _ = c.client.Incr(ctx,"feed:cache:version").Err() }
