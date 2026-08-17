// Command server runs the TechIT messaging service: HTTP API + WebSocket gateway
// backed by Postgres and Redis.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/auth"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/channel"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/config"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/demo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/discovery"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/feed"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/hub"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/livekit"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/messaging"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/presence"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/pubsub"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/qa"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store/postgres"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/transport/httpapi"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/transport/ws"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Postgres (retry: compose healthcheck can go green during postgres' init
	// phase before it restarts for real, so the first dials may be refused)
	pg, err := openPostgresWithRetry(ctx, cfg.DatabaseURL, 30*time.Second)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pg.Close()
	if err := pg.MigrateAll(ctx, "internal/store/migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Redis pub/sub + presence
	rps, err := pubsub.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rps.Close()

	h := hub.New(rps)
	go h.Run(ctx)

	presSvc := presence.New(presence.NewRedisStore(rps.Client()), nil)
	msgSvc := messaging.New(pg.Conversations, pg.Messages, h)
	chSvc := channel.New(pg.Channels, h)
	feedSvc := feed.New(pg.Posts, h)
	feedSvc.SetCache(feed.NewRedisCache(rps.Client()))
	demoSvc := demo.New(pg.Demo)
	qaSvc := qa.New(pg.QA, demoSvc, h)
	lkSvc := livekit.New(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret, cfg.LiveKitURL)
	ver := auth.NewVerifier(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience)
	discoveryClient := discovery.New(ctx, cfg.DiscoveryAPIURL)

	gw := ws.New(ws.Deps{
		Hub: h, Verifier: ver, Users: pg.Users, Messaging: msgSvc, Channels: chSvc, Presence: presSvc,
		InsecureSkipOriginCheck: cfg.CORSOrigins == "*",
	})
	api := httpapi.NewRouter(httpapi.Deps{
		Verifier: ver, Users: pg.Users, Conversations: pg.Conversations,
		Messages: pg.Messages, Messaging: msgSvc, Channels: chSvc, ChannelStore: pg.Channels,
		Feed: feedSvc, Demo: demoSvc, QA: qaSvc, LiveKit: lkSvc, Presence: presSvc,
		EnableDevToken: cfg.EnableDevToken, CORSOrigins: cfg.CORSOrigins,
		Discovery: discoveryClient,
	})

	mux := http.NewServeMux()
	mux.Handle("/", api)
	mux.HandleFunc("/ws", gw.Handle)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: mux}
	go func() {
		log.Printf("messaging service listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
}

// openPostgresWithRetry retries postgres.Open until it succeeds or the deadline
// passes. Tolerates the brief window where the DB is starting/restarting.
func openPostgresWithRetry(ctx context.Context, dsn string, within time.Duration) (*postgres.Store, error) {
	deadline := time.Now().Add(within)
	var lastErr error
	for {
		pg, err := postgres.Open(ctx, dsn)
		if err == nil {
			return pg, nil
		}
		lastErr = err
		if time.Now().After(deadline) || ctx.Err() != nil {
			return nil, lastErr
		}
		log.Printf("postgres not ready, retrying: %v", err)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
}
