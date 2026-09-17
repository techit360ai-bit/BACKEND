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

type Person struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Username          string `json:"username"`
	Role              string `json:"role"`
	AvatarURL         string `json:"avatarUrl"`
	Verified          bool   `json:"isVerified"`
	Subscriber        bool   `json:"subscriber"`
	SubscriptionLabel string `json:"subscriptionLabel"`
	CredibilityScore  int    `json:"credibilityScore"`
	CredibilityLevel  string `json:"credibilityLevel"`
	SharedContext     bool   `json:"sharedContext"`
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

func (c *Client) SearchPeople(ctx context.Context, token, query string, limit int) ([]Person, error) {
	if c == nil {
		return nil, fmt.Errorf("identity integration disabled")
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	values := url.Values{"q": []string{query}, "limit": []string{fmt.Sprint(limit)}}
	body, status, err := c.get(ctx, token, "/api/users?"+values.Encode())
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("identity search status %d", status)
	}
	var payload struct {
		Users []Person `json:"users"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload.Users, nil
}

func (c *Client) Person(ctx context.Context, token, userID string) (Person, error) {
	if c == nil {
		return Person{}, fmt.Errorf("identity integration disabled")
	}
	body, status, err := c.get(ctx, token, "/api/users/"+url.PathEscape(userID))
	if err != nil {
		return Person{}, err
	}
	if status == http.StatusNotFound {
		return Person{}, storeNotFound{}
	}
	if status < 200 || status >= 300 {
		return Person{}, fmt.Errorf("identity lookup status %d", status)
	}
	var person Person
	if err := json.Unmarshal(body, &person); err != nil {
		return Person{}, err
	}
	return person, nil
}

type storeNotFound struct{}

func (storeNotFound) Error() string { return "identity not found" }

func (c *Client) get(ctx context.Context, token, path string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
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
