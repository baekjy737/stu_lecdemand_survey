// Common utility functions

// API request helper
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include', // Include cookies
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Show error message
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

// Hide error message
function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.style.display = 'none';
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Check if user is authenticated
async function checkAuth() {
    try {
        console.log('[AUTH] Checking authentication...');
        console.log('[AUTH] Current cookies:', document.cookie);

        const response = await fetch('/api/me', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('[AUTH] Response status:', response.status);

        if (!response.ok) {
            console.log('[AUTH] Not authenticated');
            return null;
        }

        const userData = await response.json();
        console.log('[AUTH] User data:', userData);
        return userData;
    } catch (error) {
        console.error('[AUTH] Auth check failed:', error);
        return null;
    }
}

// Redirect to login if not authenticated
async function requireAuth() {
    console.log('[REQUIRE_AUTH] Starting requireAuth...');
    console.log('[REQUIRE_AUTH] Current URL:', window.location.href);

    // Prevent infinite redirect loop
    const isRedirecting = sessionStorage.getItem('redirecting');
    if (isRedirecting) {
        console.error('[REQUIRE_AUTH] Redirect loop detected, stopping');
        alert('리다이렉트 루프 감지됨. 개발자 도구 콘솔을 확인하세요.');
        sessionStorage.removeItem('redirecting');
        return null;
    }

    const user = await checkAuth();
    console.log('[REQUIRE_AUTH] requireAuth result:', user);

    if (!user) {
        console.log('[REQUIRE_AUTH] No user, redirecting to login');
        sessionStorage.setItem('redirecting', 'true');
        setTimeout(() => sessionStorage.removeItem('redirecting'), 1000);
        window.location.href = '/login.html';
        return null;
    }
    console.log('[REQUIRE_AUTH] User authenticated successfully');
    return user;
}

// Logout
async function logout() {
    try {
        await apiRequest('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
    }
}

// Modal helper functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Setup modal close buttons
document.addEventListener('DOMContentLoaded', () => {
    // Close modals on close button click
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});
