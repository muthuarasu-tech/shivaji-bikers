import os
import sqlite3
from werkzeug.security import generate_password_hash
from pathlib import Path

def init_db():
    base_dir = Path(__file__).resolve().parent.parent
    instance_dir = base_dir / 'instance'
    instance_dir.mkdir(exist_ok=True)
    db_path = instance_dir / 'bikecare.db'
    
    # Read schema
    schema_path = Path(__file__).resolve().parent / 'schema.sql'
    with open(schema_path, 'r') as f:
        schema = f.read()
    
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.executescript(schema)
    
    # Check if admin exists
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM users')
    count = cur.fetchone()[0]
    
    if count == 0:
        # Create default admin
        password_hash = generate_password_hash('admin123')
        cur.execute('''INSERT INTO users (username, password_hash, full_name, role)
                      VALUES (?, ?, ?, ?)''', ('admin', password_hash, 'Administrator', 'admin'))
        print("Created default admin user: admin / admin123")
    
    # Insert default shop settings if not exists
    cur.execute('SELECT COUNT(*) FROM shop_settings')
    if cur.fetchone()[0] == 0:
        cur.execute('''INSERT INTO shop_settings (shop_name, address, phone)
                      VALUES (?, ?, ?)''', ('BikeCare Service Center', 'Shop Address', '0000000000'))
    
    conn.commit()
    conn.close()
    print(f"Database initialized at {db_path}")

if __name__ == '__main__':
    init_db()
