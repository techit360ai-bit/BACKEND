package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/qa"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func qaErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, demo.ErrEventNotFound), errors.Is(err, qa.ErrQuestionNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, demo.ErrNotParticipant), errors.Is(err, demo.ErrNotHost):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, qa.ErrInvalidState), errors.Is(err, qa.ErrEmptyBody):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, qa.ErrNotLive):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, err.Error())
	}
}

func questionJSON(q store.DemoQuestion) map[string]any {
	return map[string]any{
		"id": q.ID, "eventId": q.EventID, "askerId": q.AskerID, "body": q.Body,
		"state": q.State, "votes": q.Votes, "createdAt": q.CreatedAt,
	}
}

func handleAskQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Body string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		q, err := d.QA.Ask(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Body)
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, questionJSON(q))
	}
}

func handleListQuestions(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		views, err := d.QA.List(r.Context(), chi.URLParam(r, "id"), currentUser(r))
		if err != nil {
			qaErr(w, err)
			return
		}
		out := make([]map[string]any, 0, len(views))
		for _, v := range views {
			m := questionJSON(v.DemoQuestion)
			m["mine"] = v.Mine
			out = append(out, m)
		}
		writeJSON(w, http.StatusOK, map[string]any{"questions": out})
	}
}

func handleUpvoteQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		votes, mine, err := d.QA.Upvote(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "qid"), currentUser(r))
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"questionId": chi.URLParam(r, "qid"), "votes": votes, "mine": mine})
	}
}

func handleResolveQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			State string `json:"state"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		q, err := d.QA.Resolve(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "qid"), currentUser(r), body.State)
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, questionJSON(q))
	}
}
