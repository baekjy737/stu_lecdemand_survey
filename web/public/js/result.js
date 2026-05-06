// Result page functionality

let currentStudent = null;
let mySelections = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    currentStudent = await requireAuth();
    if (!currentStudent) return;

    // Redirect if not submitted
    if (!currentStudent.is_submitted) {
        window.location.href = '/index.html';
        return;
    }

    // Display student info
    document.getElementById('studentName').textContent = currentStudent.name;
    document.getElementById('studentId').textContent = currentStudent.student_id;
    document.getElementById('studentMajor').textContent = currentStudent.major || '-';

    // Display submission time
    document.getElementById('submittedAt').textContent = formatDate(currentStudent.updated_at);

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('editBtn').addEventListener('click', reopenSurvey);

    // Load selections
    await loadMySelections();
});

async function loadMySelections() {
    try {
        const data = await apiRequest('/api/selections');
        mySelections = data.selections || [];
        document.getElementById('totalCredits').textContent = data.total_credits.toFixed(1);
        renderMySelections();
    } catch (error) {
        alert('선택 목록 조회 중 오류가 발생했습니다: ' + error.message);
    }
}

function renderMySelections() {
    // Clear all cells
    document.querySelectorAll('.selection-cell').forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('has-selection');
    });

    if (mySelections.length === 0) {
        return;
    }

    // Render each selection
    mySelections.forEach(sel => {
        const mainCell = document.querySelector(`.selection-cell[data-priority="${sel.priority}"][data-type="main"]`);
        if (mainCell) {
            mainCell.classList.add('has-selection');

            mainCell.innerHTML = `
                <div class="selection-content">
                    <div class="selection-course-name">${sel.course.course_name}</div>
                    <div class="selection-credits">${sel.course.credits}학점</div>
                    <div class="selection-professors">${sel.professor_1st}${sel.professor_2nd ? ', ' + sel.professor_2nd : ''}${sel.professor_3rd ? ', ' + sel.professor_3rd : ''}</div>
                </div>
            `;
        }

        // Render alternatives
        const altCell = document.querySelector(`.selection-cell[data-priority="${sel.priority}"][data-type="alternative"]`);
        if (altCell) {
            const alternatives = sel.alternatives || [];
            const hasAlternative = alternatives.length > 0;

            if (hasAlternative) {
                const alt = alternatives[0];
                altCell.classList.add('has-selection');
                altCell.innerHTML = `
                    <div class="selection-content alternative">
                        <div class="selection-course-name">${alt.course.course_name}</div>
                        <div class="selection-credits">${alt.course.credits}학점</div>
                        <div class="selection-professors">${alt.professor_1st}${alt.professor_2nd ? ', ' + alt.professor_2nd : ''}${alt.professor_3rd ? ', ' + alt.professor_3rd : ''}</div>
                    </div>
                `;
            }
        }
    });
}

async function reopenSurvey() {
    if (!confirm('설문조사를 다시 수정하시겠습니까?')) {
        return;
    }

    try {
        await apiRequest('/api/reopen', {
            method: 'POST',
        });

        alert('설문조사를 다시 수정할 수 있습니다.');
        window.location.href = '/index.html';
    } catch (error) {
        alert('재수정 중 오류가 발생했습니다: ' + error.message);
    }
}
