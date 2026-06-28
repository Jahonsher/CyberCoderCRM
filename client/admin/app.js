/**
 * CyberCoderCRM — Admin App (v2)
 * 6 modul: employees, directions, dailyReport, monthlyReport, salary, archive
 */

// ============================================
// CONFIG & STATE
// ============================================
const API_BASE = window.API_BASE || '';
const STORAGE = { token: 'cc_admin_token', user: 'cc_admin_user' };
const THEME_KEY = 'cc_theme';

const MODULE_ICONS = {
  employees: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  directions: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  dailyReport: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  monthlyReport: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><polyline points="7 14 11 10 15 14 21 8"/></svg>',
  salary: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  archive: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
};

const state = {
  token: localStorage.getItem(STORAGE.token) || null,
  user: null,
  business: null,
  currentPage: null,
  confirmCallback: null,

  departments: [],
  directions: [],
  employees: [],

  selectedDeptId: null,           // Directions sahifasi uchun
  dailySelectedDeptId: null,      // Daily Report uchun
  dailySelectedDirId: null,       // Daily Report — direction filter
  dailyDate: null,
  dailyData: null,

  monthlyData: null,
  salaryData: null,
  salaryDetail: null,
  salarySelectedDates: new Set(),
  salaryFilter: 'all',
  archiveData: null,
  archiveTab: 'history',
  archiveCategory: '',
  archiveFiles: null,
};

// ============================================
// UTILS
// ============================================
function apiUrl(p) { return (API_BASE || '').replace(/\/$/, '') + p; }
function t(key) { return (window._t ? window._t(key) : key); }
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function formatMoney(n) {
  if (typeof n !== 'number' || isNaN(n)) n = 0;
  return Math.round(n).toLocaleString('uz-UZ');
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function toast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}
async function api(endpoint, opts = {}) {
  const url = apiUrl(endpoint);
  const headers = { Authorization: `Bearer ${state.token}`, ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Unauthorized'); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function downloadExcel(endpoint, suggestedName) {
  const token = localStorage.getItem(STORAGE.token);
  const res = await fetch(apiUrl(endpoint), { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    let msg = t('msg.error') || 'Xato';
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  let name = suggestedName || 'export.xlsx';
  if (m && m[1]) {
    try { name = decodeURIComponent(m[1]); } catch (_) { name = m[1]; }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ============================================
// THEME
// ============================================
function getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  const el = document.getElementById('themeText');
  if (el) el.textContent = theme === 'dark' ? t('theme.light') : t('theme.dark');
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

// ============================================
// VIEWS
// ============================================
function showLogin() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}
function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
}

// ============================================
// LOGIN
// ============================================
function setupLogin() {
  const form = document.getElementById('loginForm');
  const err = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const password = document.getElementById('loginPassword').value.trim();
    if (!password) return;

    btn.disabled = true;
    btnText.textContent = t('login.signingIn');
    spinner.classList.remove('hidden');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('login.wrong'));
      if (data.user.role !== 'admin') throw new Error('SuperAdmin → /superadmin/');

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE.token, data.token);
      localStorage.setItem(STORAGE.user, JSON.stringify(data.user));

      if (data.user.defaultLanguage && !localStorage.getItem('cc_lang')) {
        window.setLang(data.user.defaultLanguage);
      }

      btnText.textContent = t('login.welcome');
      setTimeout(() => initApp(), 300);
    } catch (e2) {
      err.textContent = e2.message;
      err.classList.remove('hidden');
      btn.disabled = false;
      btnText.textContent = t('login.signIn');
      spinner.classList.add('hidden');
    }
  });
}

function logout() {
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.user);
  state.token = null;
  state.user = null;
  state.business = null;
  showLogin();
}

// ============================================
// BRANDING & SIDEBAR
// ============================================
function applyBranding(b) {
  document.title = `${b.name} · CRM`;
  document.getElementById('businessName').textContent = b.name || 'Business';
  const logoEl = document.getElementById('businessLogo');
  const firstLetter = (b.name || '?').charAt(0).toUpperCase();
  if (b.logo) {
    logoEl.innerHTML = `<img src="${apiUrl('/uploads/' + b.logo)}" alt="logo" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-white font-bold\\'>${firstLetter}</div>'" />`;
  } else {
    logoEl.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white font-bold">${firstLetter}</div>`;
  }
}

function buildSidebar(enabledModules) {
  const order = ['employees', 'directions', 'dailyReport', 'monthlyReport', 'salary', 'archive'];
  const effective = order.filter(k => enabledModules.includes(k));
  state.business.effectiveModules = effective;

  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  effective.forEach(key => {
    const a = document.createElement('a');
    a.className = 'nav-item';
    a.dataset.page = key;
    a.innerHTML = `${MODULE_ICONS[key] || ''}<span>${t('nav.' + key)}</span>`;
    a.addEventListener('click', (e) => { e.preventDefault(); navigateTo(key); });
    nav.appendChild(a);
  });
}

function navigateTo(pageKey) {
  state.currentPage = pageKey;
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageKey);
  });
  document.getElementById('pageTitle').textContent = t('nav.' + pageKey);
  document.getElementById('pageSubtitle').textContent = '';
  document.getElementById('headerActions').innerHTML = '';

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.add('hidden');

  if (pageKey === 'employees') loadEmployeesPage();
  else if (pageKey === 'directions') loadDirectionsPage();
  else if (pageKey === 'dailyReport') loadDailyReportPage();
  else if (pageKey === 'monthlyReport') loadMonthlyReportPage();
  else if (pageKey === 'salary') loadSalaryPage();
  else if (pageKey === 'archive') loadArchivePage();
}

// ============================================
// EMPLOYEES
// ============================================
async function loadEmployeesPage() {
  await loadDepartmentsIntoState();

  // Filterdropdown
  const filter = document.getElementById('empDeptFilter');
  filter.innerHTML = `<option value="">${t('emp.department')} — ${t('common.total')}</option>` +
    state.departments.map(d => `<option value="${d._id}">${escapeHtml(d.name)}</option>`).join('');

  await fetchAndRenderEmployees();
}

async function loadDepartmentsIntoState() {
  try {
    state.departments = await api('/api/departments');
  } catch (e) { state.departments = []; }
}

async function fetchAndRenderEmployees() {
  const search = document.getElementById('empSearch').value.trim();
  const deptId = document.getElementById('empDeptFilter').value;
  const params = [];
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  if (deptId) params.push(`departmentId=${deptId}`);
  const url = '/api/employees' + (params.length ? '?' + params.join('&') : '');

  const container = document.getElementById('empTableContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-24"></div></div>';
  try {
    state.employees = await api(url);
    renderEmployees(state.employees);
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
}

function renderEmployees(employees) {
  const container = document.getElementById('empTableContainer');
  if (employees.length === 0) {
    container.innerHTML = `<div class="p-10 text-center"><p class="font-bold mb-1">${t('emp.empty')}</p><p class="text-sm text-zinc-500">${t('emp.emptyHint')}</p></div>`;
    return;
  }
  container.innerHTML = `<div class="overflow-x-auto"><table class="data-table"><thead><tr>
      <th>${t('emp.fullName')}</th>
      <th>${t('emp.code')}</th>
      <th>${t('emp.department')}</th>
      <th>${t('emp.phone')}</th>
      <th class="text-right">${t('common.actions')}</th>
    </tr></thead><tbody>
    ${employees.map(e => `
      <tr>
        <td class="font-medium">${escapeHtml(e.fullName)}</td>
        <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
        <td class="text-sm">${escapeHtml(e.departmentId?.name || '—')} ${e.departmentId?.allowDirections ? '<span class="badge badge-on ml-1">ON</span>' : '<span class="badge badge-off ml-1">OFF</span>'}</td>
        <td class="mono text-xs text-zinc-400">${escapeHtml(e.phone || '—')}</td>
        <td class="text-right whitespace-nowrap">
          <button class="btn-icon" data-act="emp-edit" data-id="${e._id}" title="${t('common.edit')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger ml-1" data-act="emp-delete" data-id="${e._id}" data-name="${escapeHtml(e.fullName)}" title="${t('common.delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'emp-edit') openEmpEdit(id);
      else if (btn.dataset.act === 'emp-delete') {
        openConfirm(t('emp.deleteConfirm'), `"${btn.dataset.name}" — ${t('emp.deleteWarn')}`, async () => {
          try { await api(`/api/employees/${id}`, { method: 'DELETE' }); toast(t('msg.deleted')); fetchAndRenderEmployees(); }
          catch (e) { toast(e.message, 'error'); }
        });
      }
    });
  });
}

