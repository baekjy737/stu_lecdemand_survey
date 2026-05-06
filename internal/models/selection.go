package models

import "time"

type CourseSelection struct {
	ID                  int       `json:"id"`
	StudentID           int       `json:"student_id"`
	CourseID            int       `json:"course_id"`
	Priority            int       `json:"priority"`
	Professor1st        string    `json:"professor_1st"`
	Professor2nd        string    `json:"professor_2nd"`
	Professor3rd        string    `json:"professor_3rd"`
	IsAlternative       bool      `json:"is_alternative"`
	ParentSelectionID   *int      `json:"parent_selection_id,omitempty"`
	AlternativePriority *int      `json:"alternative_priority,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type SelectionWithCourse struct {
	CourseSelection
	Course       Course                 `json:"course"`
	Alternatives []SelectionWithCourse  `json:"alternatives,omitempty"`
}

type SelectionListResponse struct {
	TotalCredits float64               `json:"total_credits"`
	Selections   []SelectionWithCourse `json:"selections"`
}

type CreateSelectionRequest struct {
	CourseID     int    `json:"course_id"`
	Priority     int    `json:"priority"`
	Professor1st string `json:"professor_1st"`
	Professor2nd string `json:"professor_2nd,omitempty"`
	Professor3rd string `json:"professor_3rd,omitempty"`
}

type CreateAlternativeRequest struct {
	CourseID     int    `json:"course_id"`
	AlternativePriority int `json:"alternative_priority"`
	Professor1st string `json:"professor_1st"`
	Professor2nd string `json:"professor_2nd,omitempty"`
	Professor3rd string `json:"professor_3rd,omitempty"`
}

type UpdateSelectionRequest struct {
	Professor1st string `json:"professor_1st,omitempty"`
	Professor2nd string `json:"professor_2nd,omitempty"`
	Professor3rd string `json:"professor_3rd,omitempty"`
}
