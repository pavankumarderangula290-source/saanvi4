
async function fetchAdminFees() {
    try {
        const res = await fetch('/api/admin/fees');
        const fees = await res.json();
        
        const tbody = document.getElementById('fees-table-body');
        tbody.innerHTML = '';
        
        let pendingTotal = 0;
        let collectedTotal = 0;

        fees.forEach(f => {
            if(f.status === 'pending') pendingTotal += f.amount;
            if(f.status === 'complete') collectedTotal += f.amount;

            const isPaid = f.status === 'complete';
            const statusBadge = isPaid 
            ? `<span style="color:var(--portal-success);font-weight:bold;">PAID</span>` 
            : `<span style="color:var(--portal-danger);font-weight:bold;">PENDING</span>`;
            
            let actionBtn = isPaid 
            ? `<span style="color:var(--portal-muted);">No Action</span>` 
            : `<button onclick="markFeePaid('${f.id}')" class="btn btn-outline" style="font-size:0.7rem;padding:0.2rem 0.5rem;border-color:var(--portal-success);color:var(--portal-success);">Mark Paid</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td>${f.studentId}</td>
            <td>${f.studentName || 'Unknown'}</td>
            <td>Class ${f.studentClass} ${f.studentSection}</td>
            <td>₹${f.amount}</td>
            <td>${new Date(f.dueDate).toLocaleDateString()}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('stats-fees-pending').innerText = '₹' + pendingTotal;
        document.getElementById('stats-fees-collected').innerText = '₹' + collectedTotal;

    } catch (err) {
        console.error(err);
        alert('Failed to load fees');
    }
}


async function markFeePaid(feeId) {
    if(confirm('Are you sure you want to manually mark this fee as paid?')) {
        try {
            await fetch(`/api/admin/fees/${feeId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status: 'complete', paymentMethod: 'admin_manual' })
            });
            fetchAdminFees();
        } catch (err) {
            console.error(err);
        }
    }
}


function filterFeesTable() {
    const query = document.getElementById('fees-table-search').value.toLowerCase();
    const rows = document.querySelectorAll('#fees-table-body tr');
    
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Load on start
document.addEventListener('DOMContentLoaded', fetchAdminFees);