function fillEmpDeptSelect(selectedId) {
  const select = document.getElementById('empDepartmentId');
  select.innerHTML = `<option value="">${t('emp.selectDept')}</option>` +
    state.departments.map(d => `<option value="${d._id}" ${selectedId === d._id ? 'selected' : ''}>${escapeHtml(d.name)} ${d.allowDirections ? '(ON)' : '(OFF)'}</option>`).join('');
}

async function fillEmpDirectionSelect(deptId, selectedDirId) {
  const wrap = document.getElementById('empDirectionWrap');
  const select = document.getElementById('empDirectionId');
  const dept = state.departments.find(d => d._id === deptId);
  if (!deptId || !dept || !dept.allowDirections) {
    wrap.classList.add('hidden');
    select.innerHTML = '';
    select.required = false;
    return;
  }
  wrap.classList.remove('hidden');
  select.required = true;
  select.innerHTML = `<option value="">—</option>`;
  try {
    const dirs = await api(`/api/directions?departmentId=${deptId}`);
    select.innerHTML = `<option value="">—</option>` +
      dirs.map(d => `<option value="${d._id}" ${String(selectedDirId) === String(d._id) ? 'selected' : ''}>${escapeHtml(d.name)} — ${formatMoney(d.price)} ${t('common.sum')}</option>`).join('');
  } catch (e) {
    select.innerHTML = `<option value="">—</option>`;
  }
}

function openEmpAdd() {
  document.getElementById('empEditingId').value = '';
  document.getElementById('empForm').reset();
  document.getElementById('empModalTitle').textContent = t('emp.add');
  fillEmpDeptSelect(null);
  fillEmpDirectionSelect(null, null);
  openModal('empModal');
}

function openEmpEdit(id) {
  const emp = state.employees.find(e => e._id === id);
  if (!emp) return;
  document.getElementById('empEditingId').value = id;
  document.getElementById('empModalTitle').textContent = t('emp.edit');
  document.getElementById('empFullName').value = emp.fullName || '';
  document.getElementById('empCode').value = emp.code || '';
  document.getElementById('empPhone').value = emp.phone || '';
  const deptId = emp.departmentId?._id || emp.departmentId;
  fillEmpDeptSelect(deptId);
  fillEmpDirectionSelect(deptId, emp.directionId?._id || emp.directionId);
  openModal('empModal');
}

function setupEmployeesPage() {
  let timer;
  document.getElementById('empSearch').addEventListener('input', () => {
    clearTimeout(timer); timer = setTimeout(fetchAndRenderEmployees, 300);
  });
  document.getElementById('empDeptFilter').addEventListener('change', fetchAndRenderEmployees);
  document.getElementById('empAddBtn').addEventListener('click', openEmpAdd);

  document.getElementById('empDepartmentId').addEventListener('change', (e) => {
    fillEmpDirectionSelect(e.target.value, null);
  });

  document.getElementById('empForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('empEditingId').value;
    const deptId = document.getElementById('empDepartmentId').value;
    const dept = state.departments.find(d => d._id === deptId);
    const dirId = document.getElementById('empDirectionId').value;
    if (dept && dept.allowDirections && !dirId) {
      toast(t('dir.title') + ' ' + t('common.required'), 'error');
      return;
    }
    const body = {
      fullName: document.getElementById('empFullName').value.trim(),
      code: document.getElementById('empCode').value.trim(),
      phone: document.getElementById('empPhone').value.trim(),
      departmentId: deptId,
      directionId: dept && dept.allowDirections ? dirId : null,
    };
    try {
      if (id) await api(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/api/employees', { method: 'POST', body: JSON.stringify(body) });
      toast(t('msg.saved'));
      closeModal('empModal');
      fetchAndRenderEmployees();
    } catch (e2) { toast(e2.message, 'error'); }
  });
}

// ============================================
// DIRECTIONS (Departments + Directions)
// ============================================
async function loadDirectionsPage() {
  await fetchDepartments();
}

async function fetchDepartments() {
  const container = document.getElementById('deptContainer');
  container.innerHTML = '<div class="skeleton h-24"></div>';
  try {
    state.departments = await api('/api/departments');
    renderDepartments();
    if (state.selectedDeptId) {
      const sel = state.departments.find(d => d._id === state.selectedDeptId);
      if (sel) selectDept(sel._id);
      else { state.selectedDeptId = null; document.getElementById('dirSection').classList.add('hidden'); }
    }
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(e.message)}</div>`;
  }
}

function renderDepartments() {
  const container = document.getElementById('deptContainer');
  if (state.departments.length === 0) {
    container.innerHTML = `<div class="card p-10 text-center"><p class="font-bold mb-1">${t('dept.empty')}</p><p class="text-sm text-zinc-500">${t('dept.emptyHint')}</p></div>`;
    document.getElementById('dirSection').classList.add('hidden');
    return;
  }
  container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    ${state.departments.map(d => `
      <div class="dept-card ${state.selectedDeptId === d._id ? 'selected' : ''}" data-id="${d._id}">
        <div class="flex justify-between items-start gap-2 mb-2">
          <div class="font-bold text-base">${escapeHtml(d.name)}</div>
          <span class="badge ${d.allowDirections ? 'badge-on' : 'badge-off'}">${d.allowDirections ? 'ON' : 'OFF'}</span>
        </div>
        ${d.description ? `<div class="text-xs text-zinc-500 mb-2">${escapeHtml(d.description)}</div>` : ''}
        <div class="mono text-xs text-zinc-500 mb-3">
          ${d.allowDirections ? `${d.directionCount || 0} ${t('dept.directionCount')} · ` : ''}${d.employeeCount || 0} ${t('dept.employeeCount')}
        </div>
        ${d.budget > 0 ? `<div class="text-xs text-zinc-400 mb-2">${t('dept.budget')}: <span class="mono text-emerald-400">${formatMoney(d.budget)}</span></div>` : ''}
        ${!d.allowDirections && d.pricePerUnit > 0 ? `<div class="text-xs text-zinc-400 mb-2">${t('dept.pricePerUnit')}: <span class="mono text-purple-300">${formatMoney(d.pricePerUnit)}</span></div>` : ''}
        <div class="flex gap-1 pt-2 border-t border-purple-500/10">
          <button class="btn-icon flex-1" data-act="dept-edit" data-id="${d._id}" onclick="event.stopPropagation()" title="${t('common.edit')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-act="dept-delete" data-id="${d._id}" data-name="${escapeHtml(d.name)}" onclick="event.stopPropagation()" title="${t('common.delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </div>
      </div>`).join('')}
  </div>`;

  container.querySelectorAll('.dept-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      selectDept(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-act="dept-edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openDeptEdit(btn.dataset.id); });
  });
  container.querySelectorAll('[data-act="dept-delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id, name = btn.dataset.name;
      openConfirm(t('dept.deleteConfirm'), `"${name}"`, async () => {
        try { await api(`/api/departments/${id}`, { method: 'DELETE' }); toast(t('msg.deleted')); fetchDepartments(); }
        catch (e2) { toast(e2.message, 'error'); }
      });
    });
  });
}

async function selectDept(deptId) {
  state.selectedDeptId = deptId;
  document.querySelectorAll('#deptContainer .dept-card').forEach(c => c.classList.toggle('selected', c.dataset.id === deptId));
  const dept = state.departments.find(d => d._id === deptId);
  if (!dept) return;

  if (!dept.allowDirections) {
    document.getElementById('dirSection').classList.add('hidden');
    return;
  }

  document.getElementById('dirSection').classList.remove('hidden');
  document.getElementById('dirSectionTitle').textContent = `${dept.name} — ${t('dir.title')}`;
  document.getElementById('dirSectionHint').textContent = '';
  await fetchDirections(deptId);
}

