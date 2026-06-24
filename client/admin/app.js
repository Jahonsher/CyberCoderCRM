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
  dailyDate: null,
  dailyData: null,

  monthlyData: null,
  salaryData: null,
  salaryDetail: null,
  archiveData: null,
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

  let directionsHtml = '';
  if (isOn) {
    directionsHtml = `<div class="card p-4 mb-6">
      <h3 class="font-bold mb-3">${t('daily.direction')}</h3>
      <div class="space-y-2">
        ${data.directions.map(d => `
          <div class="flex items-center justify-between gap-3 p-3 rounded-lg bg-purple-500/5">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">${escapeHtml(d.name)}</div>
            </div>
            <div class="text-right">
              <div class="mono text-sm font-bold text-purple-300">${formatMoney(d.price)} ${t('common.sum')}</div>
              <div class="text-[10px] text-zinc-500">/${t('common.day') || 'kun'}</div>
            </div>
          </div>`).join('')}
        ${data.directions.length === 0 ? `<p class="text-sm text-zinc-500 text-center py-3">${t('dir.empty')}</p>` : ''}
      </div>
    </div>`;
  }

  const statsHtml = `<div class="grid grid-cols-3 gap-3 mb-6">
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.assigned')}</div><div class="text-2xl font-bold">${data.stats.totalAssigned}</div></div>
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.unassigned')}</div><div class="text-2xl font-bold text-amber-400">${data.stats.totalUnassigned}</div></div>
    <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('daily.stats.earning')}</div><div class="text-2xl font-bold text-emerald-400">${formatMoney(data.stats.totalEarning)}</div></div>
  </div>`;

  const assignedHtml = data.assigned.length === 0
    ? `<p class="text-sm text-zinc-500 text-center py-6">${t('daily.empty')}</p>`
    : data.assigned.map(a => {
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

  const unassignedHtml = data.unassigned.length === 0
    ? `<p class="text-sm text-zinc-500 text-center py-6">—</p>`
    : data.unassigned.map(e => {
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

  container.innerHTML = statsHtml + directionsHtml + `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold mb-3 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
          ${t('daily.assigned')} (${data.stats.totalAssigned})
        </h3>
        ${assignedHtml}
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-3 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-amber-400"></div>
          ${t('daily.unassigned')} (${data.stats.totalUnassigned})
        </h3>
        ${unassignedHtml}
      </div>
    </div>`;

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
      <th class="text-right">${t('month.shifts')}</th>
      <th class="text-right">${t('month.days')}</th>
      <th class="text-right">${t('month.earning')}</th>
      <th class="text-right">${t('month.paid')}</th>
      <th class="text-right">${t('month.remaining')}</th>
    </tr></thead><tbody>
    ${data.employees.map(e => `
      <tr>
        <td class="font-medium">${escapeHtml(e.fullName)}</td>
        <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-300">${escapeHtml(e.code)}</span></td>
        <td class="text-right mono">${e.totalShifts}</td>
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
  const container = document.getElementById('salaryList');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-24"></div></div>';
  try {
    const data = await api('/api/salary');
    state.salaryData = data;
    document.getElementById('salStatEarned').textContent = formatMoney(data.stats.totalEarned);
    document.getElementById('salStatPaid').textContent = formatMoney(data.stats.totalPaid);
    document.getElementById('salStatRemaining').textContent = formatMoney(data.stats.totalRemaining);
    document.getElementById('salStatEmployees').textContent = data.stats.totalEmployees;
    renderSalaryList(data.employees);
  } catch (e) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(e.message)}</div>`;
  }
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

function renderSalaryDetail(data) {
  const e = data.employee;
  const s = data.stats;
  const container = document.getElementById('salaryDetailView');

  container.innerHTML = `
    <button class="btn-ghost px-4 py-2 rounded-xl text-sm mb-4" id="salBackBtn">← ${t('common.back')}</button>
    <div class="card p-6 mb-6">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold mb-2">${escapeHtml(e.fullName)}</h2>
          <div class="flex flex-wrap gap-3 text-sm text-zinc-400">
            <span class="mono text-purple-300">${escapeHtml(e.code)}</span>
            <span>${escapeHtml(e.departmentId?.name || '—')}</span>
            ${e.phone ? `<span class="mono">${escapeHtml(e.phone)}</span>` : ''}
          </div>
        </div>
        <button class="btn-primary px-5 py-2.5 rounded-xl text-sm" id="salPayBtn" ${s.remaining <= 0 ? 'disabled' : ''}>
          ${t('salary.payUntil')}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.assignments')}</div><div class="text-2xl font-bold">${s.totalDays}</div></div>
      <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('month.shifts')}</div><div class="text-2xl font-bold">${s.totalShifts}</div></div>
      <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.earning')}</div><div class="text-2xl font-bold text-emerald-400">${formatMoney(s.totalEarning)}</div></div>
      <div class="stat-card"><div class="mono text-[10px] text-zinc-500 uppercase mb-1">${t('salary.remaining')}</div><div class="text-2xl font-bold text-amber-400">${formatMoney(s.remaining)}</div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold mb-3">${t('salary.assignments')} (${data.assignments.length})</h3>
        ${data.assignments.length === 0 ? `<p class="text-sm text-zinc-500 text-center py-4">—</p>` : `
          <div class="space-y-2 max-h-96 overflow-y-auto">
            ${data.assignments.map(a => `
              <div class="flex justify-between gap-2 p-2 rounded-lg bg-purple-500/5 text-sm">
                <div>
                  <div class="font-medium">${formatDate(a.dateString)}</div>
                  <div class="text-xs text-zinc-500">${escapeHtml(a.departmentSnapshot?.name || '—')} · ${a.shift === 0.5 ? '½' : '1'}</div>
                </div>
                <div class="mono font-semibold text-emerald-400">${formatMoney(a.earning)}</div>
              </div>`).join('')}
          </div>`}
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-3">${t('salary.history')} (${data.payments.length})</h3>
        ${data.payments.length === 0 ? `<p class="text-sm text-zinc-500 text-center py-4">—</p>` : `
          <div class="space-y-2 max-h-96 overflow-y-auto">
            ${data.payments.map(p => `
              <div class="flex justify-between gap-2 p-2 rounded-lg bg-emerald-500/5 text-sm">
                <div>
                  <div class="font-medium">${formatDate(p.untilDate)} gacha</div>
                  <div class="text-xs text-zinc-500">${formatDate(p.paidAt)}</div>
                </div>
                <div class="mono font-semibold text-emerald-400">${formatMoney(p.amount)}</div>
              </div>`).join('')}
          </div>`}
      </div>
    </div>`;

  document.getElementById('salBackBtn').addEventListener('click', loadSalaryPage);
  const payBtn = document.getElementById('salPayBtn');
  if (payBtn) payBtn.addEventListener('click', () => openPayModal(e._id, e.fullName));
}

function openPayModal(employeeId, name) {
  document.getElementById('payEmployeeId').value = employeeId;
  document.getElementById('payEmployeeName').textContent = name;
  document.getElementById('payUntilDate').value = todayISO();
  document.getElementById('payUntilDate').max = todayISO();
  openModal('payModal');
}

function setupSalaryPage() {
  document.getElementById('payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('payEmployeeId').value;
    const untilDate = document.getElementById('payUntilDate').value;
    try {
      await api(`/api/salary/${id}/pay`, { method: 'POST', body: JSON.stringify({ untilDate }) });
      toast(t('msg.saved'));
      closeModal('payModal');
      loadSalaryDetail(id);
    } catch (e2) { toast(e2.message, 'error'); }
  });
}

// ============================================
// ARCHIVE
// ============================================
async function loadArchivePage() {
  const container = document.getElementById('archiveList');
  container.innerHTML = '<div class="skeleton h-24"></div>';
  try {
    const data = await api('/api/archive');
    state.archiveData = data;
    document.getElementById('archStatAmount').textContent = formatMoney(data.stats.totalAmount);
    document.getElementById('archStatPayments').textContent = data.stats.totalPayments;
    document.getElementById('archStatMonths').textContent = data.stats.monthsCount;
    renderArchive(data.months);
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(e.message)}</div>`;
  }
}

function renderArchive(months) {
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
  setupModals();
  setupConfirm();
  if (window.applyTranslations) window.applyTranslations();

  if (state.token) initApp();
  else showLogin();
});
