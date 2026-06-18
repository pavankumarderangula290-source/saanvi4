const DB_KEYS = {
    SESSION: 'saanvi_session'
};

const sessionManager = {
    createSession(type, id) {
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify({ type, id }));
    },
    getSession() {
        const session = localStorage.getItem(DB_KEYS.SESSION);
        return session ? JSON.parse(session) : null;
    },
    clearSession() {
        const session = this.getSession();
        localStorage.removeItem(DB_KEYS.SESSION);
        if (session) {
            if (session.type === 'admin') window.location.href = '/admin/';
            else if (session.type === 'staff') window.location.href = '/staff-login.html';
            else window.location.href = '/student-login.html';
        } else {
            window.location.href = '/';
        }
    },
    requireAuth(type) {
        const session = this.getSession();
        if (!session || (type && session.type !== type)) {
            if (type === 'admin') window.location.href = '/admin/';
            else if (type === 'staff') window.location.href = '/staff-login.html';
            else window.location.href = '/student-login.html';
        }
        return session;
    }
};

const sharedApi = {
    async forgotPassword(userId, userType) {
        const res = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, userType })
        });
        return await res.json();
    },
    async resetPassword(userId, userType, code, newPassword) {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, userType, code, newPassword })
        });
        return await res.json();
    }
};

const adminApi = {
    async verifyLogin(username, password) {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        return res.ok;
    },
    async updateCredentials(newUsername, newPassword) {
        const res = await fetch('/api/admin/credentials', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: newUsername, password: newPassword})
        });
        return res.ok;
    },
    downloadBackup() {
        window.location.href = '/api/admin/backup';
    },
    async restoreBackup(file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/admin/restore', {
            method: 'POST',
            body: formData
        });
        return await res.json();
    },
    async getStaff() {
        const res = await fetch('/api/staff');
        return await res.json();
    },
    async addStaff(staffObj) {
        const isFormData = staffObj instanceof FormData;
        const options = {
            method: 'POST',
            body: isFormData ? staffObj : JSON.stringify(staffObj)
        };
        if (!isFormData) {
            options.headers = {'Content-Type': 'application/json'};
        }
        const res = await fetch('/api/staff', options);
        return await res.json();
    },
    async deleteStaff(id) {
        const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
        return res.ok;
    },
    async assignTask(staffId, taskDesc, deadline) {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                staffId: staffId,
                description: taskDesc,
                assignedDate: new Date().toISOString().split('T')[0],
                deadline: deadline
            })
        });
        return res.ok;
    },
    async getPasswordResets() {
        const res = await fetch('/api/admin/password-resets');
        return await res.json();
    },
    async getTimetable() {
        const res = await fetch('/api/timetable');
        return await res.json();
    },
    async addTimetable(ttObj) {
        const res = await fetch('/api/admin/timetable', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(ttObj)
        });
        return await res.json();
    },
    async deleteTimetable(id) {
        const res = await fetch(`/api/admin/timetable/${id}`, { method: 'DELETE' });
        return res.ok;
    }
};

const staffApi = {
    async verifyLogin(passcode) {
        const res = await fetch('/api/staff/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({passcode})
        });
        if (res.ok) {
            const data = await res.json();
            return data.staff;
        }
        return null;
    },
    async getProfile(id) {
        const staffList = await adminApi.getStaff();
        return staffList.find(s => s.id === id);
    },
    async getTimetable(id) {
        const res = await fetch(`/api/timetable/staff/${id}`);
        return await res.json();
    },
    async updatePasscode(id, newPasscode) {
        const res = await fetch(`/api/staff/${id}/passcode`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({passcode: newPasscode})
        });
        return res.ok;
    },
    async updateTaskStatus(taskId, status) {
        const res = await fetch(`/api/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status})
        });
        return res.ok;
    },
    async getStudents() {
        const res = await fetch('/api/students');
        return await res.json();
    },
    async addStudent(studentObj) {
        const isFormData = studentObj instanceof FormData;
        const options = {
            method: 'POST',
            body: isFormData ? studentObj : JSON.stringify(studentObj)
        };
        if (!isFormData) {
            options.headers = {'Content-Type': 'application/json'};
        }
        const res = await fetch('/api/students', options);
        return await res.json();
    },
    async addExamMarks(studentId, examData) {
        examData.studentId = studentId;
        examData.date = new Date().toISOString().split('T')[0];
        const res = await fetch('/api/exams', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(examData)
        });
        return await res.json();
    },
    async submitAttendance(attendanceData) {
        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(attendanceData)
        });
        return res.ok;
    }
};

const studentApi = {
    async verifyLogin(studentId, passcode) {
        const res = await fetch('/api/students/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({studentId, passcode})
        });
        if (res.ok) {
            const data = await res.json();
            return data.student;
        }
        return null;
    },
    async getProfile(id) {
        const students = await staffApi.getStudents();
        return students.find(s => s.id === id);
    },
    async updatePasscode(id, newPasscode) {
        const res = await fetch(`/api/students/${id}/passcode`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({passcode: newPasscode})
        });
        return res.ok;
    },
    async getAttendance(id) {
        const res = await fetch(`/api/attendance/student/${id}`);
        return await res.json();
    }
};

function showAlert(id, message, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = `alert alert-${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}
