package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/channel"
	"github.com/techit360ai-bit/new-frontend/backend/internal/feed"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newAPI(t *testing.T) (http.Handler, *auth.Verifier, *store.FakeStores) {
	st := store.NewFakeStores()
	ver := auth.NewVerifier("s")
	h := hub.New(pubsub.NewInMemory())
	msg := messaging.New(st.Conversations, st.Messages, h)
	chSvc := channel.New(st.Channels, h)
	feedSvc := feed.New(st.Posts, h)
	pres := presence.New(presence.NewInMemoryStore(), nil)
	r := NewRouter(Deps{
		Verifier: ver, Users: st.Users, Conversations: st.Conversations,
		Messages: st.Messages, Messaging: msg, Channels: chSvc, ChannelStore: st.Channels,
		Feed: feedSvc, Presence: pres, EnableDevToken: true,
	})
	return r, ver, st
}

func TestHealthOK(t *testing.T) {
	r, _, _ := newAPI(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/health", nil))
	if rec.Code != 200 {
		t.Fatalf("health code=%d", rec.Code)
	}
}

func TestDevTokenMints(t *testing.T) {
	r, ver, _ := newAPI(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/dev/token?userId=u1&name=U1&role=founder", nil))
	if rec.Code != 200 {
		t.Fatalf("code=%d body=%s", rec.Code, rec.Body)
	}
	var resp struct{ Token string }
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if _, err := ver.Verify(resp.Token); err != nil {
		t.Fatalf("minted token invalid: %v", err)
	}
}

func TestCreateConversationRequiresAuth(t *testing.T) {
	r, _, _ := newAPI(t)
	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"userId": "u2"})
	r.ServeHTTP(rec, httptest.NewRequest("POST", "/api/v1/conversations", bytes.NewReader(body)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rec.Code)
	}
}

func TestCreateConversationAndHistory(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"userId": "u2"})
	req := httptest.NewRequest("POST", "/api/v1/conversations", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}
	var conv struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &conv)
	if conv.ID == "" {
		t.Fatal("no conversation id")
	}

	rec = httptest.NewRecorder()
	sb, _ := json.Marshal(map[string]string{"clientMsgId": "m1", "body": "hi", "type": "text"})
	req = httptest.NewRequest("POST", "/api/v1/conversations/"+conv.ID+"/messages", bytes.NewReader(sb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("send code=%d body=%s", rec.Code, rec.Body)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/conversations/"+conv.ID+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("history code=%d", rec.Code)
	}
	var hist struct {
		Messages []map[string]any
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &hist)
	if len(hist.Messages) != 1 {
		t.Fatalf("want 1 message, got %d (%s)", len(hist.Messages), rec.Body)
	}
}

func TestChannelSendAndHistory(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	st.Channels.AddMember("ch1", "u1")
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	sb, _ := json.Marshal(map[string]string{"clientMsgId": "m1", "type": "text", "body": "hi chan"})
	req := httptest.NewRequest("POST", "/api/v1/channels/ch1/messages", bytes.NewReader(sb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("send code=%d body=%s", rec.Code, rec.Body)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/channels/ch1/messages", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("history code=%d", rec.Code)
	}
	var hist struct{ Messages []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &hist)
	if len(hist.Messages) != 1 {
		t.Fatalf("want 1 channel message, got %d", len(hist.Messages))
	}
}

func TestCreateAndListPosts(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]string{"kind": "update", "body": "shipped v1"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}
	var created struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" {
		t.Fatal("no post id")
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	var list struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Posts) != 1 {
		t.Fatalf("want 1 post, got %d", len(list.Posts))
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/posts/"+created.ID+"/like", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("like code=%d", rec.Code)
	}
}

func TestFeedZoneFiltering(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "f1", DisplayName: "F"})
	_ = st.Users.Upsert(ctx, store.User{ID: "c1", DisplayName: "C"})
	// founder posts to all; org posts targeting collaborators
	founderTok, _ := ver.Mint("f1", "F", "founder")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "update", "body": "founder post"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+founderTok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}

	orgTok, _ := ver.Mint("o1", "O", "organisation")
	rec = httptest.NewRecorder()
	pb, _ = json.Marshal(map[string]any{"kind": "opportunity", "body": "role open", "audience": []string{"collaborator"}})
	req = httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+orgTok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("org create code=%d body=%s", rec.Code, rec.Body)
	}

	collabTok, _ := ver.Mint("c1", "C", "collaborator")
	// tribe: collaborator sees only the org post (targeted), not the founder all-post
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts?zone=tribe", nil)
	req.Header.Set("Authorization", "Bearer "+collabTok)
	r.ServeHTTP(rec, req)
	var tribe struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &tribe)
	if len(tribe.Posts) != 1 || tribe.Posts[0]["body"] != "role open" {
		t.Fatalf("tribe wrong: %s", rec.Body)
	}
	// global: collaborator sees both
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts?zone=global", nil)
	req.Header.Set("Authorization", "Bearer "+collabTok)
	r.ServeHTTP(rec, req)
	var global struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &global)
	if len(global.Posts) != 2 {
		t.Fatalf("global want 2, got %d", len(global.Posts))
	}
}

func TestListConversationsEndpoint(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	_ = st.Messages.InsertDM(ctx, store.Message{ID: "01890000-0000-7000-8000-0000000000f1", ConversationID: c.ID, SenderID: "u2", Type: "text", Body: "hello"}, "u1", "x")
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/conversations", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("code=%d body=%s", rec.Code, rec.Body)
	}
	var resp struct {
		Conversations []map[string]any
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if len(resp.Conversations) != 1 {
		t.Fatalf("want 1 conversation, got %d", len(resp.Conversations))
	}
}
