import os
import sqlite3
from datetime import datetime, date
from pathlib import Path
from flask import Flask, render_template, request, redirect, url_for, session, flash, g
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(32)

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / 'instance'
INSTANCE_DIR.mkdir(exist_ok=True)
DATABASE = INSTANCE_DIR / 'sivaji.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DATABASE)
    cur = db.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_no TEXT UNIQUE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        bike_name TEXT NOT NULL,
        bike_number TEXT NOT NULL,
        bike_problem TEXT NOT NULL,
        spare_price REAL DEFAULT 0,
        labor_price REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        total REAL DEFAULT 0,
        date TEXT DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'Pending',
        notes TEXT
    )''')
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    ('admin', generate_password_hash('admin123')))
    db.commit()
    db.close()

init_db()

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('dashboard'))
        flash('Invalid credentials', 'danger')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    total_jobs = db.execute('SELECT COUNT(*) as c FROM jobs').fetchone()['c']
    total_billed = db.execute('SELECT COALESCE(SUM(total),0) as t FROM jobs').fetchone()['t']
    spare_total = db.execute('SELECT COALESCE(SUM(spare_price),0) as s FROM jobs').fetchone()['s']
    labor_total = db.execute('SELECT COALESCE(SUM(labor_price),0) as l FROM jobs').fetchone()['l']
    recent = db.execute('SELECT * FROM jobs ORDER BY id DESC LIMIT 10').fetchall()
    return render_template('dashboard.html', total_jobs=total_jobs, total_billed=total_billed,
                          spare_total=spare_total, labor_total=labor_total, recent=recent)

@app.route('/add_job', methods=['GET', 'POST'])
def add_job():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    if request.method == 'POST':
        customer_name = request.form['customer_name']
        customer_phone = request.form['customer_phone']
        bike_name = request.form['bike_name']
        bike_number = request.form['bike_number'].upper()
        bike_problem = request.form['bike_problem']
        spare_price = float(request.form.get('spare_price') or 0)
        labor_price = float(request.form.get('labor_price') or 0)
        profit = float(request.form.get('profit') or 0)
        total = spare_price + labor_price
        notes = request.form.get('notes', '')
        
        # Get next job number
        last = db.execute('SELECT job_no FROM jobs ORDER BY id DESC LIMIT 1').fetchone()
        if last and last['job_no']:
            try:
                num = int(last['job_no'].replace('SBJ', '')) + 1
            except:
                num = db.execute('SELECT COUNT(*) as c FROM jobs').fetchone()['c'] + 1
        else:
            num = 1
        job_no = f'SBJ{num:05d}'
        
        try:
            db.execute('''INSERT INTO jobs (job_no, customer_name, customer_phone, bike_name, bike_number,
                                           bike_problem, spare_price, labor_price, profit, total, notes)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                       (job_no, customer_name, customer_phone, bike_name, bike_number,
                        bike_problem, spare_price, labor_price, profit, total, notes))
            db.commit()
            flash('Job added successfully', 'success')
            return redirect(url_for('jobs'))
        except Exception as e:
            db.rollback()
            flash(f'Error: {e}', 'danger')
    return render_template('add_job.html')

@app.route('/jobs')
def jobs():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    search = request.args.get('search', '')
    if search:
        jobs = db.execute('''SELECT * FROM jobs WHERE customer_name LIKE ? OR bike_number LIKE ? OR customer_phone LIKE ?
                            ORDER BY id DESC''', (f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
    else:
        jobs = db.execute('SELECT * FROM jobs ORDER BY id DESC').fetchall()
    return render_template('jobs.html', jobs=jobs, search=search)

@app.route('/view_job/<int:id>')
def view_job(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    job = db.execute('SELECT * FROM jobs WHERE id = ?', (id,)).fetchone()
    return render_template('view_job.html', job=job)

@app.route('/update_status/<int:id>', methods=['POST'])
def update_status(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('view_job', id=id))

@app.route('/delete_job/<int:id>')
def delete_job(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    db.execute('DELETE FROM jobs WHERE id = ?', (id,))
    db.commit()
    flash('Job deleted', 'success')
    return redirect(url_for('jobs'))

@app.route('/billing')
def billing():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    search = request.args.get('search', '')
    if search:
        jobs = db.execute('''SELECT * FROM jobs WHERE customer_name LIKE ? OR bike_number LIKE ?
                            OR customer_phone LIKE ? OR job_no LIKE ?
                            ORDER BY id DESC''',
                          (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
    else:
        jobs = db.execute('SELECT * FROM jobs ORDER BY id DESC').fetchall()
    total_billed = db.execute('SELECT COALESCE(SUM(total),0) as t FROM jobs').fetchone()['t']
    return render_template('billing/list.html', jobs=jobs, search=search, total_billed=total_billed)

@app.route('/bill/<int:id>')
def bill(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    db = get_db()
    job = db.execute('SELECT * FROM jobs WHERE id = ?', (id,)).fetchone()
    if not job:
        flash('Job not found', 'danger')
        return redirect(url_for('billing'))
    return render_template('billing/invoice.html', job=job, now=datetime.now())

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
