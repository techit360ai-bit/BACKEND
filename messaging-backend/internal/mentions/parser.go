package mentions

import (
	"context"
	"regexp"
	"strings"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

const MaxMentions = 10

var tokenPattern = regexp.MustCompile(`(^|[^A-Za-z0-9_])@([A-Za-z0-9_][A-Za-z0-9_.-]{1,29})`)

func Resolve(ctx context.Context, users store.UserStore, body string) []store.Mention {
	if users == nil || body == "" {
		return nil
	}
	matches := tokenPattern.FindAllStringSubmatchIndex(body, MaxMentions*2)
	out := make([]store.Mention, 0, MaxMentions)
	seen := map[string]bool{}
	for _, match := range matches {
		if len(out) >= MaxMentions || len(match) < 6 {
			break
		}
		start, end := match[4]-1, match[5]
		username := body[match[4]:match[5]]
		user, err := users.GetByUsername(ctx, username)
		if err != nil || seen[user.ID] {
			continue
		}
		seen[user.ID] = true
		out = append(out, store.Mention{UserID: user.ID, Username: user.Username, Start: start, End: end})
	}
	return out
}

func UserIDs(items []store.Mention, exclude string) []string {
	out := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		if item.UserID == "" || item.UserID == exclude || seen[item.UserID] {
			continue
		}
		seen[item.UserID] = true
		out = append(out, item.UserID)
	}
	return out
}

func NormalizeUsername(value string) string { return strings.TrimPrefix(strings.TrimSpace(value), "@") }
