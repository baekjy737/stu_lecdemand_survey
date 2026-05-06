package util

import (
	"course-survey/internal/models"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// ParseCoursesCSV parses the courses CSV file and returns a slice of Course models
func ParseCoursesCSV(reader io.Reader) ([]models.Course, error) {
	csvReader := csv.NewReader(reader)

	// Skip header row
	if _, err := csvReader.Read(); err != nil {
		return nil, fmt.Errorf("failed to read header: %w", err)
	}

	var courses []models.Course
	lineNum := 1

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading CSV at line %d: %w", lineNum, err)
		}

		lineNum++

		// Skip empty rows
		if len(record) == 0 || (len(record) > 0 && strings.TrimSpace(record[0]) == "") {
			continue
		}

		// Expected columns based on 개설강좌.csv structure
		// We need to handle the actual CSV structure
		if len(record) < 10 {
			continue // Skip incomplete rows
		}

		// Parse credits
		credits := 0.0
		if record[8] != "" {
			credits, err = strconv.ParseFloat(strings.TrimSpace(record[8]), 64)
			if err != nil {
				// Skip if credits can't be parsed
				continue
			}
		}

		course := models.Course{
			CourseCode:   strings.TrimSpace(record[1]),  // 과목번호
			CourseName:   strings.TrimSpace(record[2]),  // 교과목명
			Professor:    strings.TrimSpace(record[4]),  // 담당교수
			Division:     strings.TrimSpace(record[5]),  // 이수구분
			Field:        strings.TrimSpace(record[6]),  // 교과분야
			Area:         strings.TrimSpace(record[7]),  // 교과영역
			Credits:      credits,                       // 학점
			SyllabusLink: strings.TrimSpace(record[3]),  // 강의계획서
			Schedule:     strings.TrimSpace(record[9]),  // 시간표 (마지막 컬럼)
		}

		// Skip courses with empty essential fields
		if course.CourseCode == "" || course.CourseName == "" || course.Professor == "" {
			continue
		}

		courses = append(courses, course)
	}

	return courses, nil
}
