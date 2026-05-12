# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean university course survey system where students rank their preferred courses (1–10th choice) and specify professor preferences (1st–3rd choice). Built with Go backend, SQLite database, and vanilla JavaScript frontend.

## Development Commands

```bash
make dev              # Install deps + run server (default port 8080)
make run PORT=8080    # Run with custom port
make build            # Build binary to dist/survey
make build-all        # Cross-compile: Linux/macOS/Windows amd64+arm64
make clean            # Remove dist/ and survey.db
```

Server runs at `http://localhost:8080`. Hard-refresh (Cmd+Shift+R) needed after JS/HTML changes.

```bash
# Kill server
lsof -ti:8080 | xargs kill -9
```

## Architecture

### Backend
- **Standard library only** — no web framework, uses `net/http`
- **Handler structs**: `AuthHandler`, `CourseHandler`, `SelectionHandler`, `AdminHandler` in `internal/api/`
- **Custom route multiplexing** for sub-paths (Go's mux can't do path params natively):
  - `handleCoursesWithID()` — dispatches `/api/courses/{id}` and `/api/courses/{id}/professors`
  - `handleSelectionsWithID()` — dispatches `PUT`, `DELETE` on `/api/selections/{id}`, plus `/priority` and `/alternatives` sub-paths

### Session Management
- In-memory `sync.Map` in `middleware.Store`; cookie `session_token` (HttpOnly, 2-hour TTL)
- Background goroutine cleans expired sessions every 30 minutes
- **Server restart logs everyone out** (no persistence)

### Database
- SQLite (`survey.db`); migrations run automatically at startup via `internal/db/migrations.go`
- **CSV sync on every restart**: marks all courses inactive, then upserts from `reference/개설강좌.csv` keyed on `(course_code, professor)`. Delete `survey.db` to force full recreation in dev.
- CSV must be UTF-8 (BOM optional)

## API Routes

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | `/api/login` | `AuthHandler.Login` | — |
| POST | `/api/logout` | `AuthHandler.Logout` | ✓ |
| GET | `/api/me` | `AuthHandler.GetMe` | ✓ |
| GET | `/api/course-filters` | `CourseHandler.GetCourseFilterOptions` | ✓ |
| GET | `/api/courses` | `CourseHandler.GetCourses` | ✓ |
| GET | `/api/courses/{id}` | `CourseHandler.GetCourse` | ✓ |
| GET | `/api/courses/{id}/professors` | `CourseHandler.GetProfessors` | ✓ |
| GET | `/api/recommendations?course_id=` | `CourseHandler.GetRecommendedAlternatives` | ✓ |
| GET | `/api/selections` | `SelectionHandler.GetSelections` | ✓ |
| POST | `/api/selections` | `SelectionHandler.CreateSelection` | ✓ |
| PUT | `/api/selections/{id}` | `SelectionHandler.UpdateSelection` | ✓ |
| DELETE | `/api/selections/{id}` | `SelectionHandler.DeleteSelection` | ✓ |
| PUT | `/api/selections/{id}/priority` | `SelectionHandler.UpdatePriority` | ✓ |
| POST | `/api/selections/{id}/alternatives` | `SelectionHandler.CreateAlternative` | ✓ |
| POST | `/api/submit` | `SelectionHandler.Submit` | ✓ |
| POST | `/api/reopen` | `SelectionHandler.Reopen` | ✓ |
| GET | `/api/admin/stats` | `AdminHandler.GetStats` | — |
| GET | `/api/admin/export` | `AdminHandler.ExportResults` | — |

## Business Logic

### Course Selection Rules (enforced in `internal/api/selections.go`)
1. **Course code deduplication**: same `course_code` with different professors is blocked. Checked via `IsCourseCodeSelected(studentID, courseCode)` in both `CreateSelection` (line 56) and `CreateAlternative` (line 147).
2. **Priority**: 1–10, each used at most once per student. Alternatives inherit their parent's priority and cannot have their priority changed directly.
3. **Credits**: max 21 to add; min 10 to submit. Alternatives don't count toward credit totals.
4. **Alternatives**: max 1 per main selection; deleting a main selection cascades to its alternative.

### Professor Selection
- Professor 1st choice = course's default professor (readonly in UI)
- 2nd/3rd choices populated from `/api/courses/{id}/professors` (returns all professors sharing the same `course_code`, excluding the 1st choice)
- 3rd choice dynamically excludes the 2nd choice selection
- Dropdown enable/disable states: 0 other professors → both disabled; 1 → only 2nd enabled; 2+ → both enabled

### Priority Swapping (drag-and-drop)
Uses a temporary unused priority slot to avoid constraint violations: move A→temp, move B→A's old slot, move temp→B's old slot. See `swapPriorities()` in `web/public/js/main.js`.

## Frontend

Vanilla JS, no framework. All fetch calls use `credentials: 'include'`.

- `web/public/js/common.js` — API helper, auth check, modal utilities
- `web/public/js/main.js` — course selection UI, drag-and-drop
- `web/public/js/login.js` — authentication flow
- `web/public/js/result.js` — survey results display
- `web/public/js/admin.js` — statistics and CSV export (note: `internal/models/admin.js` is a stray file and not part of the frontend)

Key functions in `main.js`:
- `selectCourse(course)` — opens selection modal, auto-fills lowest available priority via `findLowestAvailablePriority()`
- `loadProfessorsForCourse()` — populates professor dropdowns with dynamic filtering
- `handleDrop()` — all drag-and-drop dispatch
- `getTakenCourseCodes()` — prevents duplicate course_code display in the course table

## Common Modifications

### New API endpoint
1. Add method to handler struct in `internal/api/`
2. Register route in `cmd/server/main.go` with `middleware.CORSMiddleware` + `middleware.AuthMiddleware`
3. If the path has an `{id}` segment, add the case to the relevant `handleXxxWithID()` wrapper

### New database field
1. Update struct in `internal/models/`
2. Add migration in `internal/db/migrations.go` (use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` pattern for additive changes like `ensureCoursesIsActiveColumn()`)
3. Update queries in `internal/db/queries.go`
