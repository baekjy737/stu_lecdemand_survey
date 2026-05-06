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
    const wrapper = document.getElementById('selectionsWrapper');

    if (mySelections.length === 0) {
        wrapper.innerHTML = '<p class="no-selections">선택된 과목이 없습니다</p>';
        return;
    }

    wrapper.innerHTML = mySelections.map(sel => {
        const alternativesHtml = (sel.alternatives || []).map(alt => `
            <div class="selection-alternative alt-${alt.alternative_priority}">
                <div class="alternative-label">대체 강의 ${alt.alternative_priority}순위</div>
                <div class="selection-course">
                    <strong>${alt.course.course_name}</strong> (${alt.course.credits}학점)
                    <div class="selection-professors">
                        ${alt.professor_1st}${alt.professor_2nd ? ', ' + alt.professor_2nd : ''}${alt.professor_3rd ? ', ' + alt.professor_3rd : ''}
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div class="selection-item priority-${sel.priority}">
                <div class="selection-header">
                    <div class="selection-title">${sel.priority}지망</div>
                    <div class="selection-priority">${sel.course.credits}학점</div>
                </div>
                <div class="selection-course">
                    <strong>${sel.course.course_name}</strong> (${sel.course.course_code})
                    <div class="selection-professors">
                        교수: ${sel.professor_1st}${sel.professor_2nd ? ', ' + sel.professor_2nd : ''}${sel.professor_3rd ? ', ' + sel.professor_3rd : ''}
                    </div>
                </div>
                ${alternativesHtml}
            </div>
        `;
    }).join('');
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
