// Main page functionality

let currentStudent = null;
let allCourses = [];
let mySelections = [];
let selectedCourseForModal = null;
let selectedParentSelectionForAlt = null;
let selectedParentCourseForAlt = null;
let selectedAltCourse = null;

let altCurrentOffset = 0;
let altCurrentTotal = 0;

const PAGE_SIZE = 10;
let currentOffset = 0;
let currentTotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
    currentStudent = await requireAuth();
    if (!currentStudent) return;

    if (currentStudent.is_submitted) {
        window.location.href = '/result.html';
        return;
    }

    // Display student info
    document.getElementById('studentName').textContent = currentStudent.name;
    document.getElementById('studentId').textContent = currentStudent.student_id;
    document.getElementById('studentMajor').textContent = currentStudent.major || '-';

    await loadCourseFiltersInto('filterDivision', 'filterField');

    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('searchBtn').addEventListener('click', () => searchCourses(true));
    document.getElementById('submitBtn').addEventListener('click', submitSurvey);

    // Search on Enter key
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchCourses(true);
        }
    });

    // Modal event listeners
    setupModalListeners();

    const selectionsTable = document.getElementById('selectionsTable');
    if (selectionsTable) {
        selectionsTable.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-alt-btn');
            if (!btn || !selectionsTable.contains(btn)) return;
            e.preventDefault();
            e.stopPropagation();
            const sid = btn.getAttribute('data-selection-id');
            const selId = parseInt(sid, 10);
            if (Number.isNaN(selId)) return;
            const sel = mySelections.find(s => s.id === selId);
            if (!sel) return;
            openAlternativeModal(selId, sel).catch(err => {
                alert('대체 강의 창을 열 수 없습니다: ' + (err && err.message ? err.message : String(err)));
            });
        });
    }

    // Load initial data
    await loadMySelections();

    // Initial search
    await searchCourses(true);
});

function getTakenCourseIds() {
    return new Set(
        mySelections.flatMap(sel => {
            const ids = [sel.course_id];
            if (sel.alternatives) {
                ids.push(...sel.alternatives.map(alt => alt.course_id));
            }
            return ids;
        })
    );
}

async function loadCourseFiltersInto(divisionSelectId, fieldSelectId) {
    try {
        const data = await apiRequest('/api/course-filters');
        const divisions = (data.divisions || []).filter(Boolean);
        const fields = (data.fields || []).filter(Boolean);

        const divisionSelect = document.getElementById(divisionSelectId);
        const fieldSelect = document.getElementById(fieldSelectId);

        if (divisionSelect) {
            const current = divisionSelect.value;
            divisionSelect.innerHTML = '';
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = '전체';
            divisionSelect.appendChild(allOpt);
            divisions.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                divisionSelect.appendChild(opt);
            });
            if (current && divisions.includes(current)) {
                divisionSelect.value = current;
            }
        }

        if (fieldSelect) {
            const current = fieldSelect.value;
            fieldSelect.innerHTML = '';
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = '전체';
            fieldSelect.appendChild(allOpt);
            fields.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                fieldSelect.appendChild(opt);
            });
            if (current && fields.includes(current)) {
                fieldSelect.value = current;
            }
        }
    } catch (e) {
        // ignore; filters will still work if user types search
    }
}

async function searchCourses(resetPage = false) {
    if (resetPage) {
        currentOffset = 0;
    }

    const division = document.getElementById('filterDivision').value;
    const field = document.getElementById('filterField').value;
    const search = document.getElementById('searchInput').value.trim();

    const params = new URLSearchParams();
    if (division) params.append('division', division);
    if (field) params.append('field', field);
    if (search) params.append('search', search);
    params.append('limit', String(PAGE_SIZE));
    params.append('offset', String(currentOffset));

    try {
        const data = await apiRequest(`/api/courses?${params.toString()}`);
        allCourses = data.courses || [];
        currentTotal = typeof data.total === 'number' ? data.total : allCourses.length;
        renderCourseTable(allCourses, currentOffset);
        renderPagination(currentTotal, currentOffset, PAGE_SIZE);
    } catch (error) {
        alert('강좌 조회 중 오류가 발생했습니다: ' + error.message);
    }
}

