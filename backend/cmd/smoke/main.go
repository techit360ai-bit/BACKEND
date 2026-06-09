// Command smoke is an end-to-end check: it mints two dev tokens via the running
// server, opens a WS for the recipient, sends a DM from the sender via REST, and
// asserts the recipient receives message.new over the socket.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func base() string {
	if v := os.Getenv("SMOKE_BASE"); v != "" {
		return v
	}
	return "http://localhost:8080"
}

func devToken(userID string) (string, error) {
	u := base() + "/api/v1/dev/token?userId=" + url.QueryEscape(userID) + "&name=" + url.QueryEscape(userID)
	resp, err := http.Get(u)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("dev token %d: %s", resp.StatusCode, b)
	}
	var out struct{ Token string }
	if err := json.Unmarshal(b, &out); err != nil {
		return "", err
	}
	return out.Token, nil
}

func authPostJSON(ctx context.Context, path, token string, body any) (*http.Response, error) {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", base()+path, bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

func decode(resp *http.Response, v any) {
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		fail(fmt.Sprintf("status %d: %s", resp.StatusCode, b))
	}
	must(json.Unmarshal(b, v), "decode")
}

func must(err error, what string) {
	if err != nil {
		fail(what + ": " + err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "SMOKE FAIL:", msg)
	os.Exit(1)
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	tokA, err := devToken("smokeA")
	must(err, "mint A")
	tokB, err := devToken("smokeB")
	must(err, "mint B")

	// create conversation A<->B
	resp, err := authPostJSON(ctx, "/api/v1/conversations", tokA, map[string]string{"userId": "smokeB"})
	must(err, "create conv")
	var conv struct {
		ID string `json:"id"`
	}
	decode(resp, &conv)
	if conv.ID == "" {
		fail("no conversation id")
	}

	// open WS for B
	wsbase := "ws" + base()[len("http"):]
	connB, _, err := websocket.Dial(ctx, wsbase+"/ws?token="+tokB, nil)
	must(err, "B dial")
	defer connB.Close(websocket.StatusNormalClosure, "")
	time.Sleep(300 * time.Millisecond)

	// A sends via REST (exercises persist + route)
	resp, err = authPostJSON(ctx, "/api/v1/conversations/"+conv.ID+"/messages", tokA,
		map[string]string{"clientMsgId": "s1", "type": "text", "body": "smoke hello"})
	must(err, "A send")
	if resp.StatusCode != 200 {
		fail("send status " + resp.Status)
	}
	resp.Body.Close()

	// B must receive message.new
	rctx, rcancel := context.WithTimeout(ctx, 5*time.Second)
	defer rcancel()
	_, data, err := connB.Read(rctx)
	must(err, "B read")
	var env protocol.Envelope
	must(json.Unmarshal(data, &env), "B decode")
	if env.Type != protocol.TypeMessageNew {
		fail("B expected message.new, got " + env.Type)
	}
	fmt.Println("SMOKE OK: B received", env.Type)
}
