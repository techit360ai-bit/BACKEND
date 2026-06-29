package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/auth"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/channel"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/hub"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/messaging"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/presence"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/pubsub"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

func newTestGateway(t *testing.T) (*httptest.Server, *auth.Verifier, *store.FakeStores) {
	t.Helper()
	st := store.NewFakeStores()
	h := hub.New(pubsub.NewInMemory())
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go h.Run(ctx)
	ver := auth.NewVerifier("test-secret")
	msg := messaging.New(st.Conversations, st.Messages, h)
	chSvc := channel.New(st.Channels, h)
	pres := presence.New(presence.NewInMemoryStore(), nil)
	gw := New(Deps{Hub: h, Verifier: ver, Users: st.Users, Messaging: msg, Channels: chSvc, Presence: pres, InsecureSkipOriginCheck: true})
	srv := httptest.NewServer(http.HandlerFunc(gw.Handle))
	t.Cleanup(srv.Close)
	return srv, ver, st
}

func wsURL(httpURL, token string) string {
	return "ws" + strings.TrimPrefix(httpURL, "http") + "/?token=" + token
}

func TestGatewayAuthRejectsBadToken(t *testing.T) {
	srv, _, _ := newTestGateway(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	c, _, err := websocket.Dial(ctx, wsURL(srv.URL, "garbage"), nil)
	if err == nil {
		c.Close(websocket.StatusNormalClosure, "")
		t.Fatal("expected dial/handshake failure for bad token")
	}
}

func TestGatewayDeliversDM(t *testing.T) {
	srv, ver, st := newTestGateway(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	conv, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")

	tokA, _ := ver.Mint("u1", "U1", "founder")
	tokB, _ := ver.Mint("u2", "U2", "founder")

	dctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	connB, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokB), nil)
	if err != nil {
		t.Fatalf("B dial: %v", err)
	}
	defer connB.Close(websocket.StatusNormalClosure, "")
	connA, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokA), nil)
	if err != nil {
		t.Fatalf("A dial: %v", err)
	}
	defer connA.Close(websocket.StatusNormalClosure, "")
	time.Sleep(100 * time.Millisecond) // registration

	send := protocol.Envelope{Type: protocol.TypeMessageSend, ID: protocol.NewMsgID()}
	send.Data, _ = json.Marshal(protocol.SendPayload{ConvID: conv.ID, ClientMsgID: "c1", Type: "text", Body: "hi B"})
	raw, _ := json.Marshal(send)
	if err := connA.Write(dctx, websocket.MessageText, raw); err != nil {
		t.Fatalf("A write: %v", err)
	}

	got := readEnvelope(t, dctx, connB)
	if got.Type != protocol.TypeMessageNew {
		t.Fatalf("B expected message.new, got %s", got.Type)
	}
	if !awaitType(t, dctx, connA, protocol.TypeMessageAck) {
		t.Fatal("A did not receive ack")
	}
}

func readEnvelope(t *testing.T, ctx context.Context, c *websocket.Conn) protocol.Envelope {
	t.Helper()
	_, data, err := c.Read(ctx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var env protocol.Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return env
}

func awaitType(t *testing.T, ctx context.Context, c *websocket.Conn, want string) bool {
	t.Helper()
	for i := 0; i < 5; i++ {
		env := readEnvelope(t, ctx, c)
		if env.Type == want {
			return true
		}
	}
	return false
}

func TestGatewayDeliversChannelMessage(t *testing.T) {
	srv, ver, st := newTestGateway(t)
	ctx := context.Background()
	st.Channels.AddMember("chX", "u1")
	st.Channels.AddMember("chX", "u2")
	tokA, _ := ver.Mint("u1", "U1", "founder")
	tokB, _ := ver.Mint("u2", "U2", "founder")

	dctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	connB, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokB), nil)
	if err != nil {
		t.Fatalf("B dial: %v", err)
	}
	defer connB.Close(websocket.StatusNormalClosure, "")
	connA, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokA), nil)
	if err != nil {
		t.Fatalf("A dial: %v", err)
	}
	defer connA.Close(websocket.StatusNormalClosure, "")
	time.Sleep(100 * time.Millisecond)

	send := protocol.Envelope{Type: protocol.TypeMessageSend, ID: protocol.NewMsgID()}
	send.Data, _ = json.Marshal(protocol.SendPayload{ChannelID: "chX", ClientMsgID: "c1", Type: "text", Body: "hi chan"})
	raw, _ := json.Marshal(send)
	if err := connA.Write(dctx, websocket.MessageText, raw); err != nil {
		t.Fatalf("A write: %v", err)
	}
	got := readEnvelope(t, dctx, connB)
	if got.Type != protocol.TypeMessageNew {
		t.Fatalf("B expected message.new, got %s", got.Type)
	}
}