async function fetchDirections(deptId) {
  const container = document.getElementById('dirContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-24"></div></div>';
  try {
    state.directions = await api(`/api/directions?departmentId=${deptId}`);
    renderDirections();
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
}

function renderDirections() {
  const container = document.getElementById('dirContainer');
  if (state.directions.length === 0) {
    container.innerHTML = `<div class="p-10 text-center"><p class="font-bold mb-1">${t('dir.empty')}</p><p class="text-sm text-zinc-500">${t('dir.emptyHint')}</p></div>`;
    return;
  }
  container.innerHTML = `<div class="p-5 space-y-3">
    ${state.directions.map(d => `
      <div class="card p-4 flex items-center justify-between gap-3 flex-wrap" style="background: rgba(139, 92, 246, 0.04)">
        <div class="flex-1 min-w-0">
          <div class="font-bold text-base">${escapeHtml(d.name)}</div>
          <div class="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/25">
            <span class="text-xs font-medium text-purple-300">${t('dir.price')}</span>
            <span class="mono text-xs font-bold text-purple-300">${formatMoney(d.price)} ${t('common.sum')}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="btn-icon" data-act="dir-edit" data-id="${d._id}" title="${t('common.edit')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-act="dir-delete" data-id="${d._id}" data-name="${escapeHtml(d.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </div>
      </div>`).join('')}
  </div>`;
  container.querySelectorAll('[data-act="dir-edit"]').forEach(btn => btn.addEventListener('click', () => openDirEdit(btn.dataset.id)));
  container.querySelectorAll('[data-act="dir-delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id, name = btn.dataset.name;
      openConfirm(t('dir.deleteConfirm'), `"${name}"`, async () => {
        try { await api(`/api/directions/${id}`, { method: 'DELETE' }); toast(t('msg.deleted')); fetchDirections(state.selectedDeptId); }
        catch (e2) { toast(e2.message, 'error'); }
      });
    });
  });
}

function setDeptAllowDirections(on) {
  document.getElementById('deptAllowDirections').value = on ? 'true' : 'false';
  document.getElementById('deptAllowSwitch').classList.toggle('on', on);
}

function openDeptAdd() {
  document.getElementById('deptEditingId').value = '';
  document.getElementById('deptForm').reset();
  document.getElementById('deptModalTitle').textContent = t('dept.add');
  setDeptAllowDirections(true);
  openModal('deptModal');
}

function openDeptEdit(id) {
  const d = state.departments.find(x => x._id === id);
  if (!d) return;
  document.getElementById('deptEditingId').value = id;
  document.getElementById('deptModalTitle').textContent = t('dept.edit');
  document.getElementById('deptName').value = d.name || '';
  setDeptAllowDirections(!!d.allowDirections);
  openModal('deptModal');
}

function openDirAdd() {
  if (!state.selectedDeptId) return;
  document.getElementById('dirEditingId').value = '';
  document.getElementById('dirForm').reset();
  document.getElementById('dirModalTitle').textContent = t('dir.add');
  openModal('dirModal');
}

function openDirEdit(id) {
  const d = state.directions.find(x => x._id === id);
  if (!d) return;
  document.getElementById('dirEditingId').value = id;
  document.getElementById('dirModalTitle').textContent = t('dir.edit');
  document.getElementById('dirName').value = d.name || '';
  document.getElementById('dirPrice').value = d.price || 0;
  openModal('dirModal');
}

function setupDirectionsPage() {
  document.getElementById('deptAddBtn').addEventListener('click', openDeptAdd);
  document.getElementById('dirAddBtn').addEventListener('click', openDirAdd);
  document.getElementById('deptAllowSwitch').addEventListener('click', () => {
    setDeptAllowDirections(document.getElementById('deptAllowDirections').value !== 'true');
  });

  document.getElementById('deptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('deptEditingId').value;
    const body = {
      name: document.getElementById('deptName').value.trim(),
      allowDirections: document.getElementById('deptAllowDirections').value === 'true',
    };
    try {
      if (id) await api(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/api/departments', { method: 'POST', body: JSON.stringify(body) });
      toast(t('msg.saved'));
      closeModal('deptModal');
      fetchDepartments();
    } catch (e2) { toast(e2.message, 'error'); }
  });

  document.getElementById('dirForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('dirEditingId').value;
    const body = {
      name: document.getElementById('dirName').value.trim(),
      price: Number(document.getElementById('dirPrice').value || 0),
      departmentId: state.selectedDeptId,
    };
    try {
      if (id) await api(`/api/directions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/api/directions', { method: 'POST', body: JSON.stringify(body) });
      toast(t('msg.saved'));
      closeModal('dirModal');
      fetchDirections(state.selectedDeptId);
      fetchDepartments();
    } catch (e2) { toast(e2.message, 'error'); }
  });
}

// ============================================
// DAILY REPORT
// ============================================
async function loadDailyReportPage() {
  if (!state.dailyDate) state.dailyDate = todayISO();
  const input = document.getElementById('dailyDateInput');
  input.value = state.dailyDate;
  input.max = todayISO();
  document.getElementById('dailyDateLabel').textContent = formatDate(state.dailyDate);

  // Bo'limlarni olish (tabs uchun)
  try {
    const data = await api(`/api/daily-report?date=${state.dailyDate}`);
    state.dailyData = data;
    renderDailyDeptTabs(data.departments || []);
    if (state.dailySelectedDeptId && (data.departments || []).find(d => d._id === state.dailySelectedDeptId)) {
      loadDailyForDept(state.dailySelectedDeptId);
    } else if ((data.departments || []).length > 0) {
      loadDailyForDept(data.departments[0]._id);
    } else {
      document.getElementById('dailyContent').innerHTML = `<p class="text-center text-zinc-500 py-12">${t('dept.empty')}</p>`;
    }
  } catch (e) {
    document.getElementById('dailyContent').innerHTML = `<p class="text-center text-red-400 py-12">${escapeHtml(e.message)}</p>`;
  }
}

function renderDailyDeptTabs(departments) {
  const tabs = document.getElementById('dailyDeptTabs');
  tabs.innerHTML = departments.map(d => `
    <button class="tab-item ${state.dailySelectedDeptId === d._id ? 'active' : ''}" data-id="${d._id}">
      ${escapeHtml(d.name)} <span class="text-[10px] ml-1 ${d.allowDirections ? 'text-emerald-400' : 'text-amber-400'}">${d.allowDirections ? 'ON' : 'OFF'}</span>
    </button>`).join('');
  tabs.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => loadDailyForDept(btn.dataset.id));
  });
}

async function loadDailyForDept(deptId) {
  state.dailySelectedDeptId = deptId;
  state.dailySelectedDirId = null;
  document.querySelectorAll('#dailyDeptTabs .tab-item').forEach(t => t.classList.toggle('active', t.dataset.id === deptId));
  const container = document.getElementById('dailyContent');
  container.innerHTML = '<div class="skeleton h-32"></div>';
  try {
    const data = await api(`/api/daily-report?date=${state.dailyDate}&departmentId=${deptId}`);
    state.dailyData = data;
    renderDailyContent(data);
  } catch (e) {
    container.innerHTML = `<p class="text-center text-red-400 py-12">${escapeHtml(e.message)}</p>`;
  }
}

function renderDailyContent(data) {
  const dept = data.department;
  const isOn = dept.allowDirections;
  const container = document.getElementById('dailyContent');

  // Direction filter tabs (faqat ON bo'limlar uchun)
  let dirFilterHtml = '';
  if (isOn) {
    const selId = state.dailySelectedDirId;
    dirFilterHtml = `<div class="flex gap-2 mb-5 overflow-x-auto pb-1" id="dailyDirFilter">
      <button class="tab-item ${!selId ? 'active' : ''}" data-dir-id="">Barchasi</button>
      ${data.directions.map(d => `
        <button class="tab-item ${selId === String(d._id) ? 'active' : ''}" data-dir-id="${d._id}">
          ${escapeHtml(d.name)}<span class="mono text-[10px] ml-1.5 opacity-70">${formatMoney(d.price)}</span>
        </button>`).join('')}
    </div>`;
  }

  // Tanlangan yo'nalishga qarab filterlash
  let filteredAssigned = data.assigned;
  let filteredUnassigned = data.unassigned;
  if (isOn && state.dailySelectedDirId) {
    const did = state.dailySelectedDirId;
    filteredAssigned = data.assigned.filter(a => String(a.directionId) === did);
    filteredUnassigned = data.unassigned.filter(e => String(e.directionId?._id) === did);
  }

  let productionCardHtml = '';
  if (!isOn) {
    const prod = data.production || { quantity: 0, productName: '' };
    const label = prod.productName ? escapeHtml(prod.productName) : 'Mahsulot';
    const assignedSum = filteredAssigned.reduce((s, a) => s + (Number(a.productCount) || 0), 0);
    const target = Number(prod.quantity) || 0;
    const color = target === 0
      ? 'text-purple-300'
      : assignedSum > target
        ? 'text-rose-400'
        : assignedSum === target
          ? 'text-emerald-400'
          : 'text-purple-300';
    productionCardHtml = `<div class="stat-card cursor-pointer hover:border-purple-500/40 transition" data-act="prod-edit">
      <div class="mono text-[10px] text-zinc-500 uppercase mb-1 truncate">${label}</div>
      <div class="text-2xl font-bold ${color}"><span class="mono">${assignedSum}</span><span class="text-zinc-500 text-lg">/${target}</span></div>
    </div>`;
  }

  const statsCols = isOn ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
  const statsHtml = `<div class="grid ${statsCols} gap-3 mb-6">
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.assigned')}</div><div class="text-2xl font-bold">${data.stats.totalAssigned}</div></div>
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.unassigned')}</div><div class="text-2xl font-bold text-amber-400">${data.stats.totalUnassigned}</div></div>
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.earning')}</div><div class="text-2xl font-bold text-emerald-400">${formatMoney(data.stats.totalEarning)}</div></div>
    ${productionCardHtml}
  </div>`;

  const productionHtml = '';

  const assignedHtml = filteredAssigned.length === 0
    ? `<p class="text-sm text-zinc-500 text-center py-6">${t('daily.empty')}</p>`
    : filteredAssigned.map(a => {
        const extra = isOn
          ? (a.directionSnapshot?.name || '—')
          : `${a.productCount || 0} ${t('common.sum')}/dona`;
        return `<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 mb-2">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">${escapeHtml(a.employeeSnapshot?.fullName || '—')}</div>
            <div class="mono text-xs text-zinc-500 mt-0.5 truncate">
              <span class="text-emerald-300">${escapeHtml(a.employeeSnapshot?.code || '—')}</span>
              · ${extra}
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="mono text-sm font-semibold text-emerald-400">${formatMoney(a.earning)}</div>
          </div>
          <button class="btn-icon" data-act="earning-edit" data-id="${a._id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-act="unassign" data-id="${a._id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      }).join('');

  const unassignedHtml = filteredUnassigned.length === 0
    ? `<p class="text-sm text-zinc-500 text-center py-6">—</p>`
    : filteredUnassigned.map(e => {
        const dirName = e.directionId?.name ? ` · ${escapeHtml(e.directionId.name)}` : '';
        const disabled = isOn && !e.directionId ? 'disabled' : '';
        const btnLabel = (isOn && !e.directionId) ? t('daily.noDirection') || "Yo'nalish yo'q" : t('daily.assign');
        return `<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-2">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${escapeHtml(e.fullName)}</div>
          <div class="mono text-xs text-amber-300/70 mt-0.5 truncate">${escapeHtml(e.code)}${dirName}</div>
        </div>
        <button class="btn-ghost px-3 py-1.5 rounded-lg text-xs" data-act="assign-direct" data-id="${e._id}" data-name="${escapeHtml(e.fullName)}" ${disabled}>${btnLabel}</button>
      </div>`;
      }).join('');

  container.innerHTML = dirFilterHtml + productionHtml + statsHtml + `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold mb-3 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
          ${t('daily.assigned')} (${filteredAssigned.length})
        </h3>
        ${assignedHtml}
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-3 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-amber-400"></div>
          ${t('daily.unassigned')} (${filteredUnassigned.length})
        </h3>
        ${unassignedHtml}
      </div>
    </div>`;

  // Direction filter tugmachalar
  if (isOn) {
    container.querySelectorAll('[data-dir-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.dailySelectedDirId = btn.dataset.dirId || null;
        renderDailyContent(data);
      });
    });
  }

  // Event handlers
  container.querySelectorAll('[data-act="qty-edit"]').forEach(btn => {
    btn.addEventListener('click', () => openQuantityModal(btn.dataset.id, btn.dataset.name, Number(btn.dataset.qty)));
  });
  container.querySelectorAll('[data-act="assign-direct"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const dept = state.dailyData.department;
      const body = {
        employeeId: btn.dataset.id,
        departmentId: dept._id,
        shift: 1,
        date: state.dailyDate,
      };
      try {
        btn.disabled = true;
        await api('/api/daily-report/assign', { method: 'POST', body: JSON.stringify(body) });
        toast(t('msg.saved'));
        loadDailyForDept(state.dailySelectedDeptId);
      } catch (e2) {
        btn.disabled = false;
        toast(e2.message, 'error');
      }
    });
  });
  container.querySelectorAll('[data-act="unassign"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await api(`/api/daily-report/assign/${btn.dataset.id}`, { method: 'DELETE' }); toast(t('msg.deleted')); loadDailyForDept(state.dailySelectedDeptId); }
      catch (e) { toast(e.message, 'error'); }
    });
  });
  container.querySelectorAll('[data-act="earning-edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEarningModal(btn.dataset.id));
  });
  container.querySelectorAll('[data-act="prod-edit"]').forEach(btn => {
    btn.addEventListener('click', () => openProductionModal());
  });
}

