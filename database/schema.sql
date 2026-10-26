-- BikeCare Database Schema
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Shop settings
CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT DEFAULT 'BikeCare Service Center',
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_no TEXT,
    logo_path TEXT,
    tax_rate REAL DEFAULT 0.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_primary TEXT NOT NULL,
    phone_alt TEXT,
    address TEXT,
    city TEXT,
    notes TEXT,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bikes
CREATE TABLE IF NOT EXISTS bikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    bike_name TEXT,
    model TEXT,
    manufacturing_year INTEGER,
    fuel_type TEXT,
    odometer_reading INTEGER DEFAULT 0,
    colour TEXT,
    engine_number TEXT,
    chassis_number TEXT,
    notes TEXT,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_number TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spare parts
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id TEXT UNIQUE NOT NULL,
    part_name TEXT NOT NULL,
    part_number TEXT,
    brand TEXT,
    description TEXT,
    purchase_cost REAL DEFAULT 0.0,
    selling_price REAL DEFAULT 0.0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    supplier_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Services/Job Cards
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT UNIQUE NOT NULL,
    bike_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    service_date DATE NOT NULL,
    entry_time TIME,
    odometer_reading INTEGER,
    customer_complaint TEXT,
    initial_inspection TEXT,
    work_requested TEXT,
    assigned_mechanic TEXT,
    expected_delivery_date DATE,
    expected_delivery_time TIME,
    actual_delivery_date DATE,
    actual_delivery_time TIME,
    status TEXT DEFAULT 'Received',
    additional_notes TEXT,
    next_service_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- Service status history
CREATE TABLE IF NOT EXISTS service_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    changed_by INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Service items (spare parts used)
CREATE TABLE IF NOT EXISTS service_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    part_id INTEGER,
    item_name TEXT NOT NULL,
    item_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total REAL NOT NULL,
    is_custom INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE SET NULL
);

-- Labor charges
CREATE TABLE IF NOT EXISTS labor_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    rate REAL NOT NULL,
    total_cost REAL NOT NULL,
    assigned_mechanic TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    service_id INTEGER UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    parts_total REAL DEFAULT 0.0,
    labor_total REAL DEFAULT 0.0,
    additional_charges REAL DEFAULT 0.0,
    discount REAL DEFAULT 0.0,
    tax_amount REAL DEFAULT 0.0,
    subtotal REAL DEFAULT 0.0,
    final_total REAL DEFAULT 0.0,
    amount_paid REAL DEFAULT 0.0,
    balance_due REAL DEFAULT 0.0,
    payment_status TEXT DEFAULT 'Unpaid',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_time TIME,
    amount_received REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_ref TEXT,
    notes TEXT,
    received_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Stock movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    moved_by INTEGER,
    moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT,
    FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Service reminders
CREATE TABLE IF NOT EXISTS service_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    service_id INTEGER,
    reminder_date DATE NOT NULL,
    reminder_type TEXT,
    odometer_reading INTEGER,
    contacted INTEGER DEFAULT 0,
    contacted_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    details TEXT,
    ip_address TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_primary);
CREATE INDEX IF NOT EXISTS idx_bikes_reg ON bikes(registration_number);
CREATE INDEX IF NOT EXISTS idx_services_date ON services(service_date);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_parts_stock ON parts(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_logged ON audit_logs(logged_at);
