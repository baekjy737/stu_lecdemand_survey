// Admin page functionality

document.addEventListener('DOMContentLoaded', async () => {
    await loadStats();

    document.getElementById('downloadBtn').addEventListener('click', downloadCSV);
});

async function loadStats() {
    try {
        // Get statistics from the database
        const response = await fetch('/api/admin/stats', {
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('totalStudents').textContent = data.total || 0;
            document.getElementById('submittedStudents').textContent = data.submitted || 0;
            document.getElementById('unsubmittedStudents').textContent = data.unsubmitted || 0;
        } else {
            // If stats endpoint doesn't exist, just show placeholders
            document.getElementById('totalStudents').textContent = '-';
            document.getElementById('submittedStudents').textContent = '-';
            document.getElementById('unsubmittedStudents').textContent = '-';
        }
    } catch (error) {
        // Silently fail if stats not available
        console.log('Stats not available');
    }
}

function downloadCSV() {
    // Trigger CSV download
    window.location.href = '/api/admin/export';
}
