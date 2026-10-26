CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_no TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  bike_name TEXT NOT NULL,
  bike_number TEXT NOT NULL,
  bike_problem TEXT NOT NULL,
  spare_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT
);
