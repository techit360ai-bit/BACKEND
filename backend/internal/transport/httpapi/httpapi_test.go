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
	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/feed"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/livekit"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/qa"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newAPI(t *testing.T) (http.Handler, *auth.Verifier, *store.FakeStores) {
	st := store.NewFakeStores()
	ver := auth.NewVerifier("s")
	h := hub.New(pubsub.NewInMemory())
	msg := messaging.New(st.Conversations, st.Messages, h)
	chSvc := channel.New(st.Channels, h)
	feedSvc := feed.New(st.Posts, h)
	demoSvc := demo.New(st.Demo)
	qaSvc := qa.New(st.QA, demoSvc, h)
	lkSvc := livekit.New("APItest", "secretsecretsecretsecretsecret12", "wss://test.livekit.cloud")
	pres := presence.New(presence.NewInMemoryStore(), nil)
	r := NewRouter(Deps{
		Verifier: ver, Users: st.Users, Conversations: st.Conversations,
		Messages: st.Messages, Messaging: msg, Channels: chSvc, ChannelStore: st.Channels,
		Feed: feedSvc, Demo: demoSvc, QA: qaSvc, LiveKit: lkSvc, Presence: pres, EnableDevToken: true,
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
	pb, _ = json.Marshal(map[string]any{"kind": "opportunity-post", "body": "role open", "audience": []string{"collaborator"}})
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

func TestCreatePostInvalidKindReturns400(t *testing.T) {
	r, ver, _ := newAPI(t)
	tok, _ := ver.Mint("u1", "U1", "collaborator")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "investment-signal", "body": "x"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("want 400, got %d body=%s", rec.Code, rec.Body)
	}
}

func TestCreatePostValidRoleKindReturns200(t *testing.T) {
	r, ver, _ := newAPI(t)
	tok, _ := ver.Mint("u1", "U1", "collaborator")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "role-available", "body": "hiring"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("want 200, got %d body=%s", rec.Code, rec.Body)
	}
}

func TestDemoLifecycleHTTP(t *testing.T) {
	r, ver, _ := newAPI(t)
	tok, _ := ver.Mint("host1", "Host", "founder")
	auth := map[string]string{"Authorization": "Bearer " + tok}

	do := func(method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
		var rd *bytes.Reader
		if body != "" {
			rd = bytes.NewReader([]byte(body))
		} else {
			rd = bytes.NewReader(nil)
		}
		req := httptest.NewRequest(method, path, rd)
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// create
	rec := do("POST", "/api/v1/demos", `{"kind":"startup","title":"Launch"}`, auth)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("no id in %s", rec.Body)
	}

	// list -> 1
	rec = do("GET", "/api/v1/demos", "", auth)
	var list struct{ Events []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if rec.Code != 200 || len(list.Events) != 1 {
		t.Fatalf("list code=%d n=%d", rec.Code, len(list.Events))
	}

	// get (host) -> 200
	if rec = do("GET", "/api/v1/demos/"+id, "", auth); rec.Code != 200 {
		t.Fatalf("get code=%d", rec.Code)
	}

	// outsider GET -> 403
	otok, _ := ver.Mint("stranger", "S", "founder")
	if rec = do("GET", "/api/v1/demos/"+id, "", map[string]string{"Authorization": "Bearer " + otok}); rec.Code != 403 {
		t.Fatalf("outsider want 403, got %d", rec.Code)
	}

	// invalid transition draft->live -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`, auth); rec.Code != 400 {
		t.Fatalf("bad transition want 400, got %d body=%s", rec.Code, rec.Body)
	}

	// missing id -> 404
	if rec = do("GET", "/api/v1/demos/nope", "", auth); rec.Code != 404 {
		t.Fatalf("missing want 404, got %d", rec.Code)
	}
}

