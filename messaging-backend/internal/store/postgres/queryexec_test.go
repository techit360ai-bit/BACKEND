package postgres

import (
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestQueryExecModeResolution(t *testing.T) {
	cases := []struct {
		input string
		want  pgx.QueryExecMode
	}{
		{"exec", pgx.QueryExecModeExec},
		{"EXEC", pgx.QueryExecModeExec},
		{"simple_protocol", pgx.QueryExecModeSimpleProtocol},
		{"cache_statement", pgx.QueryExecModeCacheStatement},
	}
	for _, tc := range cases {
		got, ok := queryExecMode(tc.input)
		if !ok || got != tc.want {
			t.Fatalf("queryExecMode(%q) = (%v, %v), want (%v, true)", tc.input, got, ok, tc.want)
		}
	}
	if _, ok := queryExecMode("nonsense"); ok {
		t.Fatalf("unknown mode must not resolve, keeping the pgx default")
	}
}
