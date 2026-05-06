package api

import (
	"course-survey/internal/db"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type AdminHandler struct {
	DB *db.Database
}

func NewAdminHandler(database *db.Database) *AdminHandler {
	return &AdminHandler{DB: database}
}

// GetStats returns survey statistics
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var total, submitted, unsubmitted int

	// Get total students
	if err := h.DB.DB.QueryRow("SELECT COUNT(*) FROM students").Scan(&total); err != nil {
		http.Error(w, "Failed to get stats", http.StatusInternalServerError)
		return
	}

	// Get submitted students
	if err := h.DB.DB.QueryRow("SELECT COUNT(*) FROM students WHERE is_submitted = TRUE").Scan(&submitted); err != nil {
		http.Error(w, "Failed to get stats", http.StatusInternalServerError)
		return
	}

	unsubmitted = total - submitted

	w.Header().Set("Content-Type", "application/json")
	json := fmt.Sprintf(`{"total": %d, "submitted": %d, "unsubmitted": %d}`, total, submitted, unsubmitted)
	w.Write([]byte(json))
}

// ExportResults exports all survey results to CSV
func (h *AdminHandler) ExportResults(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Query all students and their selections
	query := `
		SELECT
			s.student_id,
			s.name,
			s.major,
			s.minor,
			s.current_year,
			s.special_notes,
			s.is_submitted,
			cs.priority,
			cs.is_alternative,
			cs.alternative_priority,
			c.course_code,
			c.course_name,
			c.professor,
			cs.professor_1st,
			cs.professor_2nd,
			cs.professor_3rd
		FROM students s
		LEFT JOIN course_selections cs ON s.id = cs.student_id
		LEFT JOIN courses c ON cs.course_id = c.id
		ORDER BY s.student_id, cs.is_alternative, cs.priority, cs.alternative_priority
	`

	rows, err := h.DB.DB.Query(query)
	if err != nil {
		http.Error(w, "Failed to query database", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Set headers for CSV download
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("survey_results_%s.csv", timestamp)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8-sig")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Write UTF-8 BOM for Excel compatibility
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	header := []string{
		"학번", "이름", "전공", "부전공", "학년", "특이사항", "제출여부",
		"우선순위", "선택구분", "과목번호", "과목명", "담당교수",
		"교수1지망", "교수2지망", "교수3지망",
	}
	if err := writer.Write(header); err != nil {
		return
	}

	// Write data rows
	for rows.Next() {
		var studentID, name, major, minor, currentYear, specialNotes string
		var isSubmitted bool
		var priority int
		var isAlternative bool
		var alternativePriority *int
		var courseCode, courseName, professor, prof1st, prof2nd, prof3rd *string

		err := rows.Scan(
			&studentID, &name, &major, &minor, &currentYear, &specialNotes, &isSubmitted,
			&priority, &isAlternative, &alternativePriority,
			&courseCode, &courseName, &professor, &prof1st, &prof2nd, &prof3rd,
		)
		if err != nil {
			continue
		}

		submittedStr := "미제출"
		if isSubmitted {
			submittedStr = "제출완료"
		}

		selectionType := "선택강의"
		priorityStr := strconv.Itoa(priority)
		if isAlternative {
			selectionType = "대체강의"
			if alternativePriority != nil {
				priorityStr = fmt.Sprintf("%d (대체%d)", priority, *alternativePriority)
			}
		}

		// Handle NULL values
		var courseCodeStr, courseNameStr, professorStr, prof1Str, prof2Str, prof3Str string
		if courseCode != nil {
			courseCodeStr = *courseCode
		}
		if courseName != nil {
			courseNameStr = *courseName
		}
		if professor != nil {
			professorStr = *professor
		}
		if prof1st != nil {
			prof1Str = *prof1st
		}
		if prof2nd != nil {
			prof2Str = *prof2nd
		}
		if prof3rd != nil {
			prof3Str = *prof3rd
		}

		record := []string{
			studentID, name, major, minor, currentYear, specialNotes, submittedStr,
			priorityStr, selectionType, courseCodeStr, courseNameStr, professorStr,
			prof1Str, prof2Str, prof3Str,
		}

		if err := writer.Write(record); err != nil {
			continue
		}
	}
}
