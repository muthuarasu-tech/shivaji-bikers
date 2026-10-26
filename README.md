# BikeCare - Bike Service and Repair Management System

A complete, professional bike service and repair management system built with Flask, SQLite, and Bootstrap 5.

## Features

- Customer Management
- Bike Registration
- Service Job Cards
- Spare Parts Inventory
- Labor Charges
- Billing & Invoicing
- Payment Management
- Service History
- Reports & Analytics
- Database Viewer (Admin)
- Backup & Restore
- User Authentication

## Installation

1. Clone or extract the project
2. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize database:
```bash
python database/init_db.py
```

5. Run application:
```bash
python app.py
```

6. Open browser and go to: http://localhost:5000

## Configuration

Set `SECRET_KEY` to a long, random value before deploying so sessions remain secure across restarts.
If it is not set, the application generates a temporary key at startup, which invalidates sessions
when the application restarts.

PowerShell:
```powershell
$env:SECRET_KEY = "replace-with-a-long-random-value"
```

Linux/macOS:
```bash
export SECRET_KEY="replace-with-a-long-random-value"
```

## Default Login
- Username: admin
- Password: admin123

**Important:** Change the default password after first login!

## Database
- SQLite database located at: `instance/bikecare.db`
- View with DB Browser for SQLite

## Project Structure
See app.py for full structure

## License
MIT License
