import type { Config, Context } from "@netlify/functions";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, ilike, or, sql, sum } from "drizzle-orm";
import { db } from "../../db/index.js";
import { jobs, sessions, users, type Job } from "../../db/schema.js";

const SESSION_COOKIE = "sb_session";
const FLASH_COOKIE = "sb_flash";
const SESSION_HOURS = 12;

type Flash = { category: string; message: string };
type User = { id: number; username: string };

// ---------- helpers ----------

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const money = (n: number | null | undefined) => Number(n ?? 0).toFixed(2);

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name: string, value: string, maxAge?: number): string {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

function redirect(location: string, opts: { flash?: Flash; cookies?: string[] } = {}): Response {
  const headers = new Headers({ Location: location });
  for (const c of opts.cookies ?? []) headers.append("Set-Cookie", c);
  if (opts.flash) headers.append("Set-Cookie", cookie(FLASH_COOKIE, JSON.stringify(opts.flash), 60));
  return new Response(null, { status: 303, headers });
}

function readFlash(req: Request): Flash | null {
  const raw = parseCookies(req)[FLASH_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function html(req: Request, body: string, status = 200): Response {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  if (parseCookies(req)[FLASH_COOKIE]) headers.append("Set-Cookie", cookie(FLASH_COOKIE, "", 0));
  return new Response(body, { status, headers });
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

async function currentUser(req: Request): Promise<User | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

// ---------- templates ----------

const LOGO = `<img src="/logo.png" onerror="this.src='/logo.jpg'" alt="SHIVAJI BIKERS logo">`;

const HEAD = `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">`;

function layout(content: string, opts: { user: User | null; flash: Flash | null }): string {
  const nav = opts.user
    ? `<nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
            <a class="navbar-brand" href="/dashboard">${LOGO} SHIVAJI BIKERS</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link" href="/dashboard"><i class="bi bi-house-door"></i> Dashboard</a></li>
                    <li class="nav-item"><a class="nav-link" href="/add_job"><i class="bi bi-plus-circle"></i> Add Job</a></li>
                    <li class="nav-item"><a class="nav-link" href="/jobs"><i class="bi bi-list-check"></i> All Jobs</a></li>
                    <li class="nav-item"><a class="nav-link" href="/billing"><i class="bi bi-receipt"></i> Billing</a></li>
                    <li class="nav-item"><a class="nav-link" href="/logout"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
                </ul>
            </div>
        </div>
    </nav>`
    : "";
  const flash = opts.flash
    ? `<div class="alert alert-${esc(opts.flash.category)} alert-dismissible fade show">${esc(opts.flash.message)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${HEAD}
    <title>SHIVAJI BIKERS - Bike Service</title>
    <style>
        * { font-family: 'Rajdhani', sans-serif; }
        body { background: linear-gradient(135deg, #000000 0%, #1a0000 100%); min-height: 100vh; }
        .navbar { background: linear-gradient(90deg, #000000 0%, #dc143c 100%); box-shadow: 0 4px 20px rgba(220, 20, 60, 0.6); }
        .navbar-brand { color: #fff !important; font-weight: 700; font-size: 1.6rem; display: flex; align-items: center; gap: 10px; }
        .navbar-brand img { height: 45px; border-radius: 50%; border: 2px solid #ffd700; }
        .nav-link { color: #fff !important; font-weight: 600; margin: 0 8px; }
        .nav-link:hover { color: #ffd700 !important; }
        .card { background: linear-gradient(145deg, #111, #000); border: 2px solid #dc143c; border-radius: 12px; color: #fff; box-shadow: 0 8px 32px rgba(220,20,60,0.4); }
        .card-header { background: linear-gradient(90deg, #dc143c, #8b0000); border: none; font-weight: 700; font-size: 1.1rem; }
        .btn-primary { background: linear-gradient(90deg, #dc143c, #ff0000); border: none; font-weight: 600; }
        .btn-primary:hover { background: linear-gradient(90deg, #ff0000, #dc143c); }
        .btn-danger { background: linear-gradient(90deg, #8b0000, #dc143c); border: none; }
        .form-control, .form-select { background: #111; border: 1px solid #dc143c; color: #fff; }
        .form-control:focus, .form-select:focus { background: #111; color: #fff; border-color: #ff0000; box-shadow: 0 0 0 0.25rem rgba(220,20,60,0.25); }
        .table { color: #fff; }
        .logo-big { display: flex; align-items: center; justify-content: center; gap: 15px; }
        .logo-big img { height: 80px; border-radius: 50%; border: 3px solid #ffd700; box-shadow: 0 0 30px rgba(255,215,0,0.5); }
        .brand-text { font-size: 3rem; font-weight: 700; background: linear-gradient(90deg, #fff, #ffd700, #dc143c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    </style>
</head>
<body>
    ${nav}
    <div class="container mt-4">
        ${flash}
        ${content}
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

const loginPage = () => `<div class="row justify-content-center align-items-center" style="min-height: 80vh;">
    <div class="col-md-4">
        <div class="card">
            <div class="card-header text-center">
                <div class="logo-big">${LOGO}</div>
                <div class="brand-text">SHIVAJI BIKERS</div>
                <small>Bike Service &amp; Repair</small>
            </div>
            <div class="card-body">
                <form method="POST" action="/login">
                    <div class="mb-3">
                        <label class="form-label"><i class="bi bi-person"></i> Username</label>
                        <input type="text" class="form-control" name="username" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label"><i class="bi bi-lock"></i> Password</label>
                        <input type="password" class="form-control" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100"><i class="bi bi-box-arrow-in-right"></i> LOGIN</button>
                </form>
            </div>
        </div>
    </div>
</div>`;

function jobRows(list: Job[], actions: (job: Job) => string): string {
  if (list.length === 0) return `<tr><td colspan="9" class="text-center">No jobs found</td></tr>`;
  return list
    .map(
      (job) => `<tr>
                        <td><strong style="color: #ffd700;">${esc(job.jobNo)}</strong></td>
                        <td>${esc(job.date)}</td>
                        <td>${esc(job.customerName)}</td>
                        <td>${esc(job.customerPhone)}</td>
                        <td>${esc(job.bikeName)}</td>
                        <td>${esc(job.bikeNumber)}</td>
                        <td>${esc(job.bikeProblem)}</td>
                        <td>₹${money(job.sparePrice)}</td>
                        <td>${actions(job)}</td>
                    </tr>`
    )
    .join("");
}

const JOB_TABLE_HEAD = `<thead>
                    <tr style="background: #000;">
                        <th>Job No</th><th>Date</th><th>Customer Name</th><th>Phone No</th><th>Bike Name</th>
                        <th>Bike Number</th><th>Bike Problem</th><th>Spare Price</th><th>Action</th>
                    </tr>
                </thead>`;

function statCard(icon: string, color: string, value: string, label: string): string {
  return `<div class="col-md-3">
        <div class="card text-center">
            <div class="card-body">
                <i class="bi ${icon}" style="font-size: 2rem; color: ${color};"></i>
                <h3>${value}</h3>
                <p>${label}</p>
            </div>
        </div>
    </div>`;
}

function dashboardPage(stats: { totalJobs: number; totalBilled: number; spareTotal: number; laborTotal: number }, recent: Job[]): string {
  return `<div class="text-center mb-4">
    <div class="logo-big">${LOGO}<div class="brand-text">SHIVAJI BIKERS</div></div>
    <p class="text-white">Bike Service &amp; Repair Management</p>
</div>
<div class="row mb-4">
    ${statCard("bi-file-earmark-text", "#dc143c", String(stats.totalJobs), "Total Jobs")}
    ${statCard("bi-receipt", "#ffd700", `₹${money(stats.totalBilled)}`, "Total Billed")}
    ${statCard("bi-gear", "#ffa500", `₹${money(stats.spareTotal)}`, "Spare Total")}
    ${statCard("bi-wrench", "#32cd32", `₹${money(stats.laborTotal)}`, "Labor Total")}
</div>
<div class="card">
    <div class="card-header d-flex justify-content-between">
        <span><i class="bi bi-clock"></i> Recent Jobs</span>
        <a href="/add_job" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add New Job</a>
    </div>
    <div class="card-body">
        <div class="table-responsive">
            <table class="table table-hover">
                ${JOB_TABLE_HEAD}
                <tbody>
                    ${jobRows(recent, (job) => `<a href="/view_job/${job.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>`)}
                </tbody>
            </table>
        </div>
    </div>
</div>`;
}

const addJobPage = () => `<div class="card mb-4">
    <div class="card-header"><i class="bi bi-plus-circle"></i> ADD NEW JOB</div>
    <div class="card-body">
        <form method="POST" action="/add_job">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Customer Name *</label>
                    <input type="text" class="form-control" name="customer_name" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Customer Phone Number *</label>
                    <input type="tel" class="form-control" name="customer_phone" required>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Bike Name *</label>
                    <input type="text" class="form-control" name="bike_name" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Bike Number *</label>
                    <input type="text" class="form-control" name="bike_number" required>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Bike Problem *</label>
                <textarea class="form-control" name="bike_problem" rows="3" required></textarea>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Spare Price (₹)</label>
                    <input type="number" step="0.01" class="form-control" name="spare_price" value="0">
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Labor Price (₹)</label>
                    <input type="number" step="0.01" class="form-control" name="labor_price" value="0">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="2"></textarea>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> SAVE JOB</button>
            <a href="/jobs" class="btn btn-secondary">CANCEL</a>
        </form>
    </div>
</div>`;

function searchForm(action: string, search: string, placeholder: string): string {
  return `<form method="GET" action="${action}" class="mb-3">
            <div class="input-group">
                <input type="text" class="form-control" name="search" placeholder="${placeholder}" value="${esc(search)}">
                <button class="btn btn-primary" type="submit"><i class="bi bi-search"></i> Search</button>
            </div>
        </form>`;
}

function jobsPage(list: Job[], search: string): string {
  return `<div class="card">
    <div class="card-header d-flex justify-content-between">
        <span><i class="bi bi-list-check"></i> ALL JOBS</span>
        <a href="/add_job" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add Job</a>
    </div>
    <div class="card-body">
        ${searchForm("/jobs", search, "Search by customer name, phone, or bike number")}
        <div class="table-responsive">
            <table class="table table-hover">
                ${JOB_TABLE_HEAD}
                <tbody>
                    ${jobRows(
                      list,
                      (job) => `<a href="/view_job/${job.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>
                            <a href="/bill/${job.id}" class="btn btn-sm btn-warning"><i class="bi bi-receipt"></i></a>
                            <form method="POST" action="/delete_job/${job.id}" class="d-inline" onsubmit="return confirm('Delete this job?')">
                                <button type="submit" class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></button>
                            </form>`
                    )}
                </tbody>
            </table>
        </div>
    </div>
</div>`;
}

function viewJobPage(job: Job): string {
  return `<div class="card">
    <div class="card-header d-flex justify-content-between">
        <span><i class="bi bi-file-earmark-text"></i> JOB DETAILS - ${esc(job.jobNo)}</span>
        <div>
            <a href="/bill/${job.id}" class="btn btn-warning btn-sm"><i class="bi bi-receipt"></i> Generate Bill</a>
            <a href="/jobs" class="btn btn-secondary btn-sm"><i class="bi bi-arrow-left"></i> Back</a>
        </div>
    </div>
    <div class="card-body">
        <div class="row mb-3">
            <div class="col-md-6">
                <p><strong>Customer Name:</strong> ${esc(job.customerName)}</p>
                <p><strong>Customer Phone Number:</strong> ${esc(job.customerPhone)}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Bike Name:</strong> ${esc(job.bikeName)}</p>
                <p><strong>Bike Number:</strong> ${esc(job.bikeNumber)}</p>
            </div>
        </div>
        <hr style="border-color: #dc143c;">
        <p><strong>Bike Problem:</strong><br>${esc(job.bikeProblem)}</p>
        <hr style="border-color: #dc143c;">
        <p><strong>Spare Price:</strong> ₹${money(job.sparePrice)}</p>
        <p><strong>Labor Price:</strong> ₹${money(job.laborPrice)}</p>
        <p><strong>Date:</strong> ${esc(job.date)}</p>
        <p><strong>Notes:</strong> ${esc(job.notes || "-")}</p>
    </div>
</div>`;
}

function billingPage(list: Job[], search: string, totalBilled: number): string {
  const rows =
    list.length === 0
      ? `<tr><td colspan="10" class="text-center">No bills found</td></tr>`
      : list
          .map(
            (job) => `<tr>
                        <td><strong style="color: #ffd700;">${esc(job.jobNo)}</strong></td>
                        <td>${esc(job.date)}</td>
                        <td>${esc(job.customerName)}</td>
                        <td>${esc(job.customerPhone)}</td>
                        <td>${esc(job.bikeName)}</td>
                        <td>${esc(job.bikeNumber)}</td>
                        <td>₹${money(job.sparePrice)}</td>
                        <td>₹${money(job.laborPrice)}</td>
                        <td><strong style="color: #32cd32;">₹${money(job.total)}</strong></td>
                        <td><a href="/bill/${job.id}" class="btn btn-sm btn-primary"><i class="bi bi-printer"></i> Bill</a></td>
                    </tr>`
          )
          .join("");
  return `<div class="card mb-4">
    <div class="card-header d-flex justify-content-between align-items-center">
        <span><i class="bi bi-receipt"></i> BILLING</span>
        <span class="badge" style="background: #ffd700; color: #000; font-size: 1rem;">Total Billed: ₹${money(totalBilled)}</span>
    </div>
    <div class="card-body">
        ${searchForm("/billing", search, "Search by job no, customer name, phone, or bike number")}
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr style="background: #000;">
                        <th>Bill No</th><th>Date</th><th>Customer Name</th><th>Phone No</th><th>Bike Name</th>
                        <th>Bike Number</th><th>Spare Price</th><th>Labor Price</th><th>Total</th><th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>
</div>`;
}

function invoicePage(job: Job): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${HEAD}
    <title>Bill ${esc(job.jobNo)} - SHIVAJI BIKERS</title>
    <style>
        * { font-family: 'Rajdhani', sans-serif; }
        body { background: #e9ecef; padding: 20px; }
        .invoice-box { max-width: 800px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
        .invoice-header { background: linear-gradient(90deg, #000000 0%, #dc143c 100%); color: #fff; padding: 25px; display: flex; align-items: center; gap: 20px; }
        .invoice-header img { height: 80px; border-radius: 50%; border: 3px solid #ffd700; }
        .shop-name { font-size: 2rem; font-weight: 700; margin: 0; letter-spacing: 1px; }
        .invoice-title { text-align: center; background: #0a0a0a; color: #ffd700; padding: 10px; font-weight: 700; letter-spacing: 3px; }
        .invoice-body { padding: 25px; color: #111; }
        .info-label { font-weight: 700; color: #dc143c; }
        .table thead th { background: #0a0a0a; color: #fff; }
        .table td { color: #111; font-size: 1.05rem; }
        .total-row { background: #f8d7da; font-weight: 700; font-size: 1.2rem; }
        .invoice-footer { background: #0a0a0a; color: #adb5bd; text-align: center; padding: 15px; font-size: 0.9rem; }
        .actions { max-width: 800px; margin: 0 auto 15px; display: flex; gap: 10px; justify-content: flex-end; }
        .btn-brand { background: linear-gradient(90deg, #dc143c, #ff0000); border: none; color: #fff; font-weight: 600; }
        .btn-brand:hover { color: #fff; opacity: 0.9; }
        @media print {
            body { background: #fff; padding: 0; }
            .actions { display: none; }
            .invoice-box { box-shadow: none; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="actions">
        <a href="/billing" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Back</a>
        <button onclick="window.print()" class="btn btn-brand"><i class="bi bi-printer"></i> Print Bill</button>
    </div>
    <div class="invoice-box">
        <div class="invoice-header">
            ${LOGO}
            <div>
                <h1 class="shop-name">SHIVAJI BIKERS</h1>
                <div>Bike Service &amp; Repair</div>
            </div>
        </div>
        <div class="invoice-title">SERVICE BILL</div>
        <div class="invoice-body">
            <div class="row mb-3">
                <div class="col-6"><div class="info-label">Bill No</div><div>${esc(job.jobNo)}</div></div>
                <div class="col-6 text-end"><div class="info-label">Bill Date</div><div>${esc(job.date)}</div></div>
            </div>
            <hr>
            <div class="row mb-3">
                <div class="col-md-6 mb-2">
                    <div class="info-label">Customer Details</div>
                    <div><strong>Name:</strong> ${esc(job.customerName)}</div>
                    <div><strong>Phone:</strong> ${esc(job.customerPhone)}</div>
                </div>
                <div class="col-md-6 mb-2">
                    <div class="info-label">Bike Details</div>
                    <div><strong>Bike:</strong> ${esc(job.bikeName)}</div>
                    <div><strong>Number:</strong> ${esc(job.bikeNumber)}</div>
                </div>
            </div>
            <div class="mb-3">
                <div class="info-label">Bike Problem</div>
                <div>${esc(job.bikeProblem)}</div>
            </div>
            <table class="table table-bordered mb-3">
                <thead><tr><th>#</th><th>Description</th><th class="text-end">Amount (₹)</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>Spare Parts</td><td class="text-end">${money(job.sparePrice)}</td></tr>
                    <tr><td>2</td><td>Labor Charges</td><td class="text-end">${money(job.laborPrice)}</td></tr>
                    <tr class="total-row"><td colspan="2" class="text-end">TOTAL</td><td class="text-end">₹${money(job.total)}</td></tr>
                </tbody>
            </table>
            ${job.notes ? `<div class="mb-3"><div class="info-label">Notes</div><div>${esc(job.notes)}</div></div>` : ""}
            <div class="text-end mt-4">
                <div>For <strong>SHIVAJI BIKERS</strong></div>
                <div style="margin-top: 40px;">Authorized Signature</div>
            </div>
        </div>
        <div class="invoice-footer">Thank you for choosing SHIVAJI BIKERS &mdash; Ride Safe!</div>
    </div>
</body>
</html>`;
}

// ---------- data ----------

function searchJobs(search: string, includeJobNo: boolean) {
  const q = `%${search}%`;
  const conditions = [ilike(jobs.customerName, q), ilike(jobs.bikeNumber, q), ilike(jobs.customerPhone, q)];
  if (includeJobNo) conditions.push(ilike(jobs.jobNo, q));
  const query = db.select().from(jobs);
  return (search ? query.where(or(...conditions)) : query).orderBy(desc(jobs.id));
}

async function nextJobNo(): Promise<string> {
  const [last] = await db.select({ jobNo: jobs.jobNo }).from(jobs).orderBy(desc(jobs.id)).limit(1);
  let num = 1;
  if (last?.jobNo) {
    const parsed = parseInt(last.jobNo.replace("SBJ", ""), 10);
    if (Number.isNaN(parsed)) {
      const [{ c }] = await db.select({ c: count() }).from(jobs);
      num = c + 1;
    } else {
      num = parsed + 1;
    }
  }
  return `SBJ${String(num).padStart(5, "0")}`;
}

async function findJob(id: string | undefined): Promise<Job | null> {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, n));
  return job ?? null;
}

// ---------- handler ----------

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const route = path.split("/")[1] ?? "";
  const id = context.params.id;
  const flash = readFlash(req);

  if (route === "login") {
    if (req.method === "POST") {
      const form = await req.formData();
      const username = String(form.get("username") ?? "");
      const password = String(form.get("password") ?? "");
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (user && verifyPassword(password, user.passwordHash)) {
        const token = randomBytes(32).toString("hex");
        await db.insert(sessions).values({
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000),
        });
        return redirect("/dashboard", { cookies: [cookie(SESSION_COOKIE, token, SESSION_HOURS * 3600)] });
      }
      return redirect("/login", { flash: { category: "danger", message: "Invalid credentials" } });
    }
    return html(req, layout(loginPage(), { user: null, flash }));
  }

  if (route === "logout") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) await db.delete(sessions).where(eq(sessions.token, token));
    return redirect("/login", { cookies: [cookie(SESSION_COOKIE, "", 0)] });
  }

  const user = await currentUser(req);
  if (!user) return redirect("/login");
  const page = (content: string) => html(req, layout(content, { user, flash }));

  switch (route) {
    case "":
      return redirect("/dashboard");

    case "dashboard": {
      const [stats] = await db
        .select({
          totalJobs: count(),
          totalBilled: sql<number>`coalesce(${sum(jobs.total)}, 0)`.mapWith(Number),
          spareTotal: sql<number>`coalesce(${sum(jobs.sparePrice)}, 0)`.mapWith(Number),
          laborTotal: sql<number>`coalesce(${sum(jobs.laborPrice)}, 0)`.mapWith(Number),
        })
        .from(jobs);
      const recent = await db.select().from(jobs).orderBy(desc(jobs.id)).limit(10);
      return page(dashboardPage(stats, recent));
    }

    case "add_job": {
      if (req.method !== "POST") return page(addJobPage());
      const form = await req.formData();
      const field = (name: string) => String(form.get(name) ?? "").trim();
      const sparePrice = parseFloat(field("spare_price")) || 0;
      const laborPrice = parseFloat(field("labor_price")) || 0;
      try {
        await db.insert(jobs).values({
          jobNo: await nextJobNo(),
          customerName: field("customer_name"),
          customerPhone: field("customer_phone"),
          bikeName: field("bike_name"),
          bikeNumber: field("bike_number").toUpperCase(),
          bikeProblem: field("bike_problem"),
          sparePrice,
          laborPrice,
          profit: parseFloat(field("profit")) || 0,
          total: sparePrice + laborPrice,
          notes: field("notes"),
        });
        return redirect("/jobs", { flash: { category: "success", message: "Job added successfully" } });
      } catch (e) {
        console.error(e);
        return redirect("/add_job", { flash: { category: "danger", message: "Error: could not save the job. Please try again." } });
      }
    }

    case "jobs": {
      const search = url.searchParams.get("search") ?? "";
      return page(jobsPage(await searchJobs(search, false), search));
    }

    case "view_job": {
      const job = await findJob(id);
      if (!job) return redirect("/jobs", { flash: { category: "danger", message: "Job not found" } });
      return page(viewJobPage(job));
    }

    case "delete_job": {
      if (req.method !== "POST") return redirect("/jobs");
      const n = Number(id);
      if (Number.isInteger(n)) await db.delete(jobs).where(eq(jobs.id, n));
      return redirect("/jobs", { flash: { category: "success", message: "Job deleted" } });
    }

    case "billing": {
      const search = url.searchParams.get("search") ?? "";
      const [{ t }] = await db
        .select({ t: sql<number>`coalesce(${sum(jobs.total)}, 0)`.mapWith(Number) })
        .from(jobs);
      return page(billingPage(await searchJobs(search, true), search, t));
    }

    case "bill": {
      const job = await findJob(id);
      if (!job) return redirect("/billing", { flash: { category: "danger", message: "Job not found" } });
      return html(req, invoicePage(job));
    }
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: ["/", "/login", "/logout", "/dashboard", "/add_job", "/jobs", "/view_job/:id", "/delete_job/:id", "/billing", "/bill/:id"],
};
