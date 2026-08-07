package store

// GenericKinds are post kinds any role may use. The first six are canonical;
// "update" is the legacy default; "build"/"collab" are legacy aliases for
// "build-update"/"collab-call" kept valid so older clients/posts don't break.
var GenericKinds = map[string]bool{
	"milestone": true, "insight": true, "build-update": true,
	"collab-call": true, "question": true, "problem": true,
	"update": true, "build": true, "collab": true,
}

// RoleKinds are the role-specific post kinds added on top of GenericKinds,
// keyed by normalized role.
var RoleKinds = map[string][]string{
	"collaborator": {"contribution-update", "skill-showcase", "role-available"},
	"investor":     {"investment-signal", "portfolio-update", "thesis-post"},
	"organisation": {"opportunity-post", "programme-announcement", "community-spotlight"},
}

// AllowedKind reports whether kind may be posted by role
// (generic ∪ role-specific for the normalized role).
func AllowedKind(role, kind string) bool {
	if GenericKinds[kind] {
		return true
	}
	for _, k := range RoleKinds[NormalizeRole(role)] {
		if k == kind {
			return true
		}
	}
	return false
}

// CategoryForKind keeps the new discovery taxonomy compatible with persisted
// post kinds and older clients.
func CategoryForKind(kind string) string {
	switch kind {
	case "milestone", "build-update", "build", "update": return "startups"
	case "investment-signal", "portfolio-update", "thesis-post": return "funding"
	case "opportunity-post", "programme-announcement", "community-spotlight": return "organizations"
	case "question", "problem", "insight", "skill-showcase": return "learning"
	case "collab-call", "contribution-update", "role-available": return "startups"
	default: return "startups"
	}
}

func MatchesCategory(kind, category string) bool {
	if category == "" || category == "for-you" || category == "following" || category == "ai-recommendations" { return true }
	return CategoryForKind(kind) == category
}
