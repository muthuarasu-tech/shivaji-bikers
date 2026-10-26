import { login, logout, getUser, handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery, AuthError } from '@netlify/identity'

const app = document.getElementById('app')
const nav = document.getElementById('nav')
const flashEl = document.getElementById('flash')

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const money = (n) => Number(n || 0).toFixed(2)

function flash(message, type = 'success') {
  flashEl.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${esc(message)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`
}

async function api(path, options = {}) {
  const res = await fetch(`/api/jobs${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 401) { showLogin(); throw new Error('Please log in') }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const logoBig = `<div class="logo-big"><img src="/logo.png" onerror="this.src='/logo.jpg'"></div>`

function showLogin(message) {
  nav.hidden = true
  app.innerHTML = `
  <div class="row justify-content-center align-items-center" style="min-height: 80vh;">
    <div class="col-md-5 col-lg-4">
      <div class="card">
        <div class="card-header text-center">${logoBig}<div class="brand-text">SHIVAJI BIKERS</div><small>Bike Service &amp; Repair</small></div>
        <div class="card-body">
          <form id="login-form">
            <div class="mb-3"><label class="form-label"><i class="bi bi-envelope"></i> Email</label><input type="email" class="form-control" name="email" required></div>
            <div class="mb-3"><label class="form-label"><i class="bi bi-lock"></i> Password</label><input type="password" class="form-control" name="password" required></div>
            <button type="submit" class="btn btn-primary w-100"><i class="bi bi-box-arrow-in-right"></i> LOGIN</button>
          </form>
          <div class="text-center mt-3"><a href="#" id="forgot" class="gold">Forgot password?</a></div>
        </div>
      </div>
    </div>
  </div>`
  if (message) flash(message, 'info')
  const form = document.getElementById('login-form')
  form.onsubmit = async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    try {
      await login(fd.get('email'), fd.get('password'))
      flashEl.innerHTML = ''
      location.hash = '#/'
      route()
    } catch (err) {
      flash(err instanceof AuthError && err.status === 401 ? 'Invalid email or password' : err.message, 'danger')
    }
  }
  document.getElementById('forgot').onclick = async (e) => {
    e.preventDefault()
    const email = new FormData(form).get('email')
    if (!email) return flash('Enter your email above first', 'warning')
    try { await requestPasswordRecovery(email); flash('Check your email for a reset link') } catch (err) { flash(err.message, 'danger') }
  }
}

function showSetPassword(onSubmit, title) {
  nav.hidden = true
  app.innerHTML = `
  <div class="row justify-content-center"><div class="col-md-5"><div class="card">
    <div class="card-header">${title}</div>
    <div class="card-body"><form id="pw-form">
      <div class="mb-3"><label class="form-label">New password</label><input type="password" minlength="6" class="form-control" name="password" required></div>
      <button class="btn btn-primary w-100">SAVE PASSWORD</button>
    </form></div></div></div></div>`
  const form = document.getElementById('pw-form')
  form.onsubmit = async (e) => {
    e.preventDefault()
    try { await onSubmit(new FormData(form).get('password')); flash('Password saved'); location.hash = '#/'; route() }
    catch (err) { flash(err.message, 'danger') }
  }
}

function jobRows(jobs, actions) {
  if (!jobs.length) return `<tr><td colspan="9" class="text-center">No jobs found</td></tr>`
  return jobs.map((j) => `
    <tr>
      <td><strong class="gold">${esc(j.job_no)}</strong></td>
      <td>${esc(j.date)}</td><td>${esc(j.customer_name)}</td><td>${esc(j.customer_phone)}</td>
      <td>${esc(j.bike_name)}</td><td>${esc(j.bike_number)}</td><td>${esc(j.bike_problem)}</td>
      <td>₹${money(j.spare_price)}</td><td class="text-nowrap">${actions(j)}</td>
    </tr>`).join('')
}

const tableHead = `<thead><tr><th>Job No</th><th>Date</th><th>Customer Name</th><th>Phone No</th><th>Bike Name</th><th>Bike Number</th><th>Bike Problem</th><th>Spare Price</th><th>Action</th></tr></thead>`

async function dashboard() {
  const jobs = await api('')
  const sum = (k) => jobs.reduce((s, j) => s + j[k], 0)
  const stat = (icon, color, value, label) => `
    <div class="col-md-3 mb-3"><div class="card text-center"><div class="card-body">
      <i class="bi ${icon}" style="font-size: 2rem; color: ${color};"></i><h3>${value}</h3><p>${label}</p>
    </div></div></div>`
  app.innerHTML = `
    <div class="text-center mb-4"><div class="logo-big"><img src="/logo.png" onerror="this.src='/logo.jpg'"><div class="brand-text">SHIVAJI BIKERS</div></div>
      <p>Bike Service &amp; Repair Management</p></div>
    <div class="row mb-2">
      ${stat('bi-file-earmark-text', '#dc143c', jobs.length, 'Total Jobs')}
      ${stat('bi-receipt', '#ffd700', '₹' + money(sum('total')), 'Total Billed')}
      ${stat('bi-gear', '#ffa500', '₹' + money(sum('spare_price')), 'Spare Total')}
      ${stat('bi-wrench', '#32cd32', '₹' + money(sum('labor_price')), 'Labor Total')}
    </div>
    <div class="card"><div class="card-header d-flex justify-content-between">
      <span><i class="bi bi-clock"></i> Recent Jobs</span><a href="#/add" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add New Job</a></div>
      <div class="card-body"><div class="table-responsive"><table class="table table-hover">${tableHead}<tbody>
        ${jobRows(jobs.slice(0, 10), (j) => `<a href="#/job/${j.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>`)}
      </tbody></table></div></div></div>`
}

function addJob() {
  const field = (name, label, type = 'text', extra = 'required') =>
    `<div class="col-md-6 mb-3"><label class="form-label">${label}</label><input type="${type}" class="form-control" name="${name}" ${extra}></div>`
  app.innerHTML = `
    <div class="card mb-4"><div class="card-header"><i class="bi bi-plus-circle"></i> ADD NEW JOB</div><div class="card-body">
      <form id="job-form">
        <div class="row">${field('customer_name', 'Customer Name *')}${field('customer_phone', 'Customer Phone Number *', 'tel')}</div>
        <div class="row">${field('bike_name', 'Bike Name *')}${field('bike_number', 'Bike Number *')}</div>
        <div class="mb-3"><label class="form-label">Bike Problem *</label><textarea class="form-control" name="bike_problem" rows="3" required></textarea></div>
        <div class="row">${field('spare_price', 'Spare Price (₹)', 'number', 'step="0.01" min="0" value="0"')}${field('labor_price', 'Labor Price (₹)', 'number', 'step="0.01" min="0" value="0"')}</div>
        <div class="mb-3"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="2"></textarea></div>
        <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> SAVE JOB</button>
        <a href="#/jobs" class="btn btn-secondary">CANCEL</a>
      </form></div></div>`
  const form = document.getElementById('job-form')
  form.onsubmit = async (e) => {
    e.preventDefault()
    try {
      await api('', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      flash('Job added successfully')
      location.hash = '#/jobs'
    } catch (err) { flash('Error: ' + err.message, 'danger') }
  }
}

function searchForm(value, placeholder) {
  return `<form id="search-form" class="mb-3"><div class="input-group">
    <input type="text" class="form-control" name="search" placeholder="${placeholder}" value="${esc(value)}">
    <button class="btn btn-primary" type="submit"><i class="bi bi-search"></i> Search</button></div></form>`
}

function bindSearch(base) {
  document.getElementById('search-form').onsubmit = (e) => {
    e.preventDefault()
    const s = new FormData(e.target).get('search').trim()
    location.hash = s ? `${base}?search=${encodeURIComponent(s)}` : base
  }
}

async function jobsList(search) {
  const jobs = await api(search ? `?search=${encodeURIComponent(search)}` : '')
  app.innerHTML = `
    <div class="card"><div class="card-header d-flex justify-content-between">
      <span><i class="bi bi-list-check"></i> ALL JOBS</span><a href="#/add" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add Job</a></div>
      <div class="card-body">${searchForm(search, 'Search by job no, customer name, phone, or bike number')}
        <div class="table-responsive"><table class="table table-hover">${tableHead}<tbody>
        ${jobRows(jobs, (j) => `
          <a href="#/job/${j.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>
          <a href="#/bill/${j.id}" class="btn btn-sm btn-warning"><i class="bi bi-receipt"></i></a>
          <button data-del="${j.id}" class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></button>`)}
        </tbody></table></div></div></div>`
  bindSearch('#/jobs')
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this job?')) return
    await api(`/${b.dataset.del}`, { method: 'DELETE' })
    flash('Job deleted')
    route()
  })
}

async function viewJob(id) {
  const j = await api(`/${id}`)
  const statuses = ['Pending', 'In Progress', 'Completed', 'Delivered']
  app.innerHTML = `
    <div class="card"><div class="card-header d-flex justify-content-between">
      <span><i class="bi bi-file-earmark-text"></i> JOB DETAILS - ${esc(j.job_no)}</span>
      <div><a href="#/bill/${j.id}" class="btn btn-warning btn-sm"><i class="bi bi-receipt"></i> Generate Bill</a>
      <a href="#/jobs" class="btn btn-secondary btn-sm"><i class="bi bi-arrow-left"></i> Back</a></div></div>
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-6"><p><strong>Customer Name:</strong> ${esc(j.customer_name)}</p><p><strong>Customer Phone Number:</strong> ${esc(j.customer_phone)}</p></div>
          <div class="col-md-6"><p><strong>Bike Name:</strong> ${esc(j.bike_name)}</p><p><strong>Bike Number:</strong> ${esc(j.bike_number)}</p></div>
        </div>
        <hr style="border-color: #dc143c;"><p><strong>Bike Problem:</strong><br>${esc(j.bike_problem)}</p><hr style="border-color: #dc143c;">
        <p><strong>Spare Price:</strong> ₹${money(j.spare_price)}</p><p><strong>Labor Price:</strong> ₹${money(j.labor_price)}</p>
        <p><strong>Total:</strong> ₹${money(j.total)}</p><p><strong>Date:</strong> ${esc(j.date)}</p>
        <p><strong>Notes:</strong> ${esc(j.notes || '-')}</p>
        <div class="d-flex align-items-center gap-2" style="max-width: 360px;"><strong>Status:</strong>
          <select id="status" class="form-select">${statuses.map((s) => `<option ${s === j.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div></div>`
  document.getElementById('status').onchange = async (e) => {
    await api(`/${id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) })
    flash('Status updated')
  }
}

async function billing(search) {
  const jobs = await api(search ? `?search=${encodeURIComponent(search)}` : '')
  const total = jobs.reduce((s, j) => s + j.total, 0)
  const rows = jobs.length ? jobs.map((j) => `
    <tr><td><strong class="gold">${esc(j.job_no)}</strong></td><td>${esc(j.date)}</td><td>${esc(j.customer_name)}</td>
      <td>${esc(j.customer_phone)}</td><td>${esc(j.bike_name)}</td><td>${esc(j.bike_number)}</td>
      <td>₹${money(j.spare_price)}</td><td>₹${money(j.labor_price)}</td><td><strong style="color: #32cd32;">₹${money(j.total)}</strong></td>
      <td><a href="#/bill/${j.id}" class="btn btn-sm btn-primary"><i class="bi bi-printer"></i> Bill</a></td></tr>`).join('')
    : `<tr><td colspan="10" class="text-center">No bills found</td></tr>`
  app.innerHTML = `
    <div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center">
      <span><i class="bi bi-receipt"></i> BILLING</span>
      <span class="badge" style="background: #ffd700; color: #000; font-size: 1rem;">Total Billed: ₹${money(total)}</span></div>
      <div class="card-body">${searchForm(search, 'Search by job no, customer name, phone, or bike number')}
        <div class="table-responsive"><table class="table table-hover"><thead><tr><th>Bill No</th><th>Date</th><th>Customer Name</th><th>Phone No</th>
          <th>Bike Name</th><th>Bike Number</th><th>Spare Price</th><th>Labor Price</th><th>Total</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div></div>`
  bindSearch('#/billing')
}

async function bill(id) {
  const j = await api(`/${id}`)
  app.innerHTML = `
    <div class="actions"><a href="#/billing" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Back</a>
      <button onclick="window.print()" class="btn btn-primary"><i class="bi bi-printer"></i> Print Bill</button></div>
    <div class="invoice-box">
      <div class="invoice-header"><img src="/logo.png" onerror="this.src='/logo.jpg'"><div><h1 class="shop-name">SHIVAJI BIKERS</h1><div>Bike Service &amp; Repair</div></div></div>
      <div class="invoice-title">SERVICE BILL</div>
      <div class="invoice-body">
        <div class="row mb-3"><div class="col-6"><div class="info-label">Bill No</div><div>${esc(j.job_no)}</div></div>
          <div class="col-6 text-end"><div class="info-label">Bill Date</div><div>${esc(j.date)}</div></div></div><hr>
        <div class="row mb-3">
          <div class="col-md-6 mb-2"><div class="info-label">Customer Details</div><div><strong>Name:</strong> ${esc(j.customer_name)}</div><div><strong>Phone:</strong> ${esc(j.customer_phone)}</div></div>
          <div class="col-md-6 mb-2"><div class="info-label">Bike Details</div><div><strong>Bike:</strong> ${esc(j.bike_name)}</div><div><strong>Number:</strong> ${esc(j.bike_number)}</div></div>
        </div>
        <div class="mb-3"><div class="info-label">Bike Problem</div><div>${esc(j.bike_problem)}</div></div>
        <table class="table table-bordered mb-3"><thead><tr><th>#</th><th>Description</th><th class="text-end">Amount (₹)</th></tr></thead><tbody>
          <tr><td>1</td><td>Spare Parts</td><td class="text-end">${money(j.spare_price)}</td></tr>
          <tr><td>2</td><td>Labor Charges</td><td class="text-end">${money(j.labor_price)}</td></tr>
          <tr class="total-row"><td colspan="2" class="text-end">TOTAL</td><td class="text-end">₹${money(j.total)}</td></tr>
        </tbody></table>
        ${j.notes ? `<div class="mb-3"><div class="info-label">Notes</div><div>${esc(j.notes)}</div></div>` : ''}
        <div class="text-end mt-4"><div>For <strong>SHIVAJI BIKERS</strong></div><div style="margin-top: 40px;">Authorized Signature</div></div>
      </div>
      <div class="invoice-footer">Thank you for choosing SHIVAJI BIKERS &mdash; Ride Safe!</div>
    </div>`
}

async function route() {
  const user = await getUser()
  if (!user) return showLogin()
  nav.hidden = false
  const [path, query] = (location.hash.slice(1) || '/').split('?')
  const search = new URLSearchParams(query).get('search') || ''
  const [, page, id] = path.split('/')
  try {
    if (!page) await dashboard()
    else if (page === 'add') addJob()
    else if (page === 'jobs') await jobsList(search)
    else if (page === 'billing') await billing(search)
    else if (page === 'job' && id) await viewJob(id)
    else if (page === 'bill' && id) await bill(id)
    else location.hash = '#/'
  } catch (err) {
    flash(err.message, 'danger')
  }
}

document.getElementById('logout').onclick = async (e) => {
  e.preventDefault()
  await logout()
  location.hash = ''
  showLogin('You have been logged out')
}

window.addEventListener('hashchange', route)

;(async () => {
  try {
    const result = await handleAuthCallback()
    if (result?.type === 'invite') return showSetPassword((pw) => acceptInvite(result.token, pw), 'ACCEPT INVITE - SET PASSWORD')
    if (result?.type === 'recovery') return showSetPassword((pw) => updateUser({ password: pw }), 'RESET PASSWORD')
  } catch (err) {
    flash(err.message, 'danger')
  }
  route()
})()
