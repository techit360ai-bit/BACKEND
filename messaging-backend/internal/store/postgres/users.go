package postgres

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type UserStore struct{ pool *pgxpool.Pool }

func (s *UserStore) Upsert(ctx context.Context, u store.User) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, display_name, username, avatar_url, role, verified, subscriber, subscription_tier, credibility_score)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,NULLIF($8,''),$9)
		ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name,
		  username=COALESCE(EXCLUDED.username, users.username), avatar_url=EXCLUDED.avatar_url,
		  role=EXCLUDED.role, verified=CASE WHEN $10 THEN EXCLUDED.verified ELSE users.verified END,
		  subscriber=CASE WHEN $10 THEN EXCLUDED.subscriber ELSE users.subscriber END,
		  subscription_tier=CASE WHEN $10 THEN EXCLUDED.subscription_tier ELSE users.subscription_tier END,
		  credibility_score=CASE WHEN $10 THEN EXCLUDED.credibility_score ELSE users.credibility_score END`,
		u.ID, u.DisplayName, strings.TrimPrefix(u.Username, "@"), u.AvatarURL, u.Role, u.Verified, u.Subscriber, u.SubscriptionTier, u.CredibilityScore, u.IdentityPresent)
	return err
}

func (s *UserStore) Get(ctx context.Context, id string) (store.User, error) {
	var u store.User
	err := s.pool.QueryRow(ctx, `SELECT id, display_name, COALESCE(username,''), COALESCE(avatar_url,''), COALESCE(role,''), verified, subscriber, COALESCE(subscription_tier,''), credibility_score, created_at FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.DisplayName, &u.Username, &u.AvatarURL, &u.Role, &u.Verified, &u.Subscriber, &u.SubscriptionTier, &u.CredibilityScore, &u.CreatedAt)
	if err != nil {
		return store.User{}, notFound(err)
	}
	return u, nil
}

func (s *UserStore) GetByUsername(ctx context.Context, username string) (store.User, error) {
	var u store.User
	err := s.pool.QueryRow(ctx, `SELECT id, display_name, COALESCE(username,''), COALESCE(avatar_url,''), COALESCE(role,''), verified, subscriber, COALESCE(subscription_tier,''), credibility_score, created_at FROM users WHERE lower(username)=lower($1)`, strings.TrimPrefix(strings.TrimSpace(username), "@")).
		Scan(&u.ID, &u.DisplayName, &u.Username, &u.AvatarURL, &u.Role, &u.Verified, &u.Subscriber, &u.SubscriptionTier, &u.CredibilityScore, &u.CreatedAt)
	if err != nil {
		return store.User{}, notFound(err)
	}
	return u, nil
}

func (s *UserStore) Search(ctx context.Context, query, excludeUserID string, limit int) ([]store.User, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	query = strings.TrimPrefix(strings.TrimSpace(query), "@")
	rows, err := s.pool.Query(ctx, `SELECT id, display_name, COALESCE(username,''), COALESCE(avatar_url,''), COALESCE(role,''), verified, subscriber, COALESCE(subscription_tier,''), credibility_score, created_at FROM users WHERE id<>$1 AND (lower(display_name) LIKE lower($2) OR lower(COALESCE(username,'')) LIKE lower($2)) ORDER BY verified DESC, credibility_score DESC, display_name LIMIT `+strconv.Itoa(limit), excludeUserID, "%"+query+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]store.User, 0, limit)
	for rows.Next() {
		var u store.User
		if err := rows.Scan(&u.ID, &u.DisplayName, &u.Username, &u.AvatarURL, &u.Role, &u.Verified, &u.Subscriber, &u.SubscriptionTier, &u.CredibilityScore, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
