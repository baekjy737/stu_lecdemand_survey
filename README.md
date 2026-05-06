# 수강신청 설문조사 시스템

대학 수강신청 최적화를 위한 학생 선호도 조사 웹 애플리케이션

## 프로젝트 개요

학생들이 다음 학기 수강 희망 과목을 우선순위별로 입력하고, 교수님 선호도를 표시할 수 있는 설문조사 시스템입니다. 
수집된 데이터를 기반으로 최적의 시간표를 생성하는 것이 목표입니다.

## 기술 스택

- **Backend**: Go 1.21+
- **Database**: SQLite3
- **Frontend**: Vanilla JavaScript (프레임워크 없음), HTML5, CSS3
- **Build Tool**: Make

## 주요 기능

### 학생 기능
- 학생 로그인/회원가입 (학번 기반, bcrypt 암호화)
- 1~10지망 과목 선택
  - 테이블 형태의 직관적인 UI (가로: 1-10지망, 세로: 선택강의/대체강의)
  - 드래그앤드롭으로 우선순위 실시간 변경 가능
  - 선택 항목별 수정/삭제 기능
- 과목별 교수님 1~3지망 선택
- 과목별 대체 강의 선택 (최대 1개)
- 학점 제한: 최소 10학점, 최대 21학점
- 제출 후 재수정 가능

### 관리자 기능
- 설문조사 통계 조회 (전체/제출/미제출 학생 수)
- CSV 파일로 설문조사 결과 다운로드
  - UTF-8 BOM 포함 (Excel 호환)
  - 학생 정보, 선택 과목, 우선순위, 교수 선호도 포함

## 설치 및 실행

### 요구사항

- Go 1.21 이상
- Make
- SQLite3

### 개발 서버 실행

```bash
# 의존성 설치 및 서버 시작
make dev

# 또는 직접 실행
go run cmd/server/main.go
```

서버는 기본적으로 `http://localhost:8080`에서 실행됩니다.

### 페이지 접속

- 학생 로그인: `http://localhost:8080/login.html`
- 설문조사 메인: `http://localhost:8080/index.html`
- 제출 결과: `http://localhost:8080/result.html`
- 관리자 페이지: `http://localhost:8080/admin.html`

### 프로덕션 빌드

```bash
# 현재 OS용 빌드
make build

# 모든 플랫폼용 빌드
make build-all

# 빌드 정리
make clean
```

## 프로젝트 구조

```
.
├── cmd/
│   └── server/          # 메인 서버 애플리케이션
├── internal/
│   ├── api/            # API 핸들러 (auth, courses, selections, admin)
│   ├── db/             # 데이터베이스 로직
│   ├── middleware/     # 인증, CORS 미들웨어
│   ├── models/         # 데이터 모델
│   └── util/           # 유틸리티 함수 (CSV 파싱 등)
├── web/
│   ├── public/
│   │   ├── css/       # 스타일시트
│   │   └── js/        # JavaScript (common, login, main, result, admin)
│   └── templates/      # HTML 템플릿 (login, index, result, admin)
├── reference/          # 개설강좌.csv
├── Makefile
└── go.mod
```

## API 엔드포인트

### 인증
- `POST /api/login` - 로그인/회원가입
- `GET /api/me` - 현재 사용자 정보
- `POST /api/logout` - 로그아웃

### 과목
- `GET /api/courses` - 과목 목록 조회 (필터링 지원)
- `GET /api/courses/{id}` - 특정 과목 조회
- `GET /api/course-filters` - 필터 옵션 조회
- `GET /api/recommendations` - 추천 대체 과목 조회

### 선택
- `GET /api/selections` - 내 선택 목록
- `POST /api/selections` - 과목 선택 추가
- `PUT /api/selections/{id}` - 선택 수정
- `PUT /api/selections/{id}/priority` - 우선순위 변경 (드래그앤드롭)
- `DELETE /api/selections/{id}` - 선택 삭제
- `POST /api/selections/{id}/alternatives` - 대체 강의 추가
- `POST /api/submit` - 설문조사 제출
- `POST /api/reopen` - 설문조사 재수정

### 관리자
- `GET /api/admin/stats` - 설문조사 통계
- `GET /api/admin/export` - CSV 파일 다운로드

## 데이터베이스 스키마

### students
- 학번, 이름, 비밀번호(bcrypt 해시), 전공, 부전공, 학년, 특이사항
- 제출 여부 플래그

### courses
- 과목번호, 과목명, 담당교수, 이수구분, 교과분야, 학점, 학년
- 활성 상태 플래그 (CSV 동기화 지원)

### course_selections
- 학생 ID, 과목 ID, 우선순위(1-10)
- 교수 선호도(1-3지망)
- 선택강의/대체강의 구분
- 부모 선택 ID (대체 강의의 경우)

## 라이센스

이 프로젝트는 학교 과제용으로 제작되었습니다.

## 문의

프로젝트 관련 문의사항은 이슈를 등록해주세요.
