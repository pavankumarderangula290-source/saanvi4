const API_BASE = 'http://localhost:3000/api';
let currentStudent = null;
let currentFees = [];

async function fetchFees() {
    const studentId = document.getElementById('studentIdInput').value.trim();
    if (!studentId) {
        alert('Please enter a Student ID');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/fees/${studentId}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            alert(errData.error || 'Student not found or server error');
            return;
        }
        const data = await response.json();
        currentStudent = data.student;
        currentFees = data.fees;
        renderFees(data.student, data.fees);
    } catch (error) {
        console.error('Error fetching fees:', error);
        alert('Failed to fetch fees. Please try again later.');
    }
}

function renderFees(student, fees) {
    const container = document.getElementById('feeResultsContainer');
    const list = document.getElementById('feeList');
    
    // Add student info header
    let studentInfoHtml = `
        <div style="background:var(--portal-bg); padding:1rem; border-radius:6px; border:1px solid var(--portal-border); margin-bottom:1.5rem;">
            <h3 style="margin-bottom:0.25rem; color:var(--portal-primary);">${student.name}</h3>
            <div style="color:var(--portal-muted); font-size:0.875rem;">
                Student ID: <strong>${student.id}</strong> &nbsp;|&nbsp; 
                Class: <strong>${student.class} ${student.section}</strong>
            </div>
        </div>
    `;

    list.innerHTML = studentInfoHtml;
    container.style.display = 'block';

    if (fees.length === 0) {
        list.innerHTML += '<div class="portal-card" style="padding: 1.5rem; text-align: center; color: var(--portal-muted);">No fees found for this student.</div>';
        return;
    }

    fees.forEach(fee => {
        const isPaid = fee.status === 'complete';
        const statusColor = isPaid ? 'var(--portal-success)' : 'var(--portal-danger)';
        const statusText = isPaid ? 'PAID' : 'PENDING';
        
        let actionHtml = '';
        if (!isPaid) {
            actionHtml = `<button onclick="initiatePayment('${fee.id}')" class="btn btn-primary" style="background: var(--portal-accent);">Pay ₹${fee.amount}</button>`;
        } else {
            actionHtml = `
                <div style="color: var(--portal-success); font-weight: bold; margin-bottom: 0.5rem;">Paid on ${new Date(fee.paidDate).toLocaleDateString()}</div>
                <button onclick="downloadReceipt('${fee.id}')" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-color: #1e40af; color: #1e40af;">📥 Download Receipt</button>
            `;
        }

        const card = document.createElement('div');
        card.className = 'portal-card';
        card.style.padding = '1.5rem';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.innerHTML = `
            <div>
                <h4 style="margin-bottom: 0.25rem;">Fee Reference: ${fee.id}</h4>
                <div style="color: var(--portal-muted); font-size: 0.875rem;">Due Date: ${new Date(fee.dueDate).toLocaleDateString()}</div>
                <div style="color: var(--portal-muted); font-size: 0.875rem;">Remarks: ${fee.remarks || 'N/A'}</div>
                <div style="margin-top: 0.5rem;">
                    <span style="background: ${statusColor}20; color: ${statusColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                        ${statusText}
                    </span>
                </div>
            </div>
            <div style="text-align: right;">
                <h2 style="margin-bottom: 1rem; color: var(--portal-primary);">₹${fee.amount}</h2>
                ${actionHtml}
            </div>
        `;
        list.appendChild(card);
    });
}

