package ws

import (
	"reflect"
	"testing"
)

func TestOriginPatterns(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"http://localhost:5173,http://localhost:4173", []string{"localhost:5173", "localhost:4173"}},
		{"https://app.example.com/", []string{"app.example.com"}},
		{"*", nil},
		{"", nil},
		{"HTTPS://App.Example.com, bare.example.com:8443", []string{"app.example.com", "bare.example.com:8443"}},
	}
	for _, tc := range cases {
		if got := OriginPatterns(tc.in); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("OriginPatterns(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
