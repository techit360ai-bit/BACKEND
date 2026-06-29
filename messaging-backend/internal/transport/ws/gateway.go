// Package ws is the WebSocket gateway: it authenticates connections, registers
// them with the hub, marks presence, and pumps envelopes between the socket and
// the messaging service.
package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/auth"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/channel"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/hub"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/messaging"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/presence"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

// Deps are the gateway's collaborators.
type Deps struct {
	Hub       *hub.Hub
	Verifier  *auth.Verifier
	Users     store.UserStore
	Messaging *messaging.Service
	Channels  *channel.Service
	Presence  *presence.Service
	// InsecureSkipOriginCheck disables same-origin enforcement (dev/CORS=*).
	InsecureSkipOriginCheck bool
}

// Gateway handles WebSocket upgrades.
type Gateway struct{ d Deps }

func New(d Deps) *Gateway { return &Gateway{d: d} }

const (
	heartbeatInterval = 30 * time.Second
	writeTimeout      = 10 * time.Second
)

// Handle is the http.HandlerFunc for the WS endpoint.
func (g *Gateway) Handle(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	claims, err := g.d.Verifier.Verify(token)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	opts := &websocket.AcceptOptions{}
	if g.d.InsecureSkipOriginCheck {
		opts.InsecureSkipVerify = true
	}
	conn, err := websocket.Accept(w, r, opts)
	if err != nil {
		return
	}
	// The connection outlives the HTTP request, so derive its context from
	// Background — r.Context() cancellation across a WS upgrade is library-
	// dependent and could kill the pumps. cancel() on teardown stops them.
	connCtx, cancel := context.WithCancel(context.Background())

	// Upsert identity from claims (a precondition for sending: messages FK to
	// users). Best-effort but logged — a failure means later sends will error.
	if err := g.d.Users.Upsert(connCtx, store.User{ID: claims.UserID, DisplayName: claims.Name, Role: claims.Role}); err != nil {
		log.Printf("ws: user upsert failed for %s: %v", claims.UserID, err)
	}

	c := hub.NewConn(claims.UserID)
	g.d.Hub.Register(c)
	_ = g.d.Presence.Online(connCtx, claims.UserID)

	defer func() {
		cancel()
		g.d.Hub.Unregister(c)
		_ = g.d.Presence.Offline(context.Background(), claims.UserID)
		conn.Close(websocket.StatusNormalClosure, "bye")
	}()

	go g.writePump(connCtx, conn, c)
	g.readPump(connCtx, conn, claims.UserID)
}

// writePump drains the conn's outbound queue and sends heartbeats.
func (g *Gateway) writePump(ctx context.Context, conn *websocket.Conn, c *hub.Conn) {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case env := <-c.Out():
			raw, err := json.Marshal(env)
			if err != nil {
				continue
			}
			wctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err = conn.Write(wctx, websocket.MessageText, raw)
			cancel()
			if err != nil {
				return
			}
		case <-ticker.C:
			pctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

// readPump reads inbound envelopes and dispatches them to the messaging service.
func (g *Gateway) readPump(ctx context.Context, conn *websocket.Conn, userID string) {
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var env protocol.Envelope
		if json.Unmarshal(data, &env) != nil {
			continue
		}
		g.dispatch(ctx, userID, env)
	}
}

func (g *Gateway) dispatch(ctx context.Context, userID string, env protocol.Envelope) {
	switch env.Type {
	case protocol.TypeMessageSend:
		var p protocol.SendPayload
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		// Route by target: channelId set -> channel send; else DM. Each branch
		// produces its own package's AckResult; both emit a message.ack.
		if p.ChannelID != "" {
			a, err := g.d.Channels.SendChannel(ctx, userID, p)
			if err != nil {
				g.sendError(ctx, userID, "send_failed", err.Error())
				return
			}
			g.send(ctx, userID, protocol.TypeMessageAck, map[string]any{
				"clientMsgId": a.ClientMsgID, "msgId": a.MsgID, "ts": a.TS,
			})
			return
		}
		a, err := g.d.Messaging.SendDM(ctx, userID, p)
		if err != nil {
			g.sendError(ctx, userID, "send_failed", err.Error())
			return
		}
		g.send(ctx, userID, protocol.TypeMessageAck, map[string]any{
			"clientMsgId": a.ClientMsgID, "msgId": a.MsgID, "ts": a.TS,
		})
	case protocol.TypeReadUpto:
		var p protocol.ReadUptoPayload
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		if err := g.d.Messaging.MarkRead(ctx, userID, p); err != nil {
			g.sendError(ctx, userID, "read_failed", err.Error())
		}
	case protocol.TypeTypingStart, protocol.TypeTypingStop:
		var p protocol.ReadUptoPayload // reuses the {convId?, channelId?} shape
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		if p.ChannelID != "" {
			_ = g.d.Channels.RelayTyping(ctx, userID, p.ChannelID, env.Type == protocol.TypeTypingStart)
		}
		// DM typing relay deferred to a later phase (needs conv participant lookup).
	}
}

func (g *Gateway) send(ctx context.Context, userID, typ string, data map[string]any) {
	raw, _ := json.Marshal(data)
	_, _ = g.d.Hub.RouteToUser(ctx, userID, protocol.Envelope{
		Type: typ, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw,
	})
}

func (g *Gateway) sendError(ctx context.Context, userID, code, msg string) {
	g.send(ctx, userID, protocol.TypeError, map[string]any{"code": code, "message": msg})
}
