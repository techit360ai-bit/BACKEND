package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type UserStore struct{ pool *pgxpool.Pool }

func (s *UserStore) Upsert(ctx context.Context, u store.User) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, display_name, avatar_url, role)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name,
		  avatar_url=EXCLUDED.avatar_url, role=EXCLUDED.role`,
		u.ID, u.DisplayName, u.AvatarURL, u.Role)
	return err
}

func (s *UserStore) Get(ctx context.Context, id string) (store.User, error) {
	var u store.User
	err := s.pool.QueryRow(ctx, `SELECT id, display_name, COALESCE(avatar_url,''), COALESCE(role,''), created_at FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.DisplayName, &u.AvatarURL, &u.Role, &u.CreatedAt)
	if err != nil {
		return store.User{}, notFound(err)
	}
	return u, nil
}
