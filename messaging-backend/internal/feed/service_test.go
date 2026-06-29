package feed

import (
	"context"
	"errors"
	"testing"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Posts, rt), st, rt
}

func TestCreatePostPersistsAndBroadcasts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", "founder", protocol.CreatePostPayload{Kind: "update", Body: "shipped!"}, []string{"u2", "u3"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if post.ID == "" {
		t.Fatal("empty post id")
	}
	posts, _ := st.Posts.ListPosts(ctx, "", 10)
	if len(posts) != 1 || posts[0].Body != "shipped!" {
		t.Fatalf("not persisted: %v", posts)
	}
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypePostNew {
		t.Errorf("u2 missed post.new: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("author should not be broadcast to")
	}
}

func TestLikeBroadcastsAndCounts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "x"})
	n, err := svc.Like(ctx, "p1", "u2", []string{"u1", "u3"})
	if err != nil {
		t.Fatalf("like: %v", err)
	}
	if n != 1 {
		t.Errorf("like count = %d, want 1", n)
	}
	if len(rt.Sent["u1"]) == 0 || rt.Sent["u1"][0].Type != protocol.TypePostLiked {
		t.Errorf("u1 missed post.liked: %v", rt.Sent["u1"])
	}
}

func TestLikeMissingPostFails(t *testing.T) {
	svc, _, _ := newSvc()
	if _, err := svc.Like(context.Background(), "ghost", "u2", nil); err == nil {
		t.Fatal("expected error liking nonexistent post")
	}
}

func TestAddCommentBroadcasts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "x"})
	c, err := svc.AddComment(ctx, "p1", "u2", protocol.CommentPayload{Body: "great"}, []string{"u1"})
	if err != nil {
		t.Fatalf("comment: %v", err)
	}
	if c.ID == "" {
		t.Fatal("empty comment id")
	}
	if len(rt.Sent["u1"]) == 0 || rt.Sent["u1"][0].Type != protocol.TypePostComment {
		t.Errorf("u1 missed post.comment: %v", rt.Sent["u1"])
	}
}

func TestCreatePostStampsRoleAndAudience(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", "founder", protocol.CreatePostPayload{Kind: "update", Body: "hi", Audience: []string{"collaborator", "bogus"}}, []string{"u2"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if post.AuthorRole != "founder" {
		t.Errorf("author role = %q", post.AuthorRole)
	}
	stored, _ := st.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 10)
	if len(stored) != 1 {
		t.Fatalf("collaborator should see the targeted post, got %d", len(stored))
	}
	// broadcast envelope carries authorRole + audience
	if env := rt.Sent["u2"]; len(env) == 0 || env[0].Type != protocol.TypePostNew {
		t.Fatalf("u2 missed post.new")
	}
}

func TestListByZoneDelegates(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "f", AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "x"})
	out, err := svc.ListByZone(ctx, "investor", "global", "", 10)
	if err != nil || len(out) != 1 {
		t.Fatalf("ListByZone: %v len=%d", err, len(out))
	}
}

func TestCreatePostRejectsInvalidKindForRole(t *testing.T) {
	svc, _, _ := newSvc()
	ctx := context.Background()
	_, err := svc.CreatePost(ctx, "u1", "collaborator",
		protocol.CreatePostPayload{Kind: "investment-signal", Body: "x"}, nil)
	if !errors.Is(err, ErrInvalidKind) {
		t.Fatalf("want ErrInvalidKind, got %v", err)
	}
}

func TestCreatePostAcceptsRoleKind(t *testing.T) {
	svc, _, _ := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", "collaborator",
		protocol.CreatePostPayload{Kind: "role-available", Body: "hiring"}, nil)
	if err != nil || post.Kind != "role-available" {
		t.Fatalf("want role-available accepted, got post=%+v err=%v", post, err)
	}
}
