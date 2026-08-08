package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type PostStore struct{ pool *pgxpool.Pool }

func (s *PostStore) CreatePost(ctx context.Context, p store.Post) error {
	aud := p.Audience
	if len(aud) == 0 {
		aud = []string{"all"}
	}
	role := p.AuthorRole
	if role == "" {
		role = "community"
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO posts (id, author_id, author_role, audience, kind, body, created_at, expires_at, content_fingerprint, moderation_status, abuse_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE(NULLIF($10,''),'visible'),$11)`,
		p.ID, p.AuthorID, role, aud, p.Kind, p.Body, p.CreatedAt, p.ExpiresAt, p.ContentFingerprint, p.ModerationStatus, p.AbuseScore)
	return err
}

func (s *PostStore) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	return s.queryPosts(ctx, "", "", before, limit)
}

func (s *PostStore) ListPostsByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	return s.queryPosts(ctx, viewerRole, zone, before, limit)
}

// queryPosts is the shared reader. zone "tribe" filters to author_role=viewer OR
// viewer = ANY(audience); any other zone returns all posts. Both order newest-first.
func (s *PostStore) queryPosts(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, author_id, author_role, audience, kind, body, created_at, expires_at, content_fingerprint, moderation_status, abuse_score FROM posts`
	// Expired opportunities/posts are never eligible for discovery. Posts with
	// no expiry remain valid indefinitely.
	conds := []string{"(expires_at IS NULL OR expires_at > now())", "moderation_status <> 'blocked'", "abuse_score < 5"}
	args := []any{}
	n := 0
	if zone == "tribe" {
		n++
		conds = append(conds, "(author_role = $"+strconv.Itoa(n)+" OR $"+strconv.Itoa(n)+" = ANY(audience))")
		args = append(args, viewerRole)
	}
	if before != "" {
		n++
		conds = append(conds, "id < $"+strconv.Itoa(n))
		args = append(args, before)
	}
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	q += " ORDER BY id DESC LIMIT " + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Post
	for rows.Next() {
		var p store.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.AuthorRole, &p.Audience, &p.Kind, &p.Body, &p.CreatedAt, &p.ExpiresAt, &p.ContentFingerprint, &p.ModerationStatus, &p.AbuseScore); err != nil {
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

func (s *PostStore) SavePost(ctx context.Context, postID, userID string, saved bool) error {
	if saved { _, err := s.pool.Exec(ctx, `INSERT INTO feed_post_saves (post_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, postID, userID); return err }
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_post_saves WHERE post_id=$1 AND user_id=$2`, postID, userID); return err
}

func (s *PostStore) SetPostFeedback(ctx context.Context, postID, userID, feedback string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO feed_post_feedback (post_id,user_id,feedback) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING` , postID, userID, feedback)
	if err != nil { return err }
	if feedback == "report" {
		_, err = s.pool.Exec(ctx, `UPDATE posts SET abuse_score = abuse_score + 1, moderation_status = CASE WHEN abuse_score + 1 >= 5 THEN 'blocked' WHEN abuse_score + 1 >= 3 THEN 'pending_review' ELSE moderation_status END WHERE id=$1`, postID)
	}
	return err
}

func (s *PostStore) FollowUser(ctx context.Context, followerID, followeeID string, following bool) error {
	if following { _, err := s.pool.Exec(ctx, `INSERT INTO feed_follows (follower_id,followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, followerID, followeeID); return err }
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_follows WHERE follower_id=$1 AND followee_id=$2`, followerID, followeeID); return err
}
func (s *PostStore) IsFollowing(ctx context.Context, followerID, followeeID string) (bool, error) { var exists bool; err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM feed_follows WHERE follower_id=$1 AND followee_id=$2)`, followerID, followeeID).Scan(&exists); return exists, err }

func (s *PostStore) RecordFeedEvent(ctx context.Context, event store.FeedEvent) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO feed_events (id,user_id,post_id,event_type,metadata,created_at) VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6)`, event.ID, event.UserID, event.PostID, event.EventType, event.Metadata, event.CreatedAt); return err
}

func (s *PostStore) SuppressedPostIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT p.id FROM posts p LEFT JOIN feed_creator_controls c ON c.creator_id=p.author_id AND c.user_id=$1 WHERE (EXISTS (SELECT 1 FROM feed_post_feedback f WHERE f.post_id=p.id AND f.user_id=$1 AND f.feedback IN ('hide','not_interested','block')) OR c.control IS NOT NULL)`, userID); if err != nil { return nil, err }; defer rows.Close()
	var out []string; for rows.Next() { var id string; if err := rows.Scan(&id); err != nil { return nil, err }; out = append(out, id) }; return out, rows.Err()
}

func (s *PostStore) FollowedUserIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT followee_id FROM feed_follows WHERE follower_id=$1`, userID); if err != nil { return nil, err }; defer rows.Close()
	var out []string; for rows.Next() { var id string; if err := rows.Scan(&id); err != nil { return nil, err }; out = append(out, id) }; return out, rows.Err()
}

func (s *PostStore) SetCreatorControl(ctx context.Context, userID, creatorID, control string, enabled bool) error {
	if enabled { _, err := s.pool.Exec(ctx, `INSERT INTO feed_creator_controls (user_id,creator_id,control) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, userID, creatorID, control); return err }
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_creator_controls WHERE user_id=$1 AND creator_id=$2 AND control=$3`, userID, creatorID, control); return err
}

func (s *PostStore) FeedEventCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM feed_events WHERE user_id=$1`, userID).Scan(&count)
	return count, err
}

func (s *PostStore) CreatorPostCount(ctx context.Context, creatorID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM posts WHERE author_id=$1`, creatorID).Scan(&count)
	return count, err
}

func (s *PostStore) RecordRankingDecisions(ctx context.Context, decisions []store.RankingDecision) error {
	for _, decision := range decisions {
		signals, err := json.Marshal(decision.Signals); if err != nil { return err }
		if _, err := s.pool.Exec(ctx, `INSERT INTO feed_ranking_decisions (id,user_id,post_id,category,ranking_version,variant,score,signals,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, decision.ID, decision.UserID, decision.PostID, decision.Category, decision.RankingVersion, decision.Variant, decision.Score, signals, decision.CreatedAt); err != nil { return err }
	}
	return nil
}

func (s *PostStore) ListRankingDecisions(ctx context.Context, userID string, limit int) ([]store.RankingDecision, error) {
	if limit <= 0 || limit > 100 { limit = 50 }
	rows, err := s.pool.Query(ctx, `SELECT id,user_id,post_id,category,ranking_version,variant,score,signals,created_at FROM feed_ranking_decisions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, userID, limit); if err != nil { return nil, err }; defer rows.Close()
	var out []store.RankingDecision
	for rows.Next() { var d store.RankingDecision; var raw []byte; if err := rows.Scan(&d.ID,&d.UserID,&d.PostID,&d.Category,&d.RankingVersion,&d.Variant,&d.Score,&raw,&d.CreatedAt); err != nil { return nil, err }; if err := json.Unmarshal(raw, &d.Signals); err != nil { d.Signals = nil }; out = append(out, d) }
	return out, rows.Err()
}
