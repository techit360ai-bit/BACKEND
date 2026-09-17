package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type PostStore struct{ pool *pgxpool.Pool }

func feedBodyHash(value string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(value))) }

func (s *PostStore) CreatePost(ctx context.Context, p store.Post) error {
	aud := p.Audience
	if len(aud) == 0 {
		aud = []string{"all"}
	}
	role := p.AuthorRole
	if role == "" {
		role = "community"
	}
	mentions, _ := json.Marshal(p.Mentions)
	_, err := s.pool.Exec(ctx, `INSERT INTO posts (id, author_id, author_role, audience, kind, body, mentions, created_at, expires_at, content_fingerprint, moderation_status, abuse_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE(NULLIF($11,''),'visible'),$12)`,
		p.ID, p.AuthorID, role, aud, p.Kind, p.Body, mentions, p.CreatedAt, p.ExpiresAt, p.ContentFingerprint, p.ModerationStatus, p.AbuseScore)
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
	q := `SELECT id, author_id, author_role, audience, kind, body, mentions, created_at, expires_at, content_fingerprint, moderation_status, abuse_score, edited_at, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM posts`
	// Expired opportunities/posts are never eligible for discovery. Posts with
	// no expiry remain valid indefinitely.
	conds := []string{"deleted_at IS NULL", "(expires_at IS NULL OR expires_at > now())", "moderation_status <> 'blocked'", "abuse_score < 5"}
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
		var mentions []byte
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.AuthorRole, &p.Audience, &p.Kind, &p.Body, &mentions, &p.CreatedAt, &p.ExpiresAt, &p.ContentFingerprint, &p.ModerationStatus, &p.AbuseScore, &p.EditedAt, &p.EditVersion, &p.DeletedAt, &p.DeletedBy); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(mentions, &p.Mentions)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *PostStore) EditPost(ctx context.Context, postID, actorID, body string, expectedVersion int, now time.Time) (store.Post, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Post{}, err }; defer tx.Rollback(ctx)
	var p store.Post; var mentions []byte; var deleted *time.Time; var version int
	err = tx.QueryRow(ctx, `SELECT id, author_id, author_role, audience, kind, body, mentions, created_at, expires_at, content_fingerprint, moderation_status, abuse_score, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM posts WHERE id=$1 FOR UPDATE`, postID).Scan(&p.ID, &p.AuthorID, &p.AuthorRole, &p.Audience, &p.Kind, &p.Body, &mentions, &p.CreatedAt, &p.ExpiresAt, &p.ContentFingerprint, &p.ModerationStatus, &p.AbuseScore, &version, &deleted, &p.DeletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Post{}, store.ErrNotFound }; if err != nil { return store.Post{}, err }; if p.AuthorID != actorID { return store.Post{}, errors.New("post edit forbidden") }; if deleted != nil { return store.Post{}, errors.New("post deleted") }; if now.Sub(p.CreatedAt) > 15*time.Minute { return store.Post{}, errors.New("post edit window expired") }; if version != expectedVersion { return store.Post{}, errors.New("post version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE posts SET body=$2, edited_at=$3, edit_version=edit_version+1 WHERE id=$1`, postID, body, now); err != nil { return store.Post{}, err }; if _, err = tx.Exec(ctx, `INSERT INTO feed_mutation_audit (id,entity_type,entity_id,actor_id,action,previous_hash,new_hash) VALUES ($1,'post',$2,$3,'edit',$4,$5)`, uuid.New(), postID, actorID, feedBodyHash(p.Body), feedBodyHash(body)); err != nil { return store.Post{}, err }
	_ = json.Unmarshal(mentions, &p.Mentions); p.Body = body; p.EditedAt = &now; p.EditVersion = version + 1; return p, tx.Commit(ctx)
}

func (s *PostStore) DeletePost(ctx context.Context, postID, actorID string, expectedVersion int, now time.Time) (store.Post, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Post{}, err }; defer tx.Rollback(ctx)
	var p store.Post; var deleted *time.Time; var version int
	err = tx.QueryRow(ctx, `SELECT id, author_id, author_role, audience, kind, body, created_at, expires_at, content_fingerprint, moderation_status, abuse_score, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM posts WHERE id=$1 FOR UPDATE`, postID).Scan(&p.ID, &p.AuthorID, &p.AuthorRole, &p.Audience, &p.Kind, &p.Body, &p.CreatedAt, &p.ExpiresAt, &p.ContentFingerprint, &p.ModerationStatus, &p.AbuseScore, &version, &deleted, &p.DeletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Post{}, store.ErrNotFound }; if err != nil { return store.Post{}, err }; if p.AuthorID != actorID { return store.Post{}, errors.New("post delete forbidden") }; if deleted != nil { return p, nil }; if version != expectedVersion { return store.Post{}, errors.New("post version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE posts SET deleted_at=$2, deleted_by=$3, edit_version=edit_version+1 WHERE id=$1`, postID, now, actorID); err != nil { return store.Post{}, err }; if _, err = tx.Exec(ctx, `INSERT INTO feed_mutation_audit (id,entity_type,entity_id,actor_id,action,previous_hash) VALUES ($1,'post',$2,$3,'delete',$4)`, uuid.New(), postID, actorID, feedBodyHash(p.Body)); err != nil { return store.Post{}, err }
	p.DeletedAt = &now; p.DeletedBy = actorID; p.EditVersion = version + 1; return p, tx.Commit(ctx)
}

func (s *PostStore) EditComment(ctx context.Context, commentID, actorID, body string, expectedVersion int, now time.Time) (store.Comment, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Comment{}, err }; defer tx.Rollback(ctx)
	var c store.Comment; var deleted *time.Time; var version int; var mentions []byte
	err = tx.QueryRow(ctx, `SELECT id, post_id, author_id, body, mentions, created_at, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM post_comments WHERE id=$1 FOR UPDATE`, commentID).Scan(&c.ID, &c.PostID, &c.AuthorID, &c.Body, &mentions, &c.CreatedAt, &version, &deleted, &c.DeletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Comment{}, store.ErrNotFound }; if err != nil { return store.Comment{}, err }; if c.AuthorID != actorID { return store.Comment{}, errors.New("comment edit forbidden") }; if deleted != nil { return store.Comment{}, errors.New("comment deleted") }; if now.Sub(c.CreatedAt) > 15*time.Minute { return store.Comment{}, errors.New("comment edit window expired") }; if version != expectedVersion { return store.Comment{}, errors.New("comment version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE post_comments SET body=$2, edited_at=$3, edit_version=edit_version+1 WHERE id=$1`, commentID, body, now); err != nil { return store.Comment{}, err }; if _, err = tx.Exec(ctx, `INSERT INTO feed_mutation_audit (id,entity_type,entity_id,actor_id,action,previous_hash,new_hash) VALUES ($1,'comment',$2,$3,'edit',$4,$5)`, uuid.New(), commentID, actorID, feedBodyHash(c.Body), feedBodyHash(body)); err != nil { return store.Comment{}, err }
	_ = json.Unmarshal(mentions, &c.Mentions); c.Body = body; c.EditedAt = &now; c.EditVersion = version + 1; return c, tx.Commit(ctx)
}

func (s *PostStore) DeleteComment(ctx context.Context, commentID, actorID string, expectedVersion int, now time.Time) (store.Comment, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Comment{}, err }; defer tx.Rollback(ctx)
	var c store.Comment; var deleted *time.Time; var version int
	err = tx.QueryRow(ctx, `SELECT id, post_id, author_id, body, created_at, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM post_comments WHERE id=$1 FOR UPDATE`, commentID).Scan(&c.ID, &c.PostID, &c.AuthorID, &c.Body, &c.CreatedAt, &version, &deleted, &c.DeletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Comment{}, store.ErrNotFound }; if err != nil { return store.Comment{}, err }; if c.AuthorID != actorID { return store.Comment{}, errors.New("comment delete forbidden") }; if deleted != nil { return c, nil }; if version != expectedVersion { return store.Comment{}, errors.New("comment version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE post_comments SET deleted_at=$2, deleted_by=$3, edit_version=edit_version+1 WHERE id=$1`, commentID, now, actorID); err != nil { return store.Comment{}, err }; if _, err = tx.Exec(ctx, `INSERT INTO feed_mutation_audit (id,entity_type,entity_id,actor_id,action,previous_hash) VALUES ($1,'comment',$2,$3,'delete',$4)`, uuid.New(), commentID, actorID, feedBodyHash(c.Body)); err != nil { return store.Comment{}, err }
	c.DeletedAt = &now; c.DeletedBy = actorID; c.EditVersion = version + 1; return c, tx.Commit(ctx)
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
	mentions, _ := json.Marshal(c.Mentions)
	_, err := s.pool.Exec(ctx, `INSERT INTO post_comments (id, post_id, author_id, body, mentions, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.PostID, c.AuthorID, c.Body, mentions, c.CreatedAt)
	return err
}

func (s *PostStore) ListComments(ctx context.Context, postID string) ([]store.Comment, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, post_id, author_id, body, mentions, created_at, edited_at, edit_version, deleted_at, COALESCE(deleted_by::text,'') FROM post_comments WHERE post_id=$1 ORDER BY id`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Comment
	for rows.Next() {
		var c store.Comment
		var mentions []byte
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.Body, &mentions, &c.CreatedAt, &c.EditedAt, &c.EditVersion, &c.DeletedAt, &c.DeletedBy); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(mentions, &c.Mentions)
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
	if saved {
		_, err := s.pool.Exec(ctx, `INSERT INTO feed_post_saves (post_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, postID, userID)
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_post_saves WHERE post_id=$1 AND user_id=$2`, postID, userID)
	return err
}

func (s *PostStore) SetPostFeedback(ctx context.Context, postID, userID, feedback string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO feed_post_feedback (post_id,user_id,feedback) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, postID, userID, feedback)
	if err != nil {
		return err
	}
	if feedback == "report" {
		_, err = s.pool.Exec(ctx, `UPDATE posts SET abuse_score = abuse_score + 1, moderation_status = CASE WHEN abuse_score + 1 >= 5 THEN 'blocked' WHEN abuse_score + 1 >= 3 THEN 'pending_review' ELSE moderation_status END WHERE id=$1`, postID)
	}
	return err
}

func (s *PostStore) FollowUser(ctx context.Context, followerID, followeeID string, following bool) error {
	if following {
		_, err := s.pool.Exec(ctx, `INSERT INTO feed_follows (follower_id,followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, followerID, followeeID)
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_follows WHERE follower_id=$1 AND followee_id=$2`, followerID, followeeID)
	return err
}
func (s *PostStore) IsFollowing(ctx context.Context, followerID, followeeID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM feed_follows WHERE follower_id=$1 AND followee_id=$2)`, followerID, followeeID).Scan(&exists)
	return exists, err
}
func (s *PostStore) HasCreatorControl(ctx context.Context, userID, creatorID, control string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM feed_creator_controls WHERE user_id=$1 AND creator_id=$2 AND control=$3)`, userID, creatorID, control).Scan(&exists)
	return exists, err
}

func (s *PostStore) RecordFeedEvent(ctx context.Context, event store.FeedEvent) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO feed_events (id,user_id,post_id,event_type,metadata,created_at) VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6)`, event.ID, event.UserID, event.PostID, event.EventType, event.Metadata, event.CreatedAt)
	return err
}

func (s *PostStore) SuppressedPostIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT p.id FROM posts p LEFT JOIN feed_creator_controls c ON c.creator_id=p.author_id AND c.user_id=$1 WHERE (EXISTS (SELECT 1 FROM feed_post_feedback f WHERE f.post_id=p.id AND f.user_id=$1 AND f.feedback IN ('hide','not_interested','block')) OR c.control IS NOT NULL)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *PostStore) FollowedUserIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT followee_id FROM feed_follows WHERE follower_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *PostStore) SetCreatorControl(ctx context.Context, userID, creatorID, control string, enabled bool) error {
	if enabled {
		_, err := s.pool.Exec(ctx, `INSERT INTO feed_creator_controls (user_id,creator_id,control) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, userID, creatorID, control)
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM feed_creator_controls WHERE user_id=$1 AND creator_id=$2 AND control=$3`, userID, creatorID, control)
	return err
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
		signals, err := json.Marshal(decision.Signals)
		if err != nil {
			return err
		}
		if _, err := s.pool.Exec(ctx, `INSERT INTO feed_ranking_decisions (id,user_id,post_id,category,ranking_version,variant,score,signals,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, decision.ID, decision.UserID, decision.PostID, decision.Category, decision.RankingVersion, decision.Variant, decision.Score, signals, decision.CreatedAt); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostStore) ListRankingDecisions(ctx context.Context, userID string, limit int) ([]store.RankingDecision, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `SELECT id,user_id,post_id,category,ranking_version,variant,score,signals,created_at FROM feed_ranking_decisions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.RankingDecision
	for rows.Next() {
		var d store.RankingDecision
		var raw []byte
		if err := rows.Scan(&d.ID, &d.UserID, &d.PostID, &d.Category, &d.RankingVersion, &d.Variant, &d.Score, &raw, &d.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &d.Signals); err != nil {
			d.Signals = nil
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *PostStore) ListModerationQueue(ctx context.Context, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `SELECT id,author_id,author_role,audience,kind,body,created_at,expires_at,content_fingerprint,moderation_status,abuse_score FROM posts WHERE moderation_status='pending_review' OR abuse_score > 0 ORDER BY abuse_score DESC, created_at DESC LIMIT $1`, limit)
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

func (s *PostStore) ReviewPost(ctx context.Context, postID, reviewerID, status, reason string) error {
	_, err := s.pool.Exec(ctx, `UPDATE posts SET moderation_status=$1, moderation_reason=$2, reviewed_by=$3, reviewed_at=now() WHERE id=$4`, status, reason, reviewerID, postID)
	return err
}
func (s *PostStore) SaveCount(ctx context.Context, postID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM feed_post_saves WHERE post_id=$1`, postID).Scan(&n)
	return n, err
}
func (s *PostStore) ShareCount(ctx context.Context, postID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM feed_events WHERE post_id=$1 AND event_type='share'`, postID).Scan(&n)
	return n, err
}
func (s *PostStore) GetDiscoveryProfile(ctx context.Context, userID string) (store.DiscoveryProfile, error) {
	var p store.DiscoveryProfile
	p.UserID = userID
	err := s.pool.QueryRow(ctx, `SELECT location,skills,industries,interests,credibility,startup_quality,contribution_score FROM feed_discovery_profiles WHERE user_id=$1`, userID).Scan(&p.Location, &p.Skills, &p.Industries, &p.Interests, &p.Credibility, &p.StartupQuality, &p.ContributionScore)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}
func (s *PostStore) UpsertDiscoveryProfile(ctx context.Context, p store.DiscoveryProfile) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO feed_discovery_profiles (user_id,location,skills,industries,interests,credibility,startup_quality,contribution_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) DO UPDATE SET location=EXCLUDED.location,skills=EXCLUDED.skills,industries=EXCLUDED.industries,interests=EXCLUDED.interests,credibility=EXCLUDED.credibility,startup_quality=EXCLUDED.startup_quality,contribution_score=EXCLUDED.contribution_score,updated_at=now()`, p.UserID, p.Location, p.Skills, p.Industries, p.Interests, p.Credibility, p.StartupQuality, p.ContributionScore)
	return err
}
func (s *PostStore) RankingMetrics(ctx context.Context) ([]store.RankingMetrics, error) {
	rows, err := s.pool.Query(ctx, `SELECT d.variant,count(DISTINCT d.id),avg(d.score),count(*) FILTER (WHERE e.event_type='impression'),count(*) FILTER (WHERE e.event_type='open'),count(*) FILTER (WHERE e.event_type='save'),count(*) FILTER (WHERE e.event_type='share') FROM feed_ranking_decisions d LEFT JOIN feed_events e ON e.user_id=d.user_id AND e.post_id=d.post_id AND e.created_at>=d.created_at GROUP BY d.variant`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.RankingMetrics
	for rows.Next() {
		var m store.RankingMetrics
		if err := rows.Scan(&m.Variant, &m.Decisions, &m.AverageScore, &m.Impressions, &m.Opens, &m.Saves, &m.Shares); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (s *PostStore) PostInteractionCount(ctx context.Context, userID, postID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM feed_events WHERE user_id=$1 AND post_id=$2 AND event_type IN ('open','like','comment','save','share')`, userID, postID).Scan(&n)
	return n, err
}
