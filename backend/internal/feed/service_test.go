package feed

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Posts, rt), st, rt
}

func TestCreatePostPersistsAndBroadcasts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", protocol.CreatePostPayload{Kind: "update", Body: "shipped!"}, []string{"u2", "u3"})
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
