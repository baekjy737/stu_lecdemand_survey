package middleware

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"log"
	"net/http"
	"sync"
	"time"
)

type SessionStore struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

type Session struct {
	StudentID int
	ExpiresAt time.Time
}

var Store = &SessionStore{
	sessions: make(map[string]*Session),
}

// GenerateToken generates a random session token
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// CreateSession creates a new session for a student
func (s *SessionStore) CreateSession(studentID int) (string, error) {
	token, err := GenerateToken()
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions[token] = &Session{
		StudentID: studentID,
		ExpiresAt: time.Now().Add(2 * time.Hour),
	}

	return token, nil
}

// GetSession retrieves a session by token
func (s *SessionStore) GetSession(token string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[token]
	if !exists {
		return nil, false
	}

	if time.Now().After(session.ExpiresAt) {
		delete(s.sessions, token)
		return nil, false
	}

	return session, true
}

// DeleteSession deletes a session
func (s *SessionStore) DeleteSession(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
}

// GetAllSessions returns a copy of all session tokens (for debugging)
func (s *SessionStore) GetAllSessions() map[string]*Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copy := make(map[string]*Session, len(s.sessions))
	for k, v := range s.sessions {
		copy[k] = v
	}
	return copy
}

// CleanupExpired removes expired sessions
func (s *SessionStore) CleanupExpired() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for token, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			delete(s.sessions, token)
		}
	}
}

// AuthMiddleware checks for valid session
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil {
			log.Printf("[AUTH] No session cookie found: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		log.Printf("[AUTH] Cookie found: %s (first 10 chars)", cookie.Value[:min(10, len(cookie.Value))])

		session, valid := Store.GetSession(cookie.Value)
		if !valid {
			log.Printf("[AUTH] Invalid or expired session for token: %s", cookie.Value[:min(10, len(cookie.Value))])
			log.Printf("[AUTH] Current sessions in store: %d", len(Store.sessions))
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		log.Printf("[AUTH] Valid session found for student ID: %d", session.StudentID)

		// Add student ID to request context
		ctx := context.WithValue(r.Context(), "student_id", session.StudentID)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetStudentIDFromContext retrieves student ID from request context
func GetStudentIDFromContext(r *http.Request) (int, bool) {
	studentID, ok := r.Context().Value("student_id").(int)
	return studentID, ok
}

// Start cleanup goroutine
func init() {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			Store.CleanupExpired()
		}
	}()
}
