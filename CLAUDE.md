# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean university course survey system where students rank their preferred courses (1-10th choice) and specify professor preferences (1st-3rd choice). Built with Go backend, SQLite database, and vanilla JavaScript frontend.

## Development Commands

### Running the Server
```bash
# Development server (installs deps + runs)
make dev

# Run directly
go run cmd/server/main.go

# Run with custom port
make run PORT=8080
# or
go run cmd/server/main.go --port 8080 --db custom.db
```

Server runs at `http://localhost:8080` by default.

### Building
```bash
make build           # Current platform only
make build-all       # All platforms (Linux, macOS, Windows)
make clean          # Remove build artifacts and database
```

### Testing the Application
1. Navigate to `http://localhost:8080/login.html`
2. Enter student ID, name, and password (auto-creates account on first login)
3. Select courses at `/index.html`
4. View results at `/result.html`
5. Admin page at `/admin.html` (exports CSV)

## Architecture Patterns

### Backend Structure
- **Standard Library Only**: No web frameworks, uses `net/http` directly
- **Handler Pattern**: Each API domain has its own handler struct (AuthHandler, CourseHandler, etc.)
- **Custom Route Multiplexing**: Uses wrapper functions for nested routes:
  - `handleCoursesWithID()` - Routes `/api/courses/{id}` and `/api/courses/{id}/professors`
  - `handleSelectionsWithID()` - Routes selection updates, deletions, priority changes, and alternatives

### Session Management
- **In-Memory Store**: Sessions stored in `middleware.Store` (sync.Map)
- **Cookie-Based**: Uses `session_token` cookie (HttpOnly, 2-hour expiration)
- **Auto-Cleanup**: Background goroutine cleans expired sessions every 30 minutes
- **Context Propagation**: Student ID stored in request context via middleware

### Database Patterns
- **SQLite**: Single file database (`survey.db`)
- **Migrations**: Run automatically on server startup in `internal/db/migrations.go`
- **CSV Sync**: Courses loaded/synced from `reference/개설강좌.csv` on every restart
  - Marks all courses inactive, then upserts from CSV (by course_code + professor)
  - Allows CSV updates to be reflected without manual DB changes

### Important Business Logic

#### Course Selection Rules
1. **Course Code Deduplication**: Students CANNOT select the same course (course_code) with different professors
   - Checked in `IsCourseCodeSelected(studentID, courseCode)`
   - Enforced in both main selection and alternative selection
2. **Priority Constraints**:
   - Must be 1-10
   - Each priority can only be used once
   - Alternative courses inherit parent's priority
3. **Credit Limits**:
   - Minimum: 10 credits
   - Maximum: 21 credits
4. **Alternative Courses**: Max 1 alternative per main selection

#### Professor Selection Flow
1. When selecting a course, professor 1st choice auto-fills with course's default professor
2. Professor 2nd/3rd choices are dropdowns populated via `/api/courses/{id}/professors`
3. Dropdown shows only OTHER professors teaching the same course_code
4. If no other professors available, dropdowns are disabled

### Frontend Architecture
- **No Framework**: Vanilla JavaScript with async/await
- **Module Pattern**:
  - `common.js` - API helper, auth check, modal utilities
  - `main.js` - Course selection UI, drag-and-drop
  - `login.js` - Authentication flow
  - `result.js` - Survey results display
  - `admin.js` - Statistics and CSV export
- **Fetch with Credentials**: All API calls use `credentials: 'include'` for cookie auth
- **Drag-and-Drop**: Priority reordering updates via `PUT /api/selections/{id}/priority`

## Key Files to Know

### Backend
- `cmd/server/main.go` - Server entry point, route setup, CSV loading
- `internal/api/selections.go` - Core course selection logic and validation
- `internal/db/queries.go` - All database queries (includes professor listing, course code checking)
- `internal/middleware/auth.go` - Session store and auth middleware
- `internal/db/migrations.go` - Database schema

### Frontend
- `web/public/js/main.js` - Main UI logic, handles professor dropdown population
- `web/templates/index.html` - Course selection form (uses SELECT elements for professor 2nd/3rd)

## Common Modifications

### Adding New API Endpoint
1. Add handler method to appropriate handler struct in `internal/api/`
2. Add route in `cmd/server/main.go` with CORS and auth middleware
3. If nested route (e.g., `/api/courses/{id}/something`), add to custom handler function

### Adding Database Fields
1. Update struct in `internal/models/`
2. Add migration in `internal/db/migrations.go`
3. Update queries in `internal/db/queries.go`
4. Delete `survey.db` to force recreation (dev only)

### Modifying Course Selection Logic
Primary validation occurs in:
- `CreateSelection()` in `internal/api/selections.go` (lines 56-144)
- `CreateAlternative()` in `internal/api/selections.go` (lines 147-230)

Check sequence: priority range → course_code duplication → priority duplication → credit limits

### Server Shutdown
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or kill by process name
pkill -f "go run cmd/server/main.go"
```

## Data Flow Examples

### Course Selection
1. Student clicks course in table → `selectCourse(course)` called
2. Fetches professors: `GET /api/courses/{id}/professors`
3. Populates dropdowns with professors (excluding 1st choice)
4. On confirm: `POST /api/selections` with course_id, priority, professor_1st/2nd/3rd
5. Backend validates: course_code not already selected, priority available, under 21 credits
6. Returns updated selection list and total credits

### Priority Reordering (Drag-and-Drop)
1. User drags selection to new position
2. Frontend calls `PUT /api/selections/{id}/priority` with new priority
3. Backend updates main selection + all its alternatives to new priority
4. UI refreshes to show new order

## Notes for Future Development

- Sessions are in-memory only - server restart logs everyone out
- No horizontal scaling possible due to in-memory sessions
- CSV must be UTF-8 encoded (with or without BOM)
- Professor dropdown auto-disables if no alternative professors exist
- Hard browser refresh (Cmd+Shift+R / Ctrl+Shift+R) needed after JS/HTML changes