function openProductionModal() {
  const dept = state.dailyData.department;
  const prod = state.dailyData.production || { quantity: 0, productName: '' };
  document.getElementById('productionDepartmentId').value = dept._id;
  document.getElementById('productionDeptName').textContent = dept.name;
  document.getElementById('productionName').value = prod.productName || '';
  document.getElementById('productionQuantity').value = prod.quantity || 0;
  openModal('productionModal');
}

function openQuantityModal(directionId, dirName, currentQty) {
  document.getElementById('quantityDirectionId').value = directionId;
  document.getElementById('quantityDirName').textContent = dirName;
  document.getElementById('quantityValue').value = currentQty;
  openModal('quantityModal');
}

function openEarningModal(assignmentId) {
  const a = state.dailyData.assigned.find(x => x._id === assignmentId);
  if (!a) return;
  const isOn = state.dailyData.department.allowDirections;
  document.getElementById('earningAssignmentId').value = assignmentId;
  document.getElementById('earningEmployeeName').textContent = a.employeeSnapshot?.fullName || '—';
  document.getElementById('earningProductWrap').classList.toggle('hidden', isOn);
  document.getElementById('earningProductCount').value = a.productCount || 0;
  document.getElementById('earningAmount').value = a.earning || 0;
  openModal('earningModal');
}