function renderCourseTable(courses, offset = 0) {
    const tbody = document.getElementById('courseTableBody');

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">조회 결과가 없습니다</td></tr>';
        return;
    }

    const selectedCourseIds = getTakenCourseIds();

    tbody.innerHTML = courses.map((course, index) => {
        const isSelected = selectedCourseIds.has(course.id);
        const rowClass = isSelected ? 'course-disabled' : '';

        return `
            <tr class="${rowClass}">
                <td>${offset + index + 1}</td>
                <td>${course.course_code}</td>
                <td>${course.course_name}</td>
                <td>${course.professor}</td>
                <td>${course.division || '-'}</td>
                <td>${course.field || '-'}</td>
                <td>${course.area || '-'}</td>
                <td>${course.credits}</td>
                <td>
                    <button class="btn btn-primary btn-sm select-course-btn"
                            data-course-id="${course.id}"
                            ${isSelected ? 'disabled' : ''}>
                        선택
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners to select buttons
    document.querySelectorAll('.select-course-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courseId = parseInt(this.dataset.courseId);
            const course = courses.find(c => c.id === courseId);
            if (course) {
                selectCourse(course);
            }
        });
    });
}

function renderPagination(total, offset, limit) {
    const container = document.getElementById('pagination');
    if (!container) return;

    if (!total || total <= limit) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.floor(offset / limit) + 1;
    const prevDisabled = offset <= 0;
    const nextDisabled = offset + limit >= total;

    container.innerHTML = `
        <button id="prevPageBtn" ${prevDisabled ? 'disabled' : ''}>이전</button>
        <button class="active" disabled>${currentPage} / ${totalPages} (총 ${total}개)</button>
        <button id="nextPageBtn" ${nextDisabled ? 'disabled' : ''}>다음</button>
    `;

    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentOffset = Math.max(0, currentOffset - limit);
            searchCourses(false);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentOffset + limit < total) {
                currentOffset += limit;
                searchCourses(false);
            }
        });
    }
}

function resetAlternativeModalBrowseState() {
    selectedAltCourse = null;
    const searchIn = document.getElementById('altSearchInput');
    if (searchIn) searchIn.value = '';
    const picked = document.getElementById('altModalSelectedCourseInfo');
    if (picked) picked.hidden = true;
    const p1 = document.getElementById('altModalProf1');
    const p2 = document.getElementById('altModalProf2');
    const p3 = document.getElementById('altModalProf3');
    if (p1) p1.value = '';
    if (p2) p2.value = '';
    if (p3) p3.value = '';
}

async function searchAltCourses(resetPage = false) {
    const divEl = document.getElementById('altFilterDivision');
    const fieldEl = document.getElementById('altFilterField');
    const searchEl = document.getElementById('altSearchInput');
    if (!divEl || !fieldEl || !searchEl) return;

    if (resetPage) {
        altCurrentOffset = 0;
    }

    const division = divEl.value;
    const field = fieldEl.value;
    const search = searchEl.value.trim();

    const params = new URLSearchParams();
    if (division) params.append('division', division);
    if (field) params.append('field', field);
    if (search) params.append('search', search);
    params.append('limit', String(PAGE_SIZE));
    params.append('offset', String(altCurrentOffset));

    try {
        const data = await apiRequest(`/api/courses?${params.toString()}`);
        const courses = data.courses || [];
        altCurrentTotal = typeof data.total === 'number' ? data.total : courses.length;
        renderAltCourseTable(courses, altCurrentOffset);
        renderAltPagination(altCurrentTotal, altCurrentOffset, PAGE_SIZE);
    } catch (error) {
        alert('강좌 조회 중 오류가 발생했습니다: ' + error.message);
    }
}

function renderAltCourseTable(courses, offset = 0) {
    const tbody = document.getElementById('altCourseTableBody');
    if (!tbody) return;
    const parentId = selectedParentCourseForAlt ? selectedParentCourseForAlt.id : -1;
    const selectedCourseIds = getTakenCourseIds();

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">조회 결과가 없습니다</td></tr>';
        return;
    }

    tbody.innerHTML = courses.map((course, index) => {
        const isTaken = selectedCourseIds.has(course.id);
        const isParent = course.id === parentId;
        const unavailable = isTaken || isParent;
        const rowClass = unavailable ? 'course-disabled' : '';

        return `
            <tr class="${rowClass}">
                <td>${offset + index + 1}</td>
                <td>${course.course_code}</td>
                <td>${course.course_name}</td>
                <td>${course.professor}</td>
                <td>${course.division || '-'}</td>
                <td>${course.field || '-'}</td>
                <td>${course.area || '-'}</td>
                <td>${course.credits}</td>
                <td>
                    <button type="button" class="btn btn-primary btn-sm select-alt-course-btn"
                            data-course-id="${course.id}"
                            ${unavailable ? 'disabled' : ''}>
                        선택
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.select-alt-course-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.disabled) return;
            const courseId = parseInt(this.dataset.courseId, 10);
            const course = courses.find(c => c.id === courseId);
            if (course) {
                pickAltCourseForAlternative(course);
            }
        });
    });
}

