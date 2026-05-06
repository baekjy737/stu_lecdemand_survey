package main

import (
	"course-survey/internal/api"
	"course-survey/internal/db"
	"course-survey/internal/middleware"
	"course-survey/internal/util"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// Parse command line flags
	port := flag.String("port", "8080", "Port to run the server on")
	dbPath := flag.String("db", "survey.db", "Path to SQLite database file")
	flag.Parse()

	// Initialize database
	database, err := db.NewDatabase(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Load courses from CSV if the table is empty
	if err := loadCoursesIfEmpty(database); err != nil {
		log.Printf("Warning: Failed to load courses from CSV: %v", err)
	}

	// Initialize API handlers
	authHandler := api.NewAuthHandler(database)
	courseHandler := api.NewCourseHandler(database)
	selectionHandler := api.NewSelectionHandler(database)

	// Setup routes
	mux := http.NewServeMux()

	// Static files
	webDir := "web"
	if _, err := os.Stat(webDir); os.IsNotExist(err) {
		// When running from embedded binary, serve from current dir
		webDir = "."
	}

	publicDir := filepath.Join(webDir, "public")
	templatesDir := filepath.Join(webDir, "templates")

	// Serve public files (CSS, JS, images, etc.)
	mux.Handle("/public/", http.StripPrefix("/public/", http.FileServer(http.Dir(publicDir))))

	// Serve HTML pages
	mux.HandleFunc("/", serveFile(filepath.Join(templatesDir, "login.html")))
	mux.HandleFunc("/login.html", serveFile(filepath.Join(templatesDir, "login.html")))
	mux.HandleFunc("/index.html", serveFile(filepath.Join(templatesDir, "index.html")))
	mux.HandleFunc("/result.html", serveFile(filepath.Join(templatesDir, "result.html")))

	// API routes - Authentication
	mux.HandleFunc("/api/login", middleware.CORSMiddleware(authHandler.Login))
	mux.HandleFunc("/api/logout", middleware.CORSMiddleware(authHandler.Logout))
	mux.HandleFunc("/api/me", middleware.CORSMiddleware(middleware.AuthMiddleware(authHandler.GetMe)))

	// API routes - Courses
	mux.HandleFunc("/api/courses", middleware.CORSMiddleware(middleware.AuthMiddleware(courseHandler.GetCourses)))
	mux.HandleFunc("/api/courses/", middleware.CORSMiddleware(middleware.AuthMiddleware(courseHandler.GetCourse)))
	mux.HandleFunc("/api/recommendations", middleware.CORSMiddleware(middleware.AuthMiddleware(courseHandler.GetRecommendedAlternatives)))

	// API routes - Selections
	mux.HandleFunc("/api/selections", middleware.CORSMiddleware(middleware.AuthMiddleware(handleSelectionsCRUD(selectionHandler))))
	mux.HandleFunc("/api/selections/", middleware.CORSMiddleware(middleware.AuthMiddleware(handleSelectionsWithID(selectionHandler))))
	mux.HandleFunc("/api/submit", middleware.CORSMiddleware(middleware.AuthMiddleware(selectionHandler.Submit)))
	mux.HandleFunc("/api/reopen", middleware.CORSMiddleware(middleware.AuthMiddleware(selectionHandler.Reopen)))

	// Start server
	addr := ":" + *port
	log.Printf("Server starting on http://localhost%s", addr)
	log.Printf("Database: %s", *dbPath)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func loadCoursesIfEmpty(database *db.Database) error {
	// Check if courses table is empty
	var count int
	err := database.DB.QueryRow("SELECT COUNT(*) FROM courses").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Printf("Courses already loaded (%d courses)", count)
		return nil
	}

	log.Println("Loading courses from CSV...")

	// Try to read CSV file from multiple possible locations
	var file *os.File

	csvPaths := []string{
		"reference/개설강좌.csv",
		"../../reference/개설강좌.csv",
		"../reference/개설강좌.csv",
	}

	for _, path := range csvPaths {
		file, err = os.Open(path)
		if err == nil {
			log.Printf("Reading CSV from: %s", path)
			break
		}
	}

	if file == nil {
		return fmt.Errorf("failed to find CSV file in any of the expected locations")
	}
	defer file.Close()

	courses, err := util.ParseCoursesCSV(file)
	if err != nil {
		return fmt.Errorf("failed to parse CSV: %w", err)
	}

	// Insert courses into database
	for i, course := range courses {
		if err := database.CreateCourse(&course); err != nil {
			log.Printf("Warning: Failed to insert course %s: %v", course.CourseCode, err)
			continue
		}
		if (i+1)%100 == 0 {
			log.Printf("Loaded %d courses...", i+1)
		}
	}

	log.Printf("Successfully loaded %d courses from CSV", len(courses))
	return nil
}

func serveFile(path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, path)
	}
}

func handleSelectionsCRUD(h *api.SelectionHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.GetSelections(w, r)
		case http.MethodPost:
			h.CreateSelection(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func handleSelectionsWithID(h *api.SelectionHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check if it's alternatives endpoint
		if len(r.URL.Path) > 0 && r.URL.Path[len(r.URL.Path)-12:] == "/alternatives" {
			if r.Method == http.MethodPost {
				h.CreateAlternative(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		switch r.Method {
		case http.MethodPut:
			h.UpdateSelection(w, r)
		case http.MethodDelete:
			h.DeleteSelection(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}