function setupDailyReportPage() {
  const input = document.getElementById('dailyDateInput');
  input.max = todayISO();
  input.addEventListener('change', () => {
    if (input.value > todayISO()) { toast(t('daily.future'), 'error'); input.value = state.dailyDate; return; }
    state.dailyDate = input.value;
    document.getElementById('dailyDateLabel').textContent = formatDate(state.dailyDate);
    loadDailyReportPage();
  });
  document.getElementById('dailyTodayBtn').addEventListener('click', () => {
    state.dailyDate = todayISO();
    loadDailyReportPage();
  });

  document.getElementById('quantityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      directionId: document.getElementById('quantityDirectionId').value,
      quantity: Number(document.getElementById('quantityValue').value || 0),
      date: state.dailyDate,
    };
    try { await api('/api/daily-report/quantity', { method: 'POST', body: JSON.stringify(body) }); toast(t('msg.saved')); closeModal('quantityModal'); loadDailyForDept(state.dailySelectedDeptId); }
    catch (e2) { toast(e2.message, 'error'); }
  });

  document.getElementById('productionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      departmentId: document.getElementById('productionDepartmentId').value,
      productName: document.getElementById('productionName').value.trim(),
      quantity: Number(document.getElementById('productionQuantity').value || 0),
      date: state.dailyDate,
    };
    try { await api('/api/daily-report/production', { method: 'POST', body: JSON.stringify(body) }); toast(t('msg.saved')); closeModal('productionModal'); loadDailyForDept(state.dailySelectedDeptId); }
    catch (e2) { toast(e2.message, 'error'); }
  });

  document.getElementById('earningForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('earningAssignmentId').value;
    const isOn = state.dailyData.department.allowDirections;
    const body = { earning: Number(document.getElementById('earningAmount').value || 0) };
    if (!isOn) body.productCount = Number(document.getElementById('earningProductCount').value || 0);
    try { await api(`/api/daily-report/assign/${id}`, { method: 'PUT', body: JSON.stringify(body) }); toast(t('msg.saved')); closeModal('earningModal'); loadDailyForDept(state.dailySelectedDeptId); }
    catch (e2) { toast(e2.message, 'error'); }
  });
}

// ============================================
// MONTHLY REPORT
// ============================================
async function loadMonthlyReportPage() {
  const startInput = document.getElementById('monthStart');
  const endInput = document.getElementById('monthEnd');
  if (!startInput.value) startInput.value = firstDayOfMonth();
  if (!endInput.value) endInput.value = todayISO();
  await fetchMonthly();
}

async function fetchMonthly() {
  const startDate = document.getElementById('monthStart').value;
  const endDate = document.getElementById('monthEnd').value;
  const code = document.getElementById('monthCode').value.trim();
  if (!startDate || !endDate) return toast(t('msg.error'), 'error');

  const url = `/api/monthly-report?startDate=${startDate}&endDate=${endDate}` + (code ? `&code=${encodeURIComponent(code)}` : '');
  const container = document.getElementById('monthResults');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-24"></div></div>';
  try {
    const data = await api(url);
    state.monthlyData = data;
    document.getElementById('monthStatEarning').textContent = formatMoney(data.stats.totalEarning);
    document.getElementById('monthStatEmployees').textContent = data.stats.totalEmployees;
    document.getElementById('monthStatPaid').textContent = formatMoney(data.stats.totalPaid);
    document.getElementById('monthStatRemaining').textContent = formatMoney(Math.max(0, data.stats.totalEarning - data.stats.totalPaid));
    renderMonthly(data);
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
}

function renderMonthly(data) {
  const container = document.getElementById('monthResults');
  if (data.employees.length === 0) {
    container.innerHTML = `<div class="p-12 text-center text-zinc-500">${t('month.empty')}</div>`;
    return;
  }
  container.innerHTML = `<div class="overflow-x-auto"><table class="data-table"><thead><tr>
      <th>${t('emp.fullName')}</th>
      <th>${t('emp.code')}</th>
      <th class="text-right">${t('month.days')}</th>
      <th class="text-right">${t('month.earning')}</th>
      <th class="text-right">${t('month.paid')}</th>
      <th class="text-right">${t('month.remaining')}</th>
    </tr></thead><tbody>
    ${data.employees.map(e => `
      <tr>
        <td class="font-medium">${escapeHtml(e.fullName)}</td>
        <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-300">${escapeHtml(e.code)}</span></td>
        <td class="text-right mono text-zinc-400">${e.totalDays}</td>
        <td class="text-right mono font-semibold text-emerald-400">${formatMoney(e.totalEarning)}</td>
        <td class="text-right mono text-emerald-300">${formatMoney(e.totalPaid)}</td>
        <td class="text-right mono font-bold ${e.remaining > 0 ? 'text-amber-400' : 'text-zinc-500'}">${formatMoney(e.remaining)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function setupMonthlyReportPage() {
  document.getElementById('monthSearchBtn').addEventListener('click', fetchMonthly);
  document.getElementById('monthCode').addEventListener('keypress', e => { if (e.key === 'Enter') fetchMonthly(); });
}

// ============================================
// SALARY
// ============================================
async function loadSalaryPage() {
  document.getElementById('salaryListView').classList.remove('hidden');
  document.getElementById('salaryDetailView').classList.add('hidden');
  const startInput = document.getElementById('salaryStart');
  const endInput = document.getElementById('salaryEnd');
  if (!startInput.value) startInput.value = firstDayOfMonth();
  if (!endInput.value) endInput.value = todayISO();
  await fetchSalary();
}

async function fetchSalary() {
  const container = document.getElementById('salaryList');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-24"></div></div>';
  const startDate = document.getElementById('salaryStart').value;
  const endDate = document.getElementById('salaryEnd').value;
  const code = document.getElementById('salaryCode').value.trim();
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (code) params.set('code', code);
  try {
    const data = await api(`/api/salary${params.toString() ? '?' + params : ''}`);
    state.salaryData = data;
    applySalaryView();
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
}

function applySalaryView() {
  const data = state.salaryData;
  if (!data) return;
  document.getElementById('salStatEarned').textContent = formatMoney(data.stats.totalEarned);
  document.getElementById('salStatPaid').textContent = formatMoney(data.stats.totalPaid);
  document.getElementById('salStatRemaining').textContent = formatMoney(data.stats.totalRemaining);
  document.getElementById('salStatEmployees').textContent = data.stats.totalEmployees;
  const employees = Array.isArray(data.employees) ? data.employees : [];
  const paidCount = employees.filter(e => (Number(e.remaining) || 0) <= 0).length;
  const unpaidCount = employees.filter(e => (Number(e.remaining) || 0) > 0).length;
  const setCount = (k, n) => {
    const el = document.querySelector(`#salaryTabs [data-tab-count="${k}"]`);
    if (el) el.textContent = `(${n})`;
  };
  setCount('all', employees.length);
  setCount('paid', paidCount);
  setCount('unpaid', unpaidCount);
  const filtered = state.salaryFilter === 'paid'
    ? employees.filter(e => (Number(e.remaining) || 0) <= 0)
    : state.salaryFilter === 'unpaid'
      ? employees.filter(e => (Number(e.remaining) || 0) > 0)
      : employees;
  renderSalaryList(filtered);
}

function renderSalaryList(employees) {
  const container = document.getElementById('salaryList');
  if (employees.length === 0) {
    container.innerHTML = `<div class="p-12 text-center text-zinc-500">${t('emp.empty')}</div>`;
    return;
  }
  container.innerHTML = `<div class="overflow-x-auto"><table class="data-table"><thead><tr>
      <th>${t('emp.fullName')}</th>
      <th>${t('emp.code')}</th>
      <th>${t('emp.department')}</th>
      <th class="text-right">${t('salary.earning')}</th>
      <th class="text-right">${t('salary.paid')}</th>
      <th class="text-right">${t('salary.remaining')}</th>
      <th class="text-right">${t('common.actions')}</th>
    </tr></thead><tbody>
    ${employees.map(e => `
      <tr class="cursor-pointer" data-id="${e._id}">
        <td class="font-medium">${escapeHtml(e.fullName)}</td>
        <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-300">${escapeHtml(e.code)}</span></td>
        <td class="text-sm text-zinc-400">${escapeHtml(e.department?.name || '—')}</td>
        <td class="text-right mono font-semibold text-emerald-400">${formatMoney(e.totalEarning)}</td>
        <td class="text-right mono text-emerald-300">${formatMoney(e.totalPaid)}</td>
        <td class="text-right mono font-bold ${e.remaining > 0 ? 'text-amber-400' : 'text-zinc-500'}">${formatMoney(e.remaining)}</td>
        <td class="text-right">
          <button class="btn-ghost px-3 py-1.5 rounded-lg text-xs" data-act="sal-detail" data-id="${e._id}">${t('salary.detail')}</button>
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;
  container.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      loadSalaryDetail(tr.dataset.id);
    });
  });
  container.querySelectorAll('[data-act="sal-detail"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); loadSalaryDetail(btn.dataset.id); });
  });
}