func TestDemoRtcToken(t *testing.T) {
	r, ver, _ := newAPI(t)
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hostHdr := map[string]string{"Authorization": "Bearer " + hostTok}

	do := func(method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// create (draft) then go live
	rec := do("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`, hostHdr)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)

	// invite an audience member while still draft (host-only ok)
	_ = do("POST", "/api/v1/demos/"+id+"/invites", `{"userId":"aud1","roomRole":"audience"}`, hostHdr)

	// not live yet -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", hostHdr); rec.Code != 400 {
		t.Fatalf("pre-live want 400, got %d", rec.Code)
	}

	// go live
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`, hostHdr)
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`, hostHdr)

	// host -> 200, canPublish true, token present
	rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", hostHdr)
	if rec.Code != 200 {
		t.Fatalf("host token want 200, got %d body=%s", rec.Code, rec.Body)
	}
	var hostResp struct {
		Token      string `json:"token"`
		URL        string `json:"url"`
		CanPublish bool   `json:"canPublish"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &hostResp)
	if hostResp.Token == "" || hostResp.URL == "" || !hostResp.CanPublish {
		t.Fatalf("bad host resp: %+v", hostResp)
	}

	// audience -> 200, canPublish false
	audTok, _ := ver.Mint("aud1", "Aud", "founder")
	rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", map[string]string{"Authorization": "Bearer " + audTok})
	var audResp struct {
		CanPublish bool `json:"canPublish"`
	}
	if rec.Code != 200 {
		t.Fatalf("aud token want 200, got %d", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &audResp)
	if audResp.CanPublish {
		t.Fatal("audience must not be allowed to publish")
	}

	// outsider -> 403
	outTok, _ := ver.Mint("stranger", "S", "founder")
	if rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", map[string]string{"Authorization": "Bearer " + outTok}); rec.Code != 403 {
		t.Fatalf("outsider want 403, got %d", rec.Code)
	}
}

func TestDemoRtcTokenUnconfigured(t *testing.T) {
	st := store.NewFakeStores()
	ver := auth.NewVerifier("s")
	demoSvc := demo.New(st.Demo)
	r := NewRouter(Deps{
		Verifier: ver, Users: st.Users, Demo: demoSvc,
		LiveKit: livekit.New("", "", ""), // disabled
	})
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hdr := map[string]string{"Authorization": "Bearer " + hostTok}
	mk := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		req.Header.Set("Authorization", hdr["Authorization"])
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}
	rec := mk("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)
	_ = mk("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`)
	_ = mk("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`)
	if rec = mk("POST", "/api/v1/demos/"+id+"/rtc-token", ""); rec.Code != 503 {
		t.Fatalf("unconfigured want 503, got %d", rec.Code)
	}
}

func TestDemoQAFlow(t *testing.T) {
	r, ver, _ := newAPI(t)
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hostHdr := map[string]string{"Authorization": "Bearer " + hostTok}

	do := func(method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// create + go live
	rec := do("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`, hostHdr)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)

	// ask before live -> 409
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"early?"}`, hostHdr); rec.Code != 409 {
		t.Fatalf("pre-live ask want 409, got %d", rec.Code)
	}
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`, hostHdr)
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`, hostHdr)

	// ask -> 200, question id present
	rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"why this?"}`, hostHdr)
	if rec.Code != 200 {
		t.Fatalf("ask want 200, got %d body=%s", rec.Code, rec.Body)
	}
	var q struct {
		ID    string `json:"id"`
		Body  string `json:"body"`
		State string `json:"state"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &q)
	if q.ID == "" || q.Body != "why this?" || q.State != "open" {
		t.Fatalf("bad question: %+v", q)
	}

	// empty body -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"  "}`, hostHdr); rec.Code != 400 {
		t.Fatalf("empty body want 400, got %d", rec.Code)
	}

	// upvote -> 200, votes=1, mine=true
	rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/upvote", "", hostHdr)
	var uv struct {
		Votes int  `json:"votes"`
		Mine  bool `json:"mine"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &uv)
	if rec.Code != 200 || uv.Votes != 1 || !uv.Mine {
		t.Fatalf("upvote: code=%d %+v", rec.Code, uv)
	}

	// list -> 200, one question with votes=1, mine=true
	rec = do("GET", "/api/v1/demos/"+id+"/questions", "", hostHdr)
	var list struct {
		Questions []struct {
			ID    string `json:"id"`
			Votes int    `json:"votes"`
			Mine  bool   `json:"mine"`
		} `json:"questions"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if rec.Code != 200 || len(list.Questions) != 1 || list.Questions[0].Votes != 1 || !list.Questions[0].Mine {
		t.Fatalf("list: code=%d %+v", rec.Code, list)
	}

	// resolve -> 200, answered
	rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/resolve", `{"state":"answered"}`, hostHdr)
	if rec.Code != 200 {
		t.Fatalf("resolve want 200, got %d body=%s", rec.Code, rec.Body)
	}
	// invalid resolve state -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/resolve", `{"state":"bogus"}`, hostHdr); rec.Code != 400 {
		t.Fatalf("bad state want 400, got %d", rec.Code)
	}

	// outsider ask -> 403
	outTok, _ := ver.Mint("stranger", "S", "founder")
	outHdr := map[string]string{"Authorization": "Bearer " + outTok}
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"hi"}`, outHdr); rec.Code != 403 {
		t.Fatalf("outsider ask want 403, got %d", rec.Code)
	}
}
