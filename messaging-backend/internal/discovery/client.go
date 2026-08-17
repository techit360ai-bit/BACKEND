package discovery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Event struct {
	Token      string
	EventType  string
	EntityType string
	EntityID   string
	Surface    string
	Metadata   map[string]any
}

type Client struct {
	base string
	http *http.Client
	jobs chan Event
}

func New(ctx context.Context, base string) *Client {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		return nil
	}
	c := &Client{base: base, http: &http.Client{Timeout: 3 * time.Second}, jobs: make(chan Event, 1024)}
	for i := 0; i < 2; i++ {
		go c.run(ctx)
	}
	return c
}

func (c *Client) Enqueue(event Event) {
	if c == nil || event.Token == "" || event.EventType == "" {
		return
	}
	select {
	case c.jobs <- event:
	default:
	}
}

func (c *Client) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-c.jobs:
			_ = c.send(ctx, event)
		}
	}
}

func (c *Client) send(ctx context.Context, event Event) error {
	body, _ := json.Marshal(map[string]any{
		"eventType": event.EventType, "entityType": event.EntityType,
		"entityId": event.EntityID, "surface": event.Surface, "metadata": event.Metadata,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/api/discovery/events", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", event.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("discovery event status %d", res.StatusCode)
	}
	return nil
}

func (c *Client) Modules(ctx context.Context, token string, query url.Values) ([]byte, int, error) {
	if c == nil {
		return nil, http.StatusServiceUnavailable, fmt.Errorf("discovery integration disabled")
	}
	endpoint := c.base + "/api/discovery/recommendations?surface=feed"
	if encoded := query.Encode(); encoded != "" {
		endpoint += "&" + encoded
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", token)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	return body, res.StatusCode, err
}