async function loadSalaryDetail(employeeId) {
  document.getElementById('salaryListView').classList.add('hidden');
  document.getElementById('salaryDetailView').classList.remove('hidden');
  const container = document.getElementById('salaryDetailView');
  container.innerHTML = '<div class="card p-8"><div class="skeleton h-32"></div></div>';
  try {
    const data = await api(`/api/salary/${employeeId}`);
    state.salaryDetail = data;
    renderSalaryDetail(data);
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
}

function salaryDayRow(day, source) {
  const paid = !!day.paid;
  const isPrev = source === 'previous';
  const shift = day.shift === 0.5 ? '½' : '1';
  const product = day.productCount ? ` · ${day.productCount}` : '';
  const dept = escapeHtml(day.departmentName || '—');
  const dir = day.directionName ? ` · ${escapeHtml(day.directionName)}` : '';
  const monthBadge = isPrev && day.monthKey
    ? `<span class="badge badge-off text-[10px] ml-2">${escapeHtml(day.monthKey)}</span>`
    : '';
  const paidBadge = paid
    ? `<span class="badge badge-on text-[10px] mt-1 inline-flex">${t('salary.alreadyPaid')}</span>`
    : '';
  return `
    <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-500/5 cursor-pointer transition ${paid ? 'opacity-60' : ''}">
      <input type="checkbox" data-date="${escapeHtml(day.date)}" data-earning="${Number(day.earning) || 0}" data-source="${source}" ${paid ? 'disabled' : ''} class="w-4 h-4 accent-purple-500 flex-shrink-0">
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm ${paid ? 'line-through text-zinc-500' : ''}">${formatDate(day.date)}${monthBadge}</div>
        <div class="text-xs text-zinc-500 truncate">${dept} · ${shift}${dir}${product}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="mono font-semibold ${paid ? 'text-zinc-500' : 'text-emerald-400'}">${formatMoney(day.earning)}</div>
        ${paidBadge}
      </div>
    </label>
  `;
}

function renderSalaryDetail(data) {
  state.salarySelectedDates = new Set();
  const e = data.employee;
  const s = data.stats || {};
  const cm = data.currentMonth || { monthKey: '', days: [] };
  const previous = Array.isArray(data.unpaidPrevious) ? data.unpaidPrevious : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const cmDays = Array.isArray(cm.days) ? cm.days : [];
  const container = document.getElementById('salaryDetailView');

  const currentMonthHtml = cmDays.length === 0
    ? `<div class="p-6 text-center text-sm text-zinc-500">${t('salary.noWorkDays')}</div>`
    : cmDays.map(d => salaryDayRow(d, 'current')).join('');

  const previousHtml = previous.length === 0 ? '' : `
    <div class="card p-5 mb-4 border-l-4 border-amber-500/40">
      <div class="flex items-center justify-between mb-3 pb-3 border-t border-b border-amber-500/40 py-3">
        <h3 class="font-bold text-amber-300">${t('salary.unpaidPrevious')} <span class="text-xs text-zinc-500">(${previous.length})</span></h3>
        <div class="text-xs mono text-amber-400">${formatMoney(s.unpaidPreviousAmount || 0)}</div>
      </div>
      <div class="space-y-1">
        ${previous.map(d => salaryDayRow(d, 'previous')).join('')}
      </div>
    </div>
  `;

  const paymentsHtml = payments.length === 0
    ? `<p class="text-sm text-zinc-500 text-center py-4">—</p>`
    : `
      <div class="space-y-2 max-h-96 overflow-y-auto">
        ${payments.map(p => {
          const hasDates = Array.isArray(p.paidDates) && p.paidDates.length > 0;
          const badge = hasDates
            ? `<span class="badge badge-on text-[10px]">${p.paidDates.length} ${t('salary.days')}</span>`
            : `<span class="badge badge-off text-[10px]">${t('salary.payUntil')}</span>`;
          const when = p.paidAt ? formatDate(p.paidAt) : (p.untilDate ? formatDate(p.untilDate) : '—');
          return `
            <div class="flex justify-between gap-2 p-2 rounded-lg bg-emerald-500/5 text-sm">
              <div>
                <div class="font-medium">${when}</div>
                <div class="mt-1">${badge}</div>
              </div>
              <div class="mono font-semibold text-emerald-400">${formatMoney(p.amount)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

  const deptName = (e.departmentId && e.departmentId.name) || e.departmentName || '—';

  container.innerHTML = `
    <button class="btn-ghost px-4 py-2 rounded-xl text-sm mb-4" id="salBackBtn">← ${t('common.back')}</button>
    <div class="card p-6 mb-6">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold mb-2">${escapeHtml(e.fullName)}</h2>
          <div class="flex flex-wrap gap-3 text-sm text-zinc-400">
            <span class="mono text-purple-300">${escapeHtml(e.code)}</span>
            <span>${escapeHtml(deptName)}</span>
            ${e.phone ? `<span class="mono">${escapeHtml(e.phone)}</span>` : ''}
          </div>
        </div>
        <button id="salEmpExportBtn" class="btn-ghost px-4 py-2 rounded-xl text-sm" data-id="${escapeHtml(e._id)}" data-code="${escapeHtml(e.code || '')}">
          ${t('export.excel')}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div class="stat-card">
        <div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.currentMonth')} · ${t('salary.days')}</div>
        <div class="text-2xl font-bold">${cmDays.length}</div>
      </div>
      <div class="stat-card">
        <div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.currentMonth')} · ${t('salary.earning')}</div>
        <div class="text-2xl font-bold text-emerald-400">${formatMoney(s.currentMonthEarning || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.unpaidPrevious')} · ${t('salary.days')}</div>
        <div class="text-2xl font-bold text-amber-400">${s.unpaidPreviousCount || 0}</div>
      </div>
      <div class="stat-card">
        <div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.unpaidPrevious')} · ${t('common.sum')}</div>
        <div class="text-2xl font-bold text-amber-400">${formatMoney(s.unpaidPreviousAmount || 0)}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        ${previousHtml}
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3 pb-3 border-b border-purple-500/20">
            <h3 class="font-bold">${t('salary.currentMonth')} ${cm.monthKey ? `<span class="text-xs text-zinc-500 ml-1">· ${escapeHtml(cm.monthKey)}</span>` : ''}</h3>
            <div class="text-xs text-zinc-500">${cmDays.length} ${t('salary.days')}</div>
          </div>
          <div class="space-y-1" id="salCurrentList">
            ${currentMonthHtml}
          </div>
        </div>

        <div class="sticky bottom-0 mt-4 card p-4 z-10" id="salFooter" style="backdrop-filter: blur(12px);">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="text-sm flex items-center gap-2 flex-wrap">
              <span class="text-zinc-400">${t('salary.selected')}:</span>
              <span class="font-bold mono"><span id="salSelCount">0</span> ${t('salary.days')}</span>
              <span class="text-zinc-600">·</span>
              <span class="text-zinc-400">${t('common.total')}:</span>
              <span class="font-bold mono text-emerald-400"><span id="salSelSum">0</span> ${t('common.sum')}</span>
            </div>
            <button id="salPayBtn" class="btn-primary px-5 py-2.5 rounded-xl text-sm" disabled>
              ${t('salary.payDays')}
            </button>
          </div>
        </div>
      </div>

      <div class="card p-5 h-fit">
        <h3 class="font-bold mb-3">${t('salary.history')} (${payments.length})</h3>
        ${paymentsHtml}
      </div>
    </div>`;

  document.getElementById('salBackBtn').addEventListener('click', loadSalaryPage);

  const empExportBtn = document.getElementById('salEmpExportBtn');
  if (empExportBtn) {
    empExportBtn.addEventListener('click', async () => {
      const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
      const id = empExportBtn.dataset.id;
      const code = empExportBtn.dataset.code || 'X';
      try {
        await downloadExcel(`/api/salary/${id}/export?lang=${encodeURIComponent(lang)}`, `maosh_${code}.xlsx`);
        toast(t('export.done'));
      } catch (er) { toast(er.message, 'error'); }
    });
  }

  container.querySelectorAll('input[type="checkbox"][data-date]').forEach(cb => {
    cb.addEventListener('change', () => {
      const date = cb.dataset.date;
      if (cb.checked) state.salarySelectedDates.add(date);
      else state.salarySelectedDates.delete(date);
      updateSalaryFooter();
    });
  });

  const payBtn = document.getElementById('salPayBtn');
  if (payBtn) payBtn.addEventListener('click', () => confirmSalaryPayment(e._id));

  updateSalaryFooter();
}

function updateSalaryFooter() {
  let sum = 0;
  document.querySelectorAll('input[type="checkbox"][data-date]:checked').forEach(cb => {
    sum += Number(cb.dataset.earning) || 0;
  });
  const countEl = document.getElementById('salSelCount');
  const sumEl = document.getElementById('salSelSum');
  const payBtn = document.getElementById('salPayBtn');
  const count = state.salarySelectedDates.size;
  if (countEl) countEl.textContent = String(count);
  if (sumEl) sumEl.textContent = formatMoney(sum);
  if (payBtn) payBtn.disabled = count === 0;
}

async function confirmSalaryPayment(employeeId) {
  const dates = Array.from(state.salarySelectedDates);
  if (dates.length === 0) return;
  let sum = 0;
  document.querySelectorAll('input[type="checkbox"][data-date]:checked').forEach(cb => {
    sum += Number(cb.dataset.earning) || 0;
  });
  const message = t('salary.confirmPay')
    .replace('{count}', String(dates.length))
    .replace('{amount}', formatMoney(sum));
  if (!window.confirm(message)) return;
  try {
    await api(`/api/salary/${employeeId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ dates })
    });
    toast(t('msg.saved'));
    state.salarySelectedDates = new Set();
    loadSalaryDetail(employeeId);
  } catch (e2) {
    toast(e2.message, 'error');
  }
}

function setupSalaryPage() {
  document.getElementById('salarySearchBtn').addEventListener('click', fetchSalary);
  document.getElementById('salaryCode').addEventListener('keypress', e => { if (e.key === 'Enter') fetchSalary(); });
  document.getElementById('salaryResetBtn').addEventListener('click', () => {
    document.getElementById('salaryStart').value = '';
    document.getElementById('salaryEnd').value = '';
    document.getElementById('salaryCode').value = '';
    fetchSalary();
  });

  document.querySelectorAll('#salaryTabs button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.salaryFilter = btn.dataset.tab;
      document.querySelectorAll('#salaryTabs button[data-tab]').forEach(b => b.classList.toggle('tab-active', b === btn));
      applySalaryView();
    });
  });
}

// ============================================
// ARCHIVE
// ============================================
async function loadArchivePage() {
  // Reset to default tab on each page entry
  state.archiveTab = state.archiveTab || 'history';
  state.archiveCategory = '';
  state.archiveFiles = null;
  applyArchiveTab();

  const historyContainer = document.getElementById('archiveList');
  historyContainer.innerHTML = '<div class="skeleton h-24"></div>';
  try {
    const data = await api('/api/archive');
    state.archiveData = data;
    document.getElementById('archStatAmount').textContent = formatMoney(data.stats.totalAmount);
    document.getElementById('archStatPayments').textContent = data.stats.totalPayments;
    document.getElementById('archStatMonths').textContent = data.stats.monthsCount;
    renderArchiveHistory(data.months || []);
    renderArchiveCategoryTabs(data.filesStats || {});
    const fs = data.filesStats || {};
    const totalFiles = (Number(fs.employeesCount)||0) + (Number(fs.dailyCount)||0) + (Number(fs.monthlyCount)||0) + (Number(fs.salaryCount)||0);
    const badge = document.getElementById('archFilesTabCount');
    if (badge) badge.textContent = totalFiles > 0 ? `(${totalFiles})` : '';
    if (state.archiveTab === 'files') loadArchiveFiles();
  } catch (e) {
    historyContainer.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(e.message)}</div>`;
  }
}

function applyArchiveTab() {
  document.querySelectorAll('#archiveTabs button[data-tab]').forEach(b => {
    b.classList.toggle('tab-active', b.dataset.tab === state.archiveTab);
  });
  const history = document.getElementById('archHistoryView');
  const files = document.getElementById('archFilesView');
  if (history) history.classList.toggle('hidden', state.archiveTab !== 'history');
  if (files) files.classList.toggle('hidden', state.archiveTab !== 'files');
}

function renderArchiveHistory(months) {
  const container = document.getElementById('archiveList');
  if (months.length === 0) {
    container.innerHTML = `<div class="card p-10 text-center text-zinc-500">${t('archive.empty')}</div>`;
    return;
  }
  container.innerHTML = months.map(m => `
    <div class="card p-5 mb-4">
      <div class="flex flex-wrap justify-between items-center gap-3 mb-4 pb-3 border-b border-purple-500/10">
        <div>
          <div class="text-xl font-bold mono">${escapeHtml(m.month)}</div>
          <div class="text-xs text-zinc-500">${m.employeesCount} ${t('archive.employees')} · ${m.paymentsCount} ${t('archive.payments')}</div>
        </div>
        <div class="flex gap-3 items-center">
          <span class="badge badge-on">${m.fullCount} ${t('archive.fullPaid')}</span>
          ${m.partialCount > 0 ? `<span class="badge badge-off">${m.partialCount} ${t('archive.partialPaid')}</span>` : ''}
          <div class="mono text-lg font-bold text-emerald-400">${formatMoney(m.totalAmount)}</div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr>
            <th>${t('emp.fullName')}</th>
            <th>${t('emp.code')}</th>
            <th class="text-right">${t('salary.earning')}</th>
            <th class="text-right">${t('salary.paid')}</th>
            <th class="text-right">${t('salary.remaining')}</th>
            <th class="text-right">Holat</th>
          </tr></thead>
          <tbody>
            ${m.employees.map(e => `
              <tr>
                <td>${escapeHtml(e.fullName)}</td>
                <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-300">${escapeHtml(e.code)}</span></td>
                <td class="text-right mono">${formatMoney(e.earned)}</td>
                <td class="text-right mono text-emerald-300">${formatMoney(e.paid)}</td>
                <td class="text-right mono ${e.remaining > 0 ? 'text-amber-400' : 'text-zinc-500'}">${formatMoney(e.remaining)}</td>
                <td class="text-right"><span class="badge ${e.status === 'full' ? 'badge-on' : 'badge-off'}">${e.status === 'full' ? t('archive.fullPaid') : t('archive.partialPaid')}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('');
}

const ARCHIVE_CAT_LABEL = {
  '': () => t('archive.allCategories'),
  employees: () => t('archive.catEmployees'),
  dailyReport: () => t('archive.catDaily'),
  monthlyReport: () => t('archive.catMonthly'),
  salary: () => t('archive.catSalary'),
};

function archiveCategoryLabel(c) {
  const fn = ARCHIVE_CAT_LABEL[c];
  return fn ? fn() : c;
}

function renderArchiveCategoryTabs(stats) {
  const tabs = document.getElementById('archCategoryTabs');
  if (!tabs) return;
  const counts = {
    employees: Number(stats.employeesCount) || 0,
    dailyReport: Number(stats.dailyCount) || 0,
    monthlyReport: Number(stats.monthlyCount) || 0,
    salary: Number(stats.salaryCount) || 0,
  };
  const total = counts.employees + counts.dailyReport + counts.monthlyReport + counts.salary;
  const items = [
    { key: '', label: t('archive.allCategories'), count: total },
    { key: 'employees', label: t('archive.catEmployees'), count: counts.employees },
    { key: 'dailyReport', label: t('archive.catDaily'), count: counts.dailyReport },
    { key: 'monthlyReport', label: t('archive.catMonthly'), count: counts.monthlyReport },
    { key: 'salary', label: t('archive.catSalary'), count: counts.salary },
  ];
  tabs.innerHTML = items.map(it => `
    <button class="tab-item ${state.archiveCategory === it.key ? 'tab-active' : ''}" data-cat="${escapeHtml(it.key)}">
      ${escapeHtml(it.label)} <span class="ml-1 text-xs opacity-70">(${it.count})</span>
    </button>`).join('');
  tabs.querySelectorAll('button[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.archiveCategory = btn.dataset.cat || '';
      tabs.querySelectorAll('button[data-cat]').forEach(b => b.classList.toggle('tab-active', b === btn));
      loadArchiveFiles();
    });
  });
}

async function loadArchiveFiles() {
  const container = document.getElementById('archFilesList');
  if (!container) return;
  container.innerHTML = '<div class="skeleton h-24"></div>';
  const params = new URLSearchParams();
  if (state.archiveCategory) params.set('category', state.archiveCategory);
  const from = document.getElementById('archFromDate')?.value;
  const to = document.getElementById('archToDate')?.value;
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  try {
    const data = await api(`/api/archive/files${params.toString() ? '?' + params : ''}`);
    const list = Array.isArray(data) ? data : (Array.isArray(data?.files) ? data.files : []);
    state.archiveFiles = list;
    renderArchiveFiles(list);
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(e.message)}</div>`;
  }
}

function formatSize(n) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function renderArchiveFiles(files) {
  const container = document.getElementById('archFilesList');
  if (!container) return;
  if (!files || files.length === 0) {
    container.innerHTML = `<div class="card p-10 text-center text-zinc-500">${t('archive.empty')}</div>`;
    return;
  }
  container.innerHTML = `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="data-table"><thead><tr>
      <th>${t('archive.fileGenerated')}</th>
      <th>${t('archive.fileCategory')}</th>
      <th>${t('archive.fileLang')}</th>
      <th class="text-right">${t('archive.fileSize')}</th>
      <th>${t('archive.fileRange')}</th>
      <th class="text-right">${t('common.actions')}</th>
    </tr></thead><tbody>
    ${files.map(f => {
      const range = (f.dateFrom || f.dateTo)
        ? `${f.dateFrom ? escapeHtml(formatDate(f.dateFrom)) : ''}${f.dateFrom && f.dateTo ? ' — ' : ''}${f.dateTo ? escapeHtml(formatDate(f.dateTo)) : ''}`
        : '—';
      const name = escapeHtml(f.displayName || f.fileName || 'export.xlsx');
      return `
      <tr>
        <td class="mono text-sm">${escapeHtml(formatDate(f.generatedAt) || '—')}</td>
        <td>${escapeHtml(archiveCategoryLabel(f.category))}</td>
        <td class="mono text-xs">${escapeHtml(f.language || '—')}</td>
        <td class="text-right mono text-xs text-zinc-400">${formatSize(f.fileSize)}</td>
        <td class="mono text-xs text-zinc-400">${range}</td>
        <td class="text-right whitespace-nowrap">
          <button class="btn-icon" data-act="arch-download" data-id="${escapeHtml(f._id)}" data-name="${name}" title="${t('archive.download')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="btn-icon danger ml-1" data-act="arch-delete" data-id="${escapeHtml(f._id)}" title="${t('archive.delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table></div></div>`;

  container.querySelectorAll('[data-act="arch-download"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await downloadExcel(`/api/archive/files/${btn.dataset.id}/download`, btn.dataset.name);
        toast(t('export.done'));
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
  container.querySelectorAll('[data-act="arch-delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openConfirm(t('archive.delete'), t('archive.confirmDelete'), async () => {
        try {
          await api(`/api/archive/files/${id}`, { method: 'DELETE' });
          toast(t('msg.deleted'));
          loadArchivePage();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  });
}

function setupArchivePage() {
  document.querySelectorAll('#archiveTabs button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.archiveTab = btn.dataset.tab;
      applyArchiveTab();
      if (state.archiveTab === 'files' && state.archiveFiles === null) loadArchiveFiles();
    });
  });
  document.getElementById('archFilterApplyBtn')?.addEventListener('click', loadArchiveFiles);
  document.getElementById('archFilterResetBtn')?.addEventListener('click', () => {
    const from = document.getElementById('archFromDate');
    const to = document.getElementById('archToDate');
    if (from) from.value = '';
    if (to) to.value = '';
    loadArchiveFiles();
  });
}

// ============================================
// MODALS
// ============================================
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('flex');
  document.body.style.overflow = 'hidden';
  if (window.applyTranslations) window.applyTranslations();
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('flex');
  document.body.style.overflow = '';
}
function setupModals() {
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.flex').forEach(m => closeModal(m.id)); });
}

function openConfirm(title, text, callback) {
  state.confirmCallback = callback;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  openModal('confirmModal');
}
function setupConfirm() {
  document.getElementById('confirmOkBtn').addEventListener('click', async () => {
    const cb = state.confirmCallback;
    state.confirmCallback = null;
    closeModal('confirmModal');
    if (typeof cb === 'function') await cb();
  });
}

// ============================================
// LANG / THEME / SIDEBAR
// ============================================
function setupLangSwitchers() {
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.setLang(btn.dataset.lang);
      updateLangActive();
      // Re-render current page
      if (state.business && state.currentPage) navigateTo(state.currentPage);
      // Update theme text
      setTheme(getTheme());
    });
  });
  updateLangActive();
}
function updateLangActive() {
  const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
  document.querySelectorAll('[data-lang]').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
}

