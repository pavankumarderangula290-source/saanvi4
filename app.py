from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
import uuid
from werkzeug.utils import secure_filename
import datetime
import random
import razorpay

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Initialize Razorpay Client with provided keys
razorpay_client = razorpay.Client(auth=("rzp_test_T2zFx401TbtQ0W", "WsZTgxHXdKbXZuFnRHXiQpLz"))

DB_FILE = 'database.sqlite'

_conn = sqlite3.connect(DB_FILE)
_conn.execute('''
    CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userType TEXT NOT NULL,
        verificationCode TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requestDate TEXT NOT NULL
    )
''')
_conn.commit()
_conn.close()

UPLOAD_FOLDER = 'uploads'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# ----------------------------------------
# STATIC FILES
# ----------------------------------------
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/admin')
@app.route('/admin/')
def admin_index():
    return send_from_directory('admin-app', 'index.html')

@app.route('/admin/<path:path>')
def serve_admin_static(path):
    if os.path.exists(os.path.join('admin-app', path)):
        return send_from_directory('admin-app', path)
    return "File not found", 404

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return "File not found", 404

@app.route('/uploads/<filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ----------------------------------------
# ADMIN API
# ----------------------------------------
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    admin = conn.execute('SELECT * FROM admin WHERE username = ? AND password = ?', (username, password)).fetchone()
    conn.close()
    if admin:
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route('/api/admin/credentials', methods=['PUT'])
def update_admin_credentials():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    conn.execute('UPDATE admin SET password = ? WHERE username = ?', (password, username))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/backup', methods=['GET'])
def download_backup():
    if os.path.exists(DB_FILE):
        return send_from_directory('.', DB_FILE, as_attachment=True, download_name='backup_database.sqlite')
    return "Database not found", 404

@app.route('/api/admin/restore', methods=['POST'])
def restore_backup():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400
        
    if file and file.filename.endswith('.sqlite'):
        file.save(DB_FILE)
        return jsonify({"success": True, "message": "Database restored successfully"})
        
    return jsonify({"success": False, "error": "Invalid file format. Please upload a .sqlite file"}), 400

# ----------------------------------------
# STAFF API
# ----------------------------------------
@app.route('/api/staff', methods=['GET'])
def get_staff():
    conn = get_db_connection()
    staff_rows = conn.execute('SELECT * FROM staff').fetchall()
    staff_list = []
    for s in staff_rows:
        s_dict = dict(s)
        tasks = conn.execute('SELECT * FROM tasks WHERE staffId = ?', (s['id'],)).fetchall()
        s_dict['tasks'] = [dict(t) for t in tasks]
        staff_list.append(s_dict)
    conn.close()
    return jsonify(staff_list)

@app.route('/api/staff', methods=['POST'])
def add_staff():
    staff_id = 'STF' + str(uuid.uuid4().hex)[:6].upper()
    
    if request.is_json:
        data = request.json
    else:
        data = request.form

    name = data.get('name')
    role = data.get('role')
    class_assigned = data.get('classAssigned')
    passcode = data.get('passcode')

    imagePath = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = f"{staff_id}_{filename}"
            file.save(os.path.join(UPLOAD_FOLDER, unique_filename))
            imagePath = unique_filename

    conn = get_db_connection()
    conn.execute('INSERT INTO staff (id, name, role, classAssigned, passcode, isFirstLogin, imagePath) VALUES (?, ?, ?, ?, ?, ?, ?)',
                 (staff_id, name, role, class_assigned, passcode, 1, imagePath))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": staff_id})

@app.route('/api/staff/<id>', methods=['DELETE'])
def delete_staff(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE staffId = ?', (id,))
    conn.execute('DELETE FROM staff WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/staff/login', methods=['POST'])
def staff_login():
    data = request.json
    passcode = data.get('passcode')
    conn = get_db_connection()
    staff = conn.execute('SELECT * FROM staff WHERE passcode = ?', (passcode,)).fetchone()
    conn.close()
    if staff:
        return jsonify({"success": True, "staff": dict(staff)})
    return jsonify({"success": False, "error": "Invalid passcode"}), 401

@app.route('/api/staff/<id>/passcode', methods=['PUT'])
def update_staff_passcode(id):
    data = request.json
    new_passcode = data.get('passcode')
    conn = get_db_connection()
    conn.execute('UPDATE staff SET passcode = ?, isFirstLogin = 0 WHERE id = ?', (new_passcode, id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ----------------------------------------
# TASKS API
# ----------------------------------------
@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    task_id = 'TSK' + str(uuid.uuid4().hex)[:6].upper()
    conn = get_db_connection()
    conn.execute('INSERT INTO tasks (id, staffId, description, assignedDate, deadline, status) VALUES (?, ?, ?, ?, ?, ?)',
                 (task_id, data['staffId'], data['description'], data['assignedDate'], data['deadline'], 'pending'))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": task_id})

@app.route('/api/tasks/<id>/status', methods=['PUT'])
def update_task_status(id):
    data = request.json
    status = data.get('status')
    conn = get_db_connection()
    conn.execute('UPDATE tasks SET status = ? WHERE id = ?', (status, id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ----------------------------------------
# TIMETABLE API
# ----------------------------------------
@app.route('/api/timetable', methods=['GET'])
def get_all_timetable():
    conn = get_db_connection()
    records = conn.execute('SELECT t.*, s.name as staffName FROM timetable t JOIN staff s ON t.staffId = s.id ORDER BY t.dayOfWeek, t.periodNumber').fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

@app.route('/api/timetable/staff/<staff_id>', methods=['GET'])
def get_staff_timetable(staff_id):
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM timetable WHERE staffId = ? ORDER BY dayOfWeek, periodNumber', (staff_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

@app.route('/api/admin/timetable', methods=['POST'])
def add_timetable():
    data = request.json
    tt_id = 'TT' + str(uuid.uuid4().hex)[:6].upper()
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO timetable (id, staffId, dayOfWeek, periodNumber, subject, class, section, startTime, endTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (tt_id, data['staffId'], data['dayOfWeek'], data['periodNumber'], data['subject'], data['class'], data['section'], data['startTime'], data['endTime']))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": tt_id})

@app.route('/api/admin/timetable/<id>', methods=['DELETE'])
def delete_timetable(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM timetable WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ----------------------------------------
# STUDENT API
# ----------------------------------------
@app.route('/api/students', methods=['GET'])
def get_students():
    conn = get_db_connection()
    student_rows = conn.execute('SELECT * FROM students').fetchall()
    student_list = []
    for s in student_rows:
        s_dict = dict(s)
        exams = conn.execute('SELECT * FROM exams WHERE studentId = ?', (s['id'],)).fetchall()
        s_dict['exams'] = [dict(e) for e in exams]
        student_list.append(s_dict)
    conn.close()
    return jsonify(student_list)

@app.route('/api/students', methods=['POST'])
def add_student():
    student_id = 'STU' + str(uuid.uuid4().hex)[:6].upper()
    
    if request.is_json:
        data = request.json
    else:
        data = request.form

    name = data.get('name')
    student_class = data.get('class')
    section = data.get('section', 'A')
    passcode = data.get('passcode', '1234')
    
    imagePath = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = f"{student_id}_{filename}"
            file.save(os.path.join(UPLOAD_FOLDER, unique_filename))
            imagePath = unique_filename

    conn = get_db_connection()
    conn.execute('INSERT INTO students (id, name, class, section, passcode, isFirstLogin, imagePath) VALUES (?, ?, ?, ?, ?, ?, ?)',
                 (student_id, name, student_class, section, passcode, 1, imagePath))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": student_id})

@app.route('/api/students/login', methods=['POST'])
def student_login():
    data = request.json
    student_id = data.get('studentId')
    passcode = data.get('passcode')
    conn = get_db_connection()
    student = conn.execute('SELECT * FROM students WHERE id = ? AND passcode = ?', (student_id, passcode)).fetchone()
    conn.close()
    if student:
        return jsonify({"success": True, "student": dict(student)})
    return jsonify({"success": False, "error": "Invalid student ID or passcode"}), 401

@app.route('/api/students/<id>/passcode', methods=['PUT'])
def update_student_passcode(id):
    data = request.json
    new_passcode = data.get('passcode')
    conn = get_db_connection()
    conn.execute('UPDATE students SET passcode = ?, isFirstLogin = 0 WHERE id = ?', (new_passcode, id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/exams', methods=['POST'])
def add_exam():
    data = request.json
    exam_id = 'EXM' + str(uuid.uuid4().hex)[:6].upper()
    remarks = data.get('remarks', '')
    conn = get_db_connection()
    conn.execute('INSERT INTO exams (id, studentId, examName, subject, marksObtained, totalMarks, date, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                 (exam_id, data['studentId'], data['examName'], data['subject'], data['marksObtained'], data['totalMarks'], data['date'], remarks))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": exam_id})


# ----------------------------------------
# ATTENDANCE API
# ----------------------------------------
@app.route('/api/attendance', methods=['POST'])
def submit_attendance():
    data = request.json
    date = data.get('date')
    session = data.get('session')
    marked_by = data.get('markedBy')
    records = data.get('records', []) # [{'studentId': '...', 'status': 'present/absent'}]
    
    is_sunday = False
    if date:
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
        if date_obj.weekday() == 6:
            is_sunday = True
    
    conn = get_db_connection()
    try:
        for record in records:
            att_id = 'ATT' + str(uuid.uuid4().hex)[:6].upper()
            student_id = record.get('studentId')
            status = record.get('status')
            
            if is_sunday:
                status = 'holiday'
            
            # Check if record already exists for this student, date and session
            existing = conn.execute('SELECT id FROM attendance WHERE studentId = ? AND date = ? AND session = ?', 
                                   (student_id, date, session)).fetchone()
            if existing:
                conn.execute('UPDATE attendance SET status = ?, markedBy = ? WHERE id = ?',
                             (status, marked_by, existing['id']))
            else:
                conn.execute('INSERT INTO attendance (id, studentId, date, session, status, markedBy) VALUES (?, ?, ?, ?, ?, ?)',
                             (att_id, student_id, date, session, status, marked_by))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/attendance', methods=['GET'])
def get_all_attendance():
    date = request.args.get('date')
    session = request.args.get('session')
    
    conn = get_db_connection()
    query = 'SELECT a.*, s.name as studentName FROM attendance a JOIN students s ON a.studentId = s.id'
    params = []
    
    if date and session:
        query += ' WHERE date = ? AND session = ?'
        params.extend([date, session])
        
    records = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

@app.route('/api/attendance/student/<student_id>', methods=['GET'])
def get_student_attendance(student_id):
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM attendance WHERE studentId = ? ORDER BY date DESC', (student_id,)).fetchall()
    
    total = len(records)
    present = sum(1 for r in records if r['status'] == 'present')
    percentage = (present / total * 100) if total > 0 else 0
    
    conn.close()
    return jsonify({
        "records": [dict(r) for r in records],
        "total": total,
        "present": present,
        "percentage": round(percentage, 2)
    })

# ----------------------------------------
# PASSWORD RESET API
# ----------------------------------------
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    user_id = data.get('userId')
    user_type = data.get('userType') # 'staff' or 'student'
    
    conn = get_db_connection()
    # Check if user exists
    table = 'staff' if user_type == 'staff' else 'students'
    user = conn.execute(f'SELECT * FROM {table} WHERE id = ?', (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({"success": False, "error": "User not found"}), 404
        
    reset_id = 'RES' + str(uuid.uuid4().hex)[:6].upper()
    verification_code = str(random.randint(100000, 999999))
    req_date = datetime.datetime.now().isoformat()
    
    conn.execute('INSERT INTO password_resets (id, userId, userType, verificationCode, status, requestDate) VALUES (?, ?, ?, ?, ?, ?)',
                 (reset_id, user_id, user_type, verification_code, 'pending', req_date))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True})

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    user_id = data.get('userId')
    user_type = data.get('userType')
    code = data.get('code')
    new_password = data.get('newPassword')
    
    conn = get_db_connection()
    req = conn.execute('SELECT * FROM password_resets WHERE userId = ? AND userType = ? AND verificationCode = ? AND status = ?', 
                       (user_id, user_type, code, 'pending')).fetchone()
                       
    if not req:
        conn.close()
        return jsonify({"success": False, "error": "Invalid or expired verification code"}), 400
        
    # Update password
    table = 'staff' if user_type == 'staff' else 'students'
    conn.execute(f'UPDATE {table} SET passcode = ?, isFirstLogin = 0 WHERE id = ?', (new_password, user_id))
    
    # Mark resolved
    conn.execute('UPDATE password_resets SET status = ? WHERE id = ?', ('resolved', req['id']))
    
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/password-resets', methods=['GET'])
def get_password_resets():
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM password_resets WHERE status = "pending" ORDER BY requestDate DESC').fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

# ----------------------------------------
# ANNOUNCEMENTS API
# ----------------------------------------
@app.route('/api/announcements', methods=['GET'])
def get_announcements():
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM announcements ORDER BY date DESC').fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

@app.route('/api/admin/announcements', methods=['POST'])
def add_announcement():
    ann_id = 'ANN' + str(uuid.uuid4().hex)[:6].upper()
    title = request.form.get('title')
    content = request.form.get('content')
    date_str = request.form.get('date', '') 
    
    if not date_str:
        from datetime import datetime
        date_str = datetime.now().isoformat()
        
    attachment = None
    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = f"{ann_id}_{filename}"
            file.save(os.path.join(UPLOAD_FOLDER, unique_filename))
            attachment = unique_filename
        
    conn = get_db_connection()
    conn.execute('INSERT INTO announcements (id, title, content, date, attachment) VALUES (?, ?, ?, ?, ?)',
                 (ann_id, title, content, date_str, attachment))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": ann_id, "attachment": attachment})

@app.route('/api/admin/announcements/<id>', methods=['DELETE'])
def delete_announcement(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM announcements WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ----------------------------------------
# FEES API
# ----------------------------------------
@app.route('/api/fees/<student_id>', methods=['GET'])
def get_student_fees(student_id):
    conn = get_db_connection()
    student = conn.execute('SELECT id, name, class, section FROM students WHERE id = ?', (student_id,)).fetchone()
    if not student:
        conn.close()
        return jsonify({"error": "Student not found"}), 404
        
    records = conn.execute('SELECT * FROM fees WHERE studentId = ? ORDER BY dueDate DESC', (student_id,)).fetchall()
    conn.close()
    return jsonify({
        "student": dict(student),
        "fees": [dict(r) for r in records]
    })

@app.route('/api/fees/create-order', methods=['POST'])
def create_fee_order():
    data = request.json
    fee_id = data.get('feeId')
    
    conn = get_db_connection()
    fee = conn.execute('SELECT * FROM fees WHERE id = ? AND status = "pending"', (fee_id,)).fetchone()
    
    if not fee:
        conn.close()
        return jsonify({"success": False, "error": "Fee not found or already paid"}), 400
        
    amount = int(fee['amount'] * 100) # Razorpay expects amount in paise
    
    # Create Razorpay Order
    data = {
        "amount": amount,
        "currency": "INR",
        "receipt": f"receipt_{fee_id}"
    }
    try:
        order = razorpay_client.order.create(data=data)
        conn.close()
        return jsonify({"success": True, "order_id": order['id'], "amount": amount, "currency": "INR"})
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/fees/verify-payment', methods=['POST'])
def verify_fee_payment():
    data = request.json
    fee_id = data.get('feeId')
    payment_id = data.get('razorpay_payment_id')
    order_id = data.get('razorpay_order_id')
    signature = data.get('razorpay_signature')
    
    try:
        # Verify Signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature
        })
        
        # Mark fee as paid
        conn = get_db_connection()
        paid_date = datetime.datetime.now().isoformat()
        conn.execute('UPDATE fees SET status = "complete", paidDate = ?, paymentMethod = "online", transactionId = ? WHERE id = ?',
                     (paid_date, payment_id, fee_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": "Payment verification failed"}), 400

@app.route('/api/admin/fees', methods=['GET'])
def get_all_fees():
    conn = get_db_connection()
    records = conn.execute('''
        SELECT f.*, s.name as studentName, s.class as studentClass, s.section as studentSection
        FROM fees f JOIN students s ON f.studentId = s.id ORDER BY f.dueDate DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

@app.route('/api/admin/fees', methods=['POST'])
def add_fee():
    data = request.json
    fee_id = 'FEE' + str(uuid.uuid4().hex)[:6].upper()
    student_id = data.get('studentId')
    amount = data.get('amount')
    due_date = data.get('dueDate')
    remarks = data.get('remarks', '')
    
    conn = get_db_connection()
    
    # Validate student exists
    student = conn.execute('SELECT id FROM students WHERE id = ?', (student_id,)).fetchone()
    if not student:
        conn.close()
        return jsonify({"success": False, "error": "Student ID does not exist"}), 400
        
    try:
        conn.execute('INSERT INTO fees (id, studentId, amount, dueDate, remarks) VALUES (?, ?, ?, ?, ?)',
                     (fee_id, student_id, amount, due_date, remarks))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500
        
    conn.close()
    return jsonify({"success": True, "id": fee_id})

@app.route('/api/admin/fees/<fee_id>', methods=['PUT'])
def update_fee(fee_id):
    data = request.json
    status = data.get('status')
    payment_method = data.get('paymentMethod')
    
    conn = get_db_connection()
    if status == 'complete':
        paid_date = datetime.datetime.now().isoformat()
        conn.execute('UPDATE fees SET status = ?, paymentMethod = ?, paidDate = ? WHERE id = ?',
                     (status, payment_method, paid_date, fee_id))
    else:
        conn.execute('UPDATE fees SET status = ?, paymentMethod = NULL, paidDate = NULL WHERE id = ?',
                     (status, fee_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/students/search', methods=['GET'])
def search_students():
    query = request.args.get('q', '')
    conn = get_db_connection()
    records = conn.execute('SELECT id, name, class, section FROM students WHERE name LIKE ? OR id LIKE ? LIMIT 10',
                           (f'%{query}%', f'%{query}%')).fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])

if __name__ == '__main__':
    app.run(port=3000, debug=True)
