package postgres

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type PostStore struct{ pool *pgxpool.Pool }

func (s *PostStore) CreatePost(ctx context.Context, p store.Post) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO posts (id, author_id, kind, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
		p.ID, p.AuthorID, p.Kind, p.Body, p.CreatedAt)
	return err
}

func (s *PostStore) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, author_id, kind, body, created_at FROM posts`
	var args []any
	if before != "" {
		q += ` WHERE id < $1`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Post
	for rows.Next() {
		var p store.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.Kind, &p.Body, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *PostStore) Like(ctx context.Context, postID, userID string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, postID, userID)
	return err
}

func (s *PostStore) Unlike(ctx context.Context, postID, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, postID, userID)
	return err
}

func (s *PostStore) LikeCount(ctx context.Context, postID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM post_likes WHERE post_id=$1`, postID).Scan(&n)
	return n, err
}

func (s *PostStore) AddComment(ctx context.Context, c store.Comment) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO post_comments (id, post_id, author_id, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
		c.ID, c.PostID, c.AuthorID, c.Body, c.CreatedAt)
	return err
}

func (s *PostStore) ListComments(ctx context.Context, postID string) ([]store.Comment, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, post_id, author_id, body, created_at FROM post_comments WHERE post_id=$1 ORDER BY id`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Comment
	for rows.Next() {
		var c store.Comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *PostStore) PostExists(ctx context.Context, postID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM posts WHERE id=$1`, postID).Scan(&x)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
