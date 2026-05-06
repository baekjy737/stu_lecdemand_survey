package models

type Course struct {
	ID            int     `json:"id"`
	CourseCode    string  `json:"course_code"`
	CourseName    string  `json:"course_name"`
	Professor     string  `json:"professor"`
	Division      string  `json:"division"`
	Field         string  `json:"field"`
	Area          string  `json:"area"`
	Credits       float64 `json:"credits"`
	SyllabusLink  string  `json:"syllabus_link"`
	Schedule      string  `json:"schedule"`
}

type CourseListResponse struct {
	Total   int       `json:"total"`
	Courses []Course  `json:"courses"`
}

type CourseFilter struct {
	Division string
	Field    string
	Area     string
	Search   string
	Limit    int
	Offset   int
}
