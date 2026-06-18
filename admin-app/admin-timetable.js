sessionManager.requireAuth('admin');

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

let allStaff = [];
let allTimetable = [];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function init() {
    allStaff = await adminApi.getStaff();
    
    // Populate staff dropdown in modal
    const staffSelect = document.getElementById('tt-staff');
    staffSelect.innerHTML = '<option value="" disabled selected>Select Staff Member</option>' + 
        allStaff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('');

    // Populate filter dropdown
    const filterSelect = document.getElementById('staff-filter');
    filterSelect.innerHTML = '<option value="">All Staff</option>' + 
        allStaff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    await loadData();
}

async function loadData() {
    allTimetable = await adminApi.getTimetable();
    renderTimetable();
}

function renderTimetable() {
    const container = document.getElementById('timetable-container');
    const filterId = document.getElementById('staff-filter').value;
    
    let staffToRender = allStaff;
    if (filterId) {
        staffToRender = allStaff.filter(s => s.id === filterId);
    }

    if (staffToRender.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--portal-muted); padding: 2rem;">No staff found.</p>';
        return;
    }

    let html = '';
    for (const staff of staffToRender) {
        const tt = allTimetable.filter(t => t.staffId === staff.id);
        
        html += `<h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--portal-primary);">${staff.name} (${staff.id})</h4>`;
        
        if (tt.length === 0) {
            html += `<p style="color: var(--portal-muted); font-size: 0.875rem;">No timetable assigned.</p>`;
            continue;
        }

        html += `<div class="tt-grid">`;
        // Header row
        html += `<div class="tt-header">Day / Period</div>`;
        for (let i = 1; i <= 6; i++) {
            html += `<div class="tt-header">Period ${i}</div>`;
        }

        for (const day of days) {
            const dayRecords = tt.filter(t => t.dayOfWeek === day);
            if (dayRecords.length === 0 && !filterId) continue; // Skip empty days unless specifically filtering for one staff

            html += `<div class="tt-header" style="display:flex; align-items:center; justify-content:center;">${day}</div>`;
            
            for (let i = 1; i <= 6; i++) {
                const record = dayRecords.find(r => r.periodNumber === i);
                if (record) {
                    html += `
                        <div class="tt-cell">
                            <div class="tt-period">${formatTime(record.startTime)} - ${formatTime(record.endTime)}</div>
                            <div class="tt-subject">${record.subject}</div>
                            <div class="tt-class">Class: ${record.class} ${record.section}</div>
                            <div class="tt-action" onclick="deleteTimetable('${record.id}')">Delete</div>
                        </div>
                    `;
                } else {
                    html += `<div class="tt-cell" style="background: #f8fafc; color: var(--portal-muted); font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">Free</div>`;
                }
            }
        }
        html += `</div>`;
    }

    container.innerHTML = html;
}

function formatTime(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${m} ${ampm}`;
}

function openAddTimetableModal() {
    document.getElementById('add-tt-form').reset();
    openModal('add-tt-modal');
}

document.getElementById('add-tt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        staffId: document.getElementById('tt-staff').value,
        dayOfWeek: document.getElementById('tt-day').value,
        periodNumber: parseInt(document.getElementById('tt-period').value),
        subject: document.getElementById('tt-subject').value,
        class: document.getElementById('tt-class').value,
        section: document.getElementById('tt-section').value,
        startTime: document.getElementById('tt-start').value,
        endTime: document.getElementById('tt-end').value
    };

    const res = await adminApi.addTimetable(data);
    if (res.success) {
        closeModal('add-tt-modal');
        await loadData();
    } else {
        alert("Failed to add timetable.");
    }
});

async function deleteTimetable(id) {
    if (confirm('Are you sure you want to delete this period?')) {
        const success = await adminApi.deleteTimetable(id);
        if (success) {
            await loadData();
        } else {
            alert("Failed to delete.");
        }
    }
}

init();