function renderAltPagination(total, offset, limit) {
    const container = document.getElementById('altPagination');
    if (!container) return;

    if (!total || total <= limit) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.floor(offset / limit) + 1;
    const prevDisabled = offset <= 0;
    const nextDisabled = offset + limit >= total;

    container.innerHTML = `
        <button type="button" id="altPrevPageBtn" ${prevDisabled ? 'disabled' : ''}>이전</button>
        <button type="button" class="active" disabled>${currentPage} / ${totalPages} (총 ${total}개)</button>
        <button type="button" id="altNextPageBtn" ${nextDisabled ? 'disabled' : ''}>다음</button>
    `;

    const prevBtn = document.getElementById('altPrevPageBtn');
    const nextBtn = document.getElementById('altNextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            altCurrentOffset = Math.max(0, altCurrentOffset - limit);
            searchAltCourses(false);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (altCurrentOffset + limit < total) {
                altCurrentOffset += limit;
                searchAltCourses(false);
            }
        });
    }
}

function pickAltCourseForAlternative(course) {
    selectedAltCourse = course;
    const p1 = document.getElementById('altModalProf1');
    const p2 = document.getElementById('altModalProf2');
    const p3 = document.getElementById('altModalProf3');
    if (p1) p1.value = course.professor || '';
    if (p2) p2.value = '';
    if (p3) p3.value = '';

    const picked = document.getElementById('altModalSelectedCourseInfo');
    const detail = document.getElementById('altModalSelectedCourseDetail');
    if (picked && detail) {
        detail.textContent = `${course.course_name} · ${course.course_code} · ${course.credits}학점 · ${course.professor}`;
        picked.hidden = false;
    }
}

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
        cell.removeAttribute('draggable');
        cell.removeAttribute('data-selection-id');
    });

    if (mySelections.length === 0) {
        return;
    }

    // Render each selection
    mySelections.forEach(sel => {
        const mainCell = document.querySelector(`.selection-cell[data-priority="${sel.priority}"][data-type="main"]`);
        if (mainCell) {
            mainCell.classList.add('has-selection');
            mainCell.draggable = true;
            mainCell.dataset.selectionId = sel.id;

            mainCell.innerHTML = `
                <div class="selection-content" data-selection-id="${sel.id}">
                    <div class="selection-course-name">${sel.course.course_name}</div>
                    <div class="selection-credits">${sel.course.credits}학점</div>
                    <div class="selection-professors">${sel.professor_1st}${sel.professor_2nd ? ', ' + sel.professor_2nd : ''}${sel.professor_3rd ? ', ' + sel.professor_3rd : ''}</div>
                    <div class="selection-actions-inline">
                        <button class="btn-icon edit-selection-btn" title="수정" data-selection-id="${sel.id}">✏️</button>
                        <button class="btn-icon delete-selection-btn" title="삭제" data-selection-id="${sel.id}">🗑️</button>
                    </div>
                </div>
            `;
        }

        // Render alternatives
        const altCell = document.querySelector(`.selection-cell[data-priority="${sel.priority}"][data-type="alternative"]`);
        if (altCell) {
            const alternatives = sel.alternatives || [];
            const hasAlternative = alternatives.length > 0;
            const canAddAlt = !hasAlternative;

            if (hasAlternative) {
                const alt = alternatives[0];
                altCell.classList.add('has-selection');
                altCell.innerHTML = `
                    <div class="selection-content alternative">
                        <div class="selection-course-name">${alt.course.course_name}</div>
                        <div class="selection-credits">${alt.course.credits}학점</div>
                        <div class="selection-professors">${alt.professor_1st}${alt.professor_2nd ? ', ' + alt.professor_2nd : ''}${alt.professor_3rd ? ', ' + alt.professor_3rd : ''}</div>
                        <div class="selection-actions-inline">
                            <button class="btn-icon edit-selection-btn" title="수정" data-selection-id="${alt.id}">✏️</button>
                            <button class="btn-icon delete-selection-btn" title="삭제" data-selection-id="${alt.id}">🗑️</button>
                        </div>
                    </div>
                `;
            } else if (canAddAlt) {
                altCell.innerHTML = `
                    <button type="button" class="btn-add-alt-table add-alt-btn" data-selection-id="${sel.id}">+대체 강의</button>
                `;
            }
        }
    });

    // Setup event listeners
    setupSelectionEventListeners();
    setupDragAndDrop();
}

