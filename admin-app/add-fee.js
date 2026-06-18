async function searchStudent() {
    const q = document.getElementById('fee-student-search').value.trim();
    if (!q) {
        alert('Please enter a search term');
        return;
    }
    
    try {
        const res = await fetch(`/api/admin/students/search?q=${encodeURIComponent(q)}`);
        const students = await res.json();
        
        const resultsDiv = document.getElementById('search-results');
        if (students.length === 0) {
            resultsDiv.innerHTML = '<div style="color:var(--portal-danger); font-size:0.875rem;">No students found matching your search.</div>';
            return;
        }

        let html = '<ul style="list-style:none; padding:0; margin:0; border:1px solid var(--portal-border); border-radius:4px; max-height:200px; overflow-y:auto; background:white;">';
        students.forEach(s => {
            html += `
            <li style="padding:0.75rem; border-bottom:1px solid var(--portal-border); cursor:pointer; font-size:0.875rem;" 
                onclick="selectStudent('${s.id}')"
                onmouseover="this.style.backgroundColor='#f1f5f9'"
                onmouseout="this.style.backgroundColor='transparent'">
                <strong style="color:var(--portal-primary);">${s.name}</strong> 
                <span style="color:#666;">(ID: ${s.id})</span> - Class ${s.class} ${s.section}
            </li>`;
        });
        html += '</ul>';
        resultsDiv.innerHTML = html;
    } catch (err) {
        console.error(err);
        alert('Search failed to connect to the server.');
    }
}

function selectStudent(id) {
    document.getElementById('fee-student-id').value = id;
    document.getElementById('search-results').innerHTML = '<div style="color:var(--portal-success); font-size:0.875rem; font-weight:bold; padding:0.5rem; background:#e8f5e9; border-radius:4px;">✅ Student selected: ' + id + '</div>';
}

document.getElementById('add-fee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('fee-student-id').value.trim();
    const amount = parseFloat(document.getElementById('fee-amount').value);
    const dueDate = document.getElementById('fee-due-date').value;
    const remarks = document.getElementById('fee-remarks').value;

    if (!studentId) {
        alert("Please select a student from the search results or type a valid Student ID.");
        return;
    }

    try {
        const res = await fetch('/api/admin/fees', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ studentId, amount, dueDate, remarks })
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error! Status: ${res.status}`);
        }
        
        const data = await res.json();
        if(data.success) {
            alert('SUCCESS! The fee was successfully assigned to ' + studentId);
            window.location.href = 'admin-fees.html';
        } else {
            alert('ERROR ASSIGNING FEE: ' + (data.error || 'Unknown server error'));
        }
    } catch (err) {
        console.error("Assign fee error:", err);
        alert('FAILED: ' + err.message);
    }
});
