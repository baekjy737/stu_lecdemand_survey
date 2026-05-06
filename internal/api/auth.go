package api

import (
	"course-survey/internal/db"
	"course-survey/internal/middleware"
	"course-survey/internal/models"
	"course-survey/internal/util"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type AuthHandler struct {
	DB *db.Database
}

func NewAuthHandler(database *db.Database) *AuthHandler {
	return &AuthHandler{DB: database}
}

// Login handles both login and registration
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.StudentID == "" || req.Name == "" || req.Password == "" {
		http.Error(w, "Student ID, name, and password are required", http.StatusBadRequest)
		return
	}

	// Check if student exists
	existingStudent, err := h.DB.GetStudentByStudentID(req.StudentID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var student *models.Student
	var isNewUser bool

	if existingStudent == nil {
		// New user - create account
		hashedPassword, err := util.HashPassword(req.Password)
		if err != nil {
			http.Error(w, "Failed to hash password", http.StatusInternalServerError)
			return
		}

		student = &models.Student{
			StudentID:    req.StudentID,
			Name:         req.Name,
			Password:     hashedPassword,
			Major:        req.Major,
			Minor:        req.Minor,
			CurrentYear:  req.CurrentYear,
			SpecialNotes: req.SpecialNotes,
			IsSubmitted:  false,
		}

		if err := h.DB.CreateStudent(student); err != nil {
			http.Error(w, "Failed to create student account", http.StatusInternalServerError)
			return
		}

		isNewUser = true
	} else {
		// Existing user - verify password
		if !util.CheckPasswordHash(req.Password, existingStudent.Password) {
			http.Error(w, "Invalid password", http.StatusUnauthorized)
			return
		}

		student = existingStudent
		isNewUser = false
	}

	// Create session
	token, err := middleware.Store.CreateSession(student.ID)
	if err != nil {
		log.Printf("[LOGIN] Failed to create session: %v", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	log.Printf("[LOGIN] Session created for student ID %d, token: %s... (first 10 chars)", student.ID, token[:min(10, len(token))])
	log.Printf("[LOGIN] Total sessions in store: %d", len(middleware.Store.GetAllSessions()))

	// Set headers FIRST before writing anything
	w.Header().Set("Content-Type", "application/json")

	// Set cookie - MUST be before WriteHeader or any Write
	// TEMPORARY: HttpOnly set to false for debugging cookie issues
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: false, // Temporarily false to allow JavaScript cookie setting for debugging
		MaxAge:   7200,  // 2 hours
		SameSite: http.SameSiteLaxMode, // Lax mode for localhost HTTP (None requires HTTPS)
		Secure:   false,                // false for localhost HTTP development
	})

	log.Printf("[LOGIN] Cookie set in response header")

	// Send response
	response := models.LoginResponse{
		Success:   true,
		IsNewUser: isNewUser,
		Student:   student,
		Token:     token,
	}

	json.NewEncoder(w).Encode(response)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetMe returns current logged-in student info
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	studentID, ok := middleware.GetStudentIDFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get student from DB by ID
	query := `SELECT id, student_id, name, major, minor, current_year,
			  special_notes, is_submitted, created_at, updated_at
			  FROM students WHERE id = ?`

	var s models.Student
	err := h.DB.DB.QueryRow(query, studentID).Scan(
		&s.ID, &s.StudentID, &s.Name, &s.Major, &s.Minor,
		&s.CurrentYear, &s.SpecialNotes, &s.IsSubmitted,
		&s.CreatedAt, &s.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Student not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_token")
	if err == nil {
		middleware.Store.DeleteSession(cookie.Value)
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
