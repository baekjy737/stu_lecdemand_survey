// Login page functionality

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[LOGIN] Login page loaded');

    // TEMPORARILY DISABLED: Check if already logged in
    // try {
    //     const user = await checkAuth();
    //     if (user) {
    //         console.log('[LOGIN] User already logged in:', user);
    //         // Redirect based on submission status
    //         if (user.is_submitted) {
    //             console.log('[LOGIN] Redirecting to result.html');
    //             window.location.href = '/result.html';
    //         } else {
    //             console.log('[LOGIN] Redirecting to index.html');
    //             window.location.href = '/index.html';
    //         }
    //         return;
    //     }
    //     console.log('[LOGIN] No user logged in, showing login form');
    // } catch (error) {
    //     console.error('[LOGIN] Error checking auth:', error);
    // }

    const form = document.getElementById('loginForm');
    const additionalFields = document.getElementById('additionalFields');
    const studentIdInput = document.getElementById('studentId');
    const passwordInput = document.getElementById('password');

    // Check if user exists when student ID changes
    let isNewUser = false;
    studentIdInput.addEventListener('blur', async () => {
        const studentId = studentIdInput.value.trim();
        if (!studentId) return;

        // Try to determine if it's a new user
        // We can't check this without attempting login, so we'll show fields on first login attempt
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError('errorMessage');

        const formData = {
            student_id: document.getElementById('studentId').value.trim(),
            name: document.getElementById('name').value.trim(),
            password: document.getElementById('password').value,
        };

        // Validate required fields
        if (!formData.student_id || !formData.name || !formData.password) {
            showError('errorMessage', '학번, 성함, 비밀번호를 모두 입력해주세요.');
            return;
        }

        // If additional fields are visible, include them
        if (additionalFields.style.display !== 'none') {
            formData.major = document.getElementById('major').value;
            formData.minor = document.getElementById('minor').value;
            formData.current_year = document.getElementById('currentYear').value;
            formData.special_notes = document.getElementById('specialNotes').value.trim();
        }

        try {
            console.log('Attempting login with:', formData.student_id);
            const data = await apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify(formData),
            });

            console.log('Login response:', data);

            if (data.success) {
                // If it's a new user and additional fields weren't shown, show them
                if (data.is_new_user && additionalFields.style.display === 'none') {
                    additionalFields.style.display = 'block';
                    showError('errorMessage', '신규 사용자입니다. 추가 정보를 입력해주세요.');
                    return;
                }

                // Clear any redirect flags
                sessionStorage.removeItem('redirecting');

                console.log('[LOGIN] Login successful!');
                console.log('[LOGIN] Response data:', data);
                console.log('[LOGIN] Token from response:', data.token);
                console.log('[LOGIN] Cookies before manual set:', document.cookie);

                // MANUAL COOKIE SETTING: Set cookie from response token
                // This ensures cookie is set even if server's Set-Cookie header doesn't work
                if (data.token) {
                    document.cookie = `session_token=${data.token}; path=/; max-age=7200; SameSite=Lax`;
                    console.log('[LOGIN] Manually set cookie with token');
                }

                // Small delay to ensure cookie is set
                await new Promise(resolve => setTimeout(resolve, 100));

                console.log('[LOGIN] Cookies after manual set:', document.cookie);

                // Verify cookie is set
                if (!document.cookie.includes('session_token')) {
                    console.error('[LOGIN] ERROR: Cookie still not set after manual setting!');
                    alert('쿠키 설정 실패! 브라우저 설정을 확인하세요.\n개발자 도구 콘솔을 확인하세요.');
                    return;
                }

                console.log('[LOGIN] Cookie successfully set!');
                console.log('[LOGIN] Login complete. Student:', data.student);

                // TEMPORARILY DISABLED: Auto redirect
                alert('로그인 성공!\n\n수동으로 /index.html로 이동해주세요.');

                // // Redirect based on submission status
                // if (data.student.is_submitted) {
                //     console.log('[LOGIN] Redirecting to result.html');
                //     window.location.href = '/result.html';
                // } else {
                //     console.log('[LOGIN] Redirecting to index.html');
                //     window.location.href = '/index.html';
                // }
            }
        } catch (error) {
            console.error('Login error:', error);
            // If login failed, might be new user - show additional fields
            const errorMsg = error.message;
            if (errorMsg.includes('not found') || errorMsg.includes('Invalid password')) {
                if (errorMsg.includes('Invalid password')) {
                    showError('errorMessage', '비밀번호가 일치하지 않습니다.');
                } else {
                    // New user
                    if (additionalFields.style.display === 'none') {
                        additionalFields.style.display = 'block';
                        showError('errorMessage', '신규 사용자입니다. 추가 정보를 입력해주세요.');
                    }
                }
            } else {
                showError('errorMessage', '로그인 중 오류가 발생했습니다: ' + errorMsg);
            }
        }
    });
});