function setupSelectionEventListeners() {
    document.querySelectorAll('.delete-selection-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteSelection(parseInt(this.dataset.selectionId));
        });
    });

    document.querySelectorAll('.edit-selection-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            openEditModal(parseInt(this.dataset.selectionId));
        });
    });

}

function setupDragAndDrop() {
    const draggableCells = document.querySelectorAll('.selection-cell[draggable="true"]');

    draggableCells.forEach(cell => {
        cell.addEventListener('dragstart', handleDragStart);
        cell.addEventListener('dragend', handleDragEnd);
    });

    const allMainCells = document.querySelectorAll('.selection-cell[data-type="main"]');
    allMainCells.forEach(cell => {
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedElement = null;
let draggedSelectionId = null;

function handleDragStart(e) {
    draggedElement = this;
    draggedSelectionId = parseInt(this.dataset.selectionId);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.selection-cell').forEach(cell => {
        cell.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }

    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();

    this.classList.remove('drag-over');

    if (this === draggedElement) {
        return false;
    }

    const targetPriority = parseInt(this.dataset.priority);
    const draggedSelection = mySelections.find(s => s.id === draggedSelectionId);

    if (!draggedSelection) {
        return false;
    }

    const sourcePriority = draggedSelection.priority;

    // Check if target priority is occupied
    const targetSelection = mySelections.find(s => s.priority === targetPriority);

    if (targetSelection) {
        // Swap priorities
        await swapPriorities(draggedSelectionId, targetSelection.id, sourcePriority, targetPriority);
    } else {
        // Just move to empty slot
        await updatePriority(draggedSelectionId, targetPriority);
    }

    return false;
}

async function swapPriorities(selId1, selId2, priority1, priority2) {
    try {
        // Temporarily set one to a high number to avoid conflict
        await updatePriorityDirect(selId1, 999);
        await updatePriorityDirect(selId2, priority1);
        await updatePriorityDirect(selId1, priority2);

        await loadMySelections();
        await searchCourses();
    } catch (error) {
        alert('우선순위 변경 중 오류가 발생했습니다: ' + error.message);
    }
}

async function updatePriority(selectionId, newPriority) {
    try {
        await updatePriorityDirect(selectionId, newPriority);
        await loadMySelections();
        await searchCourses();
    } catch (error) {
        alert('우선순위 변경 중 오류가 발생했습니다: ' + error.message);
    }
}

async function updatePriorityDirect(selectionId, newPriority) {
    await apiRequest(`/api/selections/${selectionId}/priority`, {
        method: 'PUT',
        body: JSON.stringify({ priority: newPriority }),
    });
}

function openEditModal(selectionId) {
    const selection = mySelections.find(s => s.id === selectionId);
    if (!selection) {
        const allAlternatives = mySelections.flatMap(s => s.alternatives || []);
        const altSelection = allAlternatives.find(a => a.id === selectionId);
        if (altSelection) {
            openEditModalForSelection(altSelection);
        }
        return;
    }
    openEditModalForSelection(selection);
}

function openEditModalForSelection(selection) {
    selectedCourseForModal = selection.course;

    document.getElementById('modalCourseInfo').innerHTML = `
        <strong>${selection.course.course_name}</strong>
        <p>과목번호: ${selection.course.course_code} | 학점: ${selection.course.credits} | 담당교수: ${selection.course.professor}</p>
    `;

    document.getElementById('modalProf1').value = selection.professor_1st || selection.course.professor;
    document.getElementById('modalProf2').value = selection.professor_2nd || '';
    document.getElementById('modalProf3').value = selection.professor_3rd || '';
    document.getElementById('modalPriority').value = selection.priority;
    document.getElementById('modalPriority').disabled = true;

    displayCurrentSelectionsPreview();

    // Store the selection ID for updating
    document.getElementById('modalConfirm').dataset.editingId = selection.id;

    openModal('selectionModal');
}

function selectCourse(course) {
    selectedCourseForModal = course;

    // Display course info
    document.getElementById('modalCourseInfo').innerHTML = `
        <strong>${course.course_name}</strong>
        <p>과목번호: ${course.course_code} | 학점: ${course.credits} | 담당교수: ${course.professor}</p>
    `;

    // Set professor 1st automatically
    document.getElementById('modalProf1').value = course.professor;
    document.getElementById('modalProf2').value = '';
    document.getElementById('modalProf3').value = '';

    // Reset priority
    document.getElementById('modalPriority').value = '';

    // Show current selections
    displayCurrentSelectionsPreview();

    openModal('selectionModal');
}

function displayCurrentSelectionsPreview() {
    const preview = document.getElementById('currentSelectionsPreview');
    if (mySelections.length === 0) {
        preview.innerHTML = '';
        return;
    }

    const usedPriorities = mySelections.map(s => s.priority);

    preview.innerHTML = `
        <h4>현재 선택 현황</h4>
        <div style="font-size: 12px; color: #666;">
            ${[1,2,3,4,5,6,7,8,9,10].map(p => {
                const sel = mySelections.find(s => s.priority === p);
                if (sel) {
                    return `${p}지망: ${sel.course.course_name}`;
                } else {
                    return `${p}지망: <span style="color: #28a745;">선택 가능</span>`;
                }
            }).join(' | ')}
        </div>
    `;
}

async function confirmSelection() {
    const priority = parseInt(document.getElementById('modalPriority').value);
    const prof1 = document.getElementById('modalProf1').value.trim();
    const prof2 = document.getElementById('modalProf2').value.trim();
    const prof3 = document.getElementById('modalProf3').value.trim();
    const editingId = document.getElementById('modalConfirm').dataset.editingId;

    if (!priority) {
        alert('우선순위를 선택해주세요.');
        return;
    }

    if (!prof1) {
        alert('교수님 1지망을 입력해주세요.');
        return;
    }

    try {
        if (editingId) {
            // Update existing selection
            await apiRequest(`/api/selections/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    professor_1st: prof1,
                    professor_2nd: prof2,
                    professor_3rd: prof3,
                }),
            });
            delete document.getElementById('modalConfirm').dataset.editingId;
            document.getElementById('modalPriority').disabled = false;
        } else {
            // Create new selection
            await apiRequest('/api/selections', {
                method: 'POST',
                body: JSON.stringify({
                    course_id: selectedCourseForModal.id,
                    priority: priority,
                    professor_1st: prof1,
                    professor_2nd: prof2,
                    professor_3rd: prof3,
                }),
            });
        }

        closeModal('selectionModal');
        await loadMySelections();
        await searchCourses();
    } catch (error) {
        alert('과목 선택 중 오류가 발생했습니다: ' + error.message);
    }
}

async function openAlternativeModal(parentSelectionId, sel) {
    const parentCourse = sel && sel.course;
    if (!parentCourse) {
        alert('과목 정보를 불러올 수 없습니다.');
        return;
    }

    selectedParentSelectionForAlt = parentSelectionId;
    selectedParentCourseForAlt = parentCourse;

    const parentEl = document.getElementById('altModalParentInfo');
    if (!parentEl) {
        alert('페이지 구성을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
        return;
    }

    parentEl.innerHTML = `
        <strong>원 강의 (${sel.priority}지망): ${parentCourse.course_name}</strong>
        <p>과목번호: ${parentCourse.course_code} | 학점: ${parentCourse.credits} | 담당교수: ${parentCourse.professor}</p>
    `;

    resetAlternativeModalBrowseState();
    altCurrentOffset = 0;

    // Open modal synchronously with the click gesture (before any await).
    openModal('alternativeModal');

    try {
        await loadCourseFiltersInto('altFilterDivision', 'altFilterField');
        await searchAltCourses(true);
    } catch (error) {
        alert('대체 강의 개설강좌 목록을 불러오지 못했습니다: ' + error.message);
    }
}

async function confirmAlternative() {
    const prof1 = document.getElementById('altModalProf1').value.trim();
    const prof2 = document.getElementById('altModalProf2').value.trim();
    const prof3 = document.getElementById('altModalProf3').value.trim();

    if (!selectedAltCourse) {
        alert('개설강좌 목록에서 대체 강의를 선택해주세요.');
        return;
    }

    if (!prof1) {
        alert('교수님 1지망을 입력해주세요.');
        return;
    }

    try {
        await apiRequest(`/api/selections/${selectedParentSelectionForAlt}/alternatives`, {
            method: 'POST',
            body: JSON.stringify({
                course_id: selectedAltCourse.id,
                alternative_priority: 1, // Always 1
                professor_1st: prof1,
                professor_2nd: prof2,
                professor_3rd: prof3,
            }),
        });

        closeModal('alternativeModal');
        await loadMySelections();
        await searchCourses();
        selectedAltCourse = null;
        selectedParentCourseForAlt = null;
    } catch (error) {
        alert('대체 강의 추가 중 오류가 발생했습니다: ' + error.message);
    }
}

async function deleteSelection(selectionId) {
    if (!confirm('이 선택을 삭제하시겠습니까?')) {
        return;
    }

    try {
        await apiRequest(`/api/selections/${selectionId}`, {
            method: 'DELETE',
        });

        await loadMySelections();
        await searchCourses();
    } catch (error) {
        alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

async function submitSurvey() {
    const totalCredits = parseFloat(document.getElementById('totalCredits').textContent);

    if (totalCredits < 10) {
        alert('최소 10학점 이상 선택해야 합니다.');
        return;
    }

    if (totalCredits > 21) {
        alert('최대 21학점까지만 선택할 수 있습니다.');
        return;
    }

    if (!confirm(`총 ${totalCredits}학점을 선택하셨습니다.\n설문조사를 제출하시겠습니까?`)) {
        return;
    }

    try {
        await apiRequest('/api/submit', {
            method: 'POST',
        });

        alert('설문조사가 제출되었습니다.');
        window.location.href = '/result.html';
    } catch (error) {
        alert('제출 중 오류가 발생했습니다: ' + error.message);
    }
}

function setupModalListeners() {
    // Selection modal
    document.getElementById('modalConfirm').addEventListener('click', confirmSelection);
    document.getElementById('modalCancel').addEventListener('click', () => {
        closeModal('selectionModal');
    });

    // Alternative modal
    document.getElementById('altModalConfirm').addEventListener('click', confirmAlternative);
    document.getElementById('altModalCancel').addEventListener('click', () => {
        closeModal('alternativeModal');
        selectedAltCourse = null;
        selectedParentCourseForAlt = null;
    });
    document.getElementById('altModalSkip').addEventListener('click', () => {
        closeModal('alternativeModal');
        selectedAltCourse = null;
        selectedParentCourseForAlt = null;
    });

    const altSearchBtn = document.getElementById('altSearchBtn');
    if (altSearchBtn) {
        altSearchBtn.addEventListener('click', () => searchAltCourses(true));
    }
    const altSearchInput = document.getElementById('altSearchInput');
    if (altSearchInput) {
        altSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAltCourses(true);
            }
        });
    }
}