async function initiatePayment(feeId) {
    const fee = currentFees.find(f => f.id === feeId);
    if(!fee) return;

    try {
        // Create order on backend
        const orderRes = await fetch(`${API_BASE}/fees/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feeId })
        });
        const orderData = await orderRes.json();
        
        if (!orderData.success) {
            alert('Failed to initiate payment: ' + orderData.error);
            return;
        }

        // Initialize Razorpay checkout
        const options = {
            "key": "rzp_test_T2zFx401TbtQ0W", 
            "amount": orderData.amount,
            "currency": orderData.currency,
            "name": "Saanvi International School",
            "description": "Fee Payment",
            "image": "images/logo.jpg",
            "order_id": orderData.order_id,
            "handler": async function (response) {
                // Verify payment on backend
                try {
                    const verifyRes = await fetch(`${API_BASE}/fees/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            feeId: feeId,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        alert('Payment successful! Your receipt will download automatically.');
                        // Generate receipt before refresh
                        fee.paidDate = new Date().toISOString(); // Temporary until refresh
                        await generateReceipt(currentStudent, fee);
                        fetchFees(); // Refresh
                    } else {
                        alert('Payment verification failed.');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error verifying payment.');
                }
            },
            "prefill": {
                "name": "Student Parent",
                "email": "parent@example.com",
                "contact": "9999999999"
            },
            "theme": {
                "color": "#0f172a"
            }
        };
        const rzp = new Razorpay(options);
        rzp.open();
    } catch (error) {
        console.error('Payment error:', error);
        alert('An error occurred while initiating payment.');
    }
}

function downloadReceipt(feeId) {
    const fee = currentFees.find(f => f.id === feeId);
    if(fee && currentStudent) {
        generateReceipt(currentStudent, fee); // It is async but we don't need to await it here
    }
}

function getBase64ImageFromUrl(imageUrl) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            var dataURL = canvas.toDataURL('image/jpeg');
            resolve(dataURL);
        };
        img.onerror = error => reject(error);
        img.src = imageUrl;
    });
}

async function generateReceipt(student, fee) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    try {
        const logoData = await getBase64ImageFromUrl('images/logo.jpg');
        doc.addImage(logoData, 'JPEG', 15, 15, 20, 20);
    } catch (e) {
        console.error("Could not load logo for PDF", e);
        // Fallback to placeholder if image fails to load
        doc.setFillColor(26, 54, 93);
        doc.circle(25, 25, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SIS", 19, 27);
    }

    // Header
    doc.setFontSize(22);
    doc.setTextColor(26, 54, 93);
    doc.text("Saanvi International School", 40, 24);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Excellence in Education | Official Fee Receipt", 40, 30);

    // Receipt Meta right-aligned
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("RECEIPT", 195, 24, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`No: ${fee.id}`, 195, 30, { align: 'right' });
    doc.text(`Date: ${new Date(fee.paidDate || Date.now()).toLocaleDateString()}`, 195, 35, { align: 'right' });

    // Divider
    doc.setDrawColor(26, 54, 93);
    doc.setLineWidth(1);
    doc.line(15, 45, 195, 45);

    // Student Info Table
    doc.autoTable({
        startY: 55,
        head: [['Student Information', '']],
        body: [
            ['Student Name', student.name],
            ['Student ID', student.id],
            ['Class & Section', `${student.class} ${student.section}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 50, fillColor: [248, 250, 252] },
            1: { cellWidth: 'auto' }
        },
        styles: { fontSize: 10, cellPadding: 3 }
    });

    // Payment Details Table
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Description / Remarks', 'Amount Paid']],
        body: [
            [fee.remarks || 'School Fee', `Rs. ${fee.amount}`]
        ],
        foot: [
            ['Total Received:', `Rs. ${fee.amount}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 12 },
        columnStyles: { 
            0: { cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 50, fontStyle: 'bold' }
        },
        bodyStyles: { minCellHeight: 40, valign: 'top' },
        styles: { fontSize: 10, cellPadding: 4 }
    });

    // Absolute Bottom Signature
    // A4 height is 297mm. We place signature at 270mm.
    const bottomY = 270;
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("This is a computer generated receipt.", 15, bottomY);
    doc.text("No physical signature is required.", 15, bottomY + 4);

    // Signature 
    doc.setFont("times", "italic");
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175); // Royal blue
    doc.text("Saanvi Admin", 195, bottomY - 5, { align: 'right' });
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(140, bottomY, 195, bottomY);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Authorized Signatory", 195, bottomY + 5, { align: 'right' });

    // Save
    doc.save(`receipt_${fee.id}.pdf`);
}
