// Package postgres implements the store interfaces over PostgreSQL via pgx.
package postgres

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// pgx prepares and caches statements per server connection by default. Under a
// PgBouncer transaction pool a cached statement may be reused on a different
// server connection and fail ("prepared statement does not exist"), so the
// platform sets PGX_QUERY_EXEC_MODE=exec in production: every query is
// self-contained and never relies on a pinned server connection.
var queryExecModes = map[string]pgx.QueryExecMode{
	"cache_statement": pgx.QueryExecModeCacheStatement,
	"cache_describe":  pgx.QueryExecModeCacheDescribe,
	"describe_exec":   pgx.QueryExecModeDescribeExec,
	"exec":            pgx.QueryExecModeExec,
	"simple_protocol": pgx.QueryExecModeSimpleProtocol,
}

// queryExecMode resolves the PGX_QUERY_EXEC_MODE env value; an unknown value
// keeps pgx's default rather than failing the deploy.
func queryExecMode(name string) (pgx.QueryExecMode, bool) {
	mode, ok := queryExecModes[strings.ToLower(strings.TrimSpace(name))]
	return mode, ok
}

// Store aggregates the per-entity stores over one pool.
type Store struct {
	pool          *pgxpool.Pool
	Users         *UserStore
	Conversations *ConversationStore
	Messages      *MessageStore
	Channels      *ChannelStore
	Posts         *PostStore
	Demo          *DemoStore
	QA            *QAStore
}

// Open connects a pgx pool and wires the sub-stores.
func Open(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	if mode, ok := queryExecMode(os.Getenv("PGX_QUERY_EXEC_MODE")); ok {
		cfg.ConnConfig.DefaultQueryExecMode = mode
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	s := &Store{pool: pool}
	s.Users = &UserStore{pool: pool}
	s.Conversations = &ConversationStore{pool: pool}
	s.Messages = &MessageStore{pool: pool}
	s.Channels = &ChannelStore{pool: pool}
	s.Posts = &PostStore{pool: pool}
	s.Demo = &DemoStore{pool: pool}
	s.QA = &QAStore{pool: pool}
	return s, nil
}

func (s *Store) Close() { s.pool.Close() }

// Migrate applies a single SQL file (idempotent DDL).
func (s *Store) Migrate(ctx context.Context, path string) error {
	sql, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, string(sql))
	return err
}

// MigrateAll applies every *.sql file in dir, sorted by name, in order.
func (s *Store) MigrateAll(ctx context.Context, dir string) error {
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, f := range files {
		if err := s.Migrate(ctx, f); err != nil {
			return err
		}
	}
	return nil
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return store.ErrNotFound
	}
	return err
}

var (
	_ store.UserStore         = (*UserStore)(nil)
	_ store.ConversationStore = (*ConversationStore)(nil)
	_ store.MessageStore      = (*MessageStore)(nil)
	_ store.ChannelStore      = (*ChannelStore)(nil)
	_ store.PostStore         = (*PostStore)(nil)
)