function setupSidebar() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.remove('hidden');
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.add('hidden');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm(t('common.logoutConfirm'))) logout();
  });
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

// ============================================
// EXPORT BUTTONS
// ============================================
function setupExportButtons() {
  const empBtn = document.getElementById('empExportBtn');
  if (empBtn) {
    empBtn.addEventListener('click', async () => {
      const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
      try {
        await downloadExcel(`/api/employees/export?lang=${encodeURIComponent(lang)}`, 'xodimlar.xlsx');
        toast(t('export.done'));
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  const dailyBtn = document.getElementById('dailyExportBtn');
  if (dailyBtn) {
    dailyBtn.addEventListener('click', async () => {
      const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
      const date = state.dailyDate || document.getElementById('dailyDateInput')?.value || todayISO();
      try {
        await downloadExcel(`/api/daily-report/export?date=${encodeURIComponent(date)}&lang=${encodeURIComponent(lang)}`, `kunlik_${date}.xlsx`);
        toast(t('export.done'));
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  const monthlyBtn = document.getElementById('monthlyExportBtn');
  if (monthlyBtn) {
    monthlyBtn.addEventListener('click', async () => {
      const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
      const s = document.getElementById('monthStart')?.value || '';
      const e = document.getElementById('monthEnd')?.value || '';
      if (!s || !e) { toast(t('msg.error'), 'error'); return; }
      try {
        await downloadExcel(`/api/monthly-report/export?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&lang=${encodeURIComponent(lang)}`, `oylik_${s}_${e}.xlsx`);
        toast(t('export.done'));
      } catch (er) { toast(er.message, 'error'); }
    });
  }

  const salaryBtn = document.getElementById('salaryExportBtn');
  if (salaryBtn) {
    salaryBtn.addEventListener('click', async () => {
      const lang = window.getCurrentLang ? window.getCurrentLang() : 'uz-lat';
      const s = document.getElementById('salaryStart')?.value || '';
      const e = document.getElementById('salaryEnd')?.value || '';
      const filter = state.salaryFilter || 'all';
      const params = new URLSearchParams();
      params.set('filter', filter);
      params.set('lang', lang);
      if (s) params.set('startDate', s);
      if (e) params.set('endDate', e);
      try {
        await downloadExcel(`/api/salary/export?${params.toString()}`, `maosh_${filter}.xlsx`);
        toast(t('export.done'));
      } catch (er) { toast(er.message, 'error'); }
    });
  }
}

// ============================================
// INIT
// ============================================
async function initApp() {
  try {
    const me = await api('/api/auth/me');
    if (!me || me.role !== 'admin') { logout(); return; }
    state.user = me;
    state.business = me;
    applyBranding(me);
    buildSidebar(me.enabledModules || []);
    showApp();
    const first = (state.business.effectiveModules || [])[0];
    if (first) navigateTo(first);
  } catch (e) {
    logout();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme());
  setupLogin();
  setupSidebar();
  setupLangSwitchers();
  setupEmployeesPage();
  setupDirectionsPage();
  setupDailyReportPage();
  setupMonthlyReportPage();
  setupSalaryPage();
  setupArchivePage();
  setupExportButtons();
  setupModals();
  setupConfirm();
  if (window.applyTranslations) window.applyTranslations();

  if (state.token) initApp();
  else showLogin();
});
