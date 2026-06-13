package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type DemoStore struct{ pool *pgxpool.Pool }

var _ store.DemoStore = (*DemoStore)(nil)

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (s *DemoStore) CreateEvent(ctx context.Context, e store.DemoEvent) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO demo_events (id, host_id, kind, title, description, asset_url, asset_type, status, scheduled_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		e.ID, e.HostID, e.Kind, e.Title, e.Description, nullStr(e.AssetURL), nullStr(e.AssetType), e.Status, e.ScheduledAt, e.CreatedAt, e.UpdatedAt)
	return err
}

func (s *DemoStore) scanEvent(row pgx.Row) (store.DemoEvent, error) {
	var e store.DemoEvent
	var url, atype *string
	var sched *time.Time
	if err := row.Scan(&e.ID, &e.HostID, &e.Kind, &e.Title, &e.Description, &url, &atype, &e.Status, &sched, &e.CreatedAt, &e.UpdatedAt); err != nil {
		return store.DemoEvent{}, err
	}
	e.AssetURL, e.AssetType, e.ScheduledAt = str(url), str(atype), sched
	return e, nil
}

const demoCols = `id, host_id, kind, title, description, asset_url, asset_type, status, scheduled_at, created_at, updated_at`

func (s *DemoStore) GetEvent(ctx context.Context, id string) (store.DemoEvent, error) {
	e, err := s.scanEvent(s.pool.QueryRow(ctx, `SELECT `+demoCols+` FROM demo_events WHERE id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return store.DemoEvent{}, store.ErrNotFound
	}
	return e, err
}

func (s *DemoStore) ListEventsForUser(ctx context.Context, userID string) ([]store.DemoEvent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+demoCols+` FROM demo_events e
		WHERE e.host_id=$1 OR EXISTS (SELECT 1 FROM demo_roster r WHERE r.event_id=e.id AND r.user_id=$1)
		ORDER BY e.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.DemoEvent
	for rows.Next() {
		e, err := s.scanEvent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *DemoStore) UpdateEvent(ctx context.Context, e store.DemoEvent) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE demo_events SET kind=$2, title=$3, description=$4, asset_url=$5, asset_type=$6, status=$7, scheduled_at=$8, updated_at=$9
		WHERE id=$1`,
		e.ID, e.Kind, e.Title, e.Description, nullStr(e.AssetURL), nullStr(e.AssetType), e.Status, e.ScheduledAt, e.UpdatedAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *DemoStore) UpsertRoster(ctx context.Context, r store.RosterEntry) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO demo_roster (event_id, user_id, room_role, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (event_id, user_id) DO UPDATE SET room_role=EXCLUDED.room_role, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at`,
		r.EventID, r.UserID, r.RoomRole, r.Status, r.CreatedAt, r.UpdatedAt)
	return err
}

func (s *DemoStore) GetRosterEntry(ctx context.Context, eventID, userID string) (store.RosterEntry, error) {
	var r store.RosterEntry
	err := s.pool.QueryRow(ctx, `SELECT event_id, user_id, room_role, status, created_at, updated_at FROM demo_roster WHERE event_id=$1 AND user_id=$2`, eventID, userID).
		Scan(&r.EventID, &r.UserID, &r.RoomRole, &r.Status, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return store.RosterEntry{}, store.ErrNotFound
	}
	return r, err
}

func (s *DemoStore) ListRoster(ctx context.Context, eventID string) ([]store.RosterEntry, error) {
	rows, err := s.pool.Query(ctx, `SELECT event_id, user_id, room_role, status, created_at, updated_at FROM demo_roster WHERE event_id=$1 ORDER BY created_at`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.RosterEntry
	for rows.Next() {
		var r store.RosterEntry
		if err := rows.Scan(&r.EventID, &r.UserID, &r.RoomRole, &r.Status, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
