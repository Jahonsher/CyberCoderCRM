/**
 * CyberCoderCRM - Admin Application (SPA)
 * YANGI: 2 ta alohida yo'nalish sahifasi (directionsPiecework, directionsDaily)
 * Har biri o'z bo'limlari, yo'nalishlari va ADD modal ga ega
 */

const API_BASE = window.API_BASE || '';

function apiUrl(path) {
  if (!API_BASE) return path;
  return API_BASE.replace(/\/$/, '') + path;
}

const STORAGE = {
  token: 'cc_admin_token',
  user: 'cc_admin_user',
};

const MODULE_ICONS = {
  employees: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  directionsPiecework: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  directionsDaily: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  dailyReport: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  monthlyReport: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>`,
  archive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

const state = {
  token: localStorage.getItem(STORAGE.token) || null,
  user: null,
  business: null,
  currentPage: null,
  confirmCallback: null,

  employees: [],

  // YANGI: 2 ta alohida sahifa state'i
  departments_pw: [],
  directions_pw: [],
  selectedDepartmentId_pw: null,

  departments_d: [],
  directions_d: [],
  selectedDepartmentId_d: null,

  // Modal context - qaysi turdan ochilgan
  dirModalType: 'piecework',
  deptModalType: 'piecework',

  dailyData: null,
  dailyDate: null,
  monthData: null,
  monthlyData: null,
  monthSelected: new Set(),
  monthSelectedDays: new Set(),
  archives: [],

  _assignDirections: [],

  editingEmpId: null,
  editingDirId: null,
  editingDeptId: null,
  editingProductId: null,
};

// ============================================
// UTILS
// ============================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatMoney(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  return amount.toLocaleString('uz-UZ');
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (opts.withTime) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${h}:${m}`;
  }
  return `${day}.${month}.${year}`;
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

async function api(endpoint, options = {}) {
  const url = apiUrl(endpoint);
  const headers = {
    Authorization: `Bearer ${state.token}`,
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout();
      return null;
    }
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API [${endpoint}]:`, err);
    throw err;
  }
}

function t(key) {
  if (window.TRANSLATIONS) {
    const lang = localStorage.getItem('cc_lang') || 'uz-lat';
    const dict = window.TRANSLATIONS[lang] || window.TRANSLATIONS['uz-lat'];
    return (dict && dict[key]) || key;
  }
  return key;
}

// ============================================
// THEME
// ============================================

const THEME_KEY = 'cc_theme';

function getCurrentTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton();
}
function toggleTheme() { setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark'); }
function updateThemeButton() {
  const theme = getCurrentTheme();
  const iconDark = document.getElementById('themeIconDark');
  const iconLight = document.getElementById('themeIconLight');
  const text = document.getElementById('themeText');
  if (!iconDark || !iconLight || !text) return;
  if (theme === 'dark') {
    iconDark.classList.remove('hidden');
    iconLight.classList.add('hidden');
    text.textContent = t('theme.light');
  } else {
    iconDark.classList.add('hidden');
    iconLight.classList.remove('hidden');
    text.textContent = t('theme.dark');
  }
}
function setupThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  setTheme(getCurrentTheme());
}

// ============================================
// VIEW SWITCHER & LANG
// ============================================

function showLogin() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}
function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
}

function setupLangSwitchers() {
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (typeof window.setLang === 'function') window.setLang(lang);
      updateLangButtonsActive();
      updateThemeButton();

      if (state.business && state.business.enabledModules) {
        buildSidebar(state.business.enabledModules, state.business.modulesInfo || []);
        if (state.currentPage) {
          document.querySelectorAll('[data-page]').forEach(el => {
            el.classList.toggle('active', el.dataset.page === state.currentPage);
          });
        }
      }
      if (state.currentPage) navigateTo(state.currentPage);
      else applyStaticTranslations();
    });
  });
  updateLangButtonsActive();
}
function updateLangButtonsActive() {
  const currentLang = (typeof window.getCurrentLang === 'function') ? window.getCurrentLang() : 'uz-lat';
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}
function applyStaticTranslations() {
  if (typeof window.applyTranslations === 'function') window.applyTranslations();
}

// ============================================
// LOGIN
// ============================================

function setupLogin() {
  const togglePw = document.getElementById('togglePassword');
  const pwInput = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');

  togglePw.addEventListener('click', () => {
    const isPassword = pwInput.type === 'password';
    pwInput.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword
      ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-7-10-7a18.45 18.45 0 015.16-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/>'
      : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
  });

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');
  const card = document.getElementById('loginCard');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    errorEl.classList.add('hidden');

    if (!username || !password) {
      errorEl.textContent = t('msg.error');
      errorEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btnText.textContent = t('login.signingIn');
    spinner.classList.remove('hidden');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('msg.loginWrong'));
      if (data.user.role !== 'admin') throw new Error('SuperAdmin: /superadmin/');

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE.token, data.token);
      localStorage.setItem(STORAGE.user, JSON.stringify(data.user));

      if (data.user.defaultLanguage && typeof window.setLang === 'function') {
        const savedLang = localStorage.getItem('cc_lang');
        if (!savedLang) window.setLang(data.user.defaultLanguage);
      }

      btnText.textContent = t('login.welcome');
      spinner.classList.add('hidden');
      setTimeout(() => initApp(), 300);
    } catch (err) {
      errorEl.textContent = err.message || t('msg.error');
      errorEl.classList.remove('hidden');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
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
// WHITE LABEL
// ============================================

function applyBranding(business) {
  document.title = `${business.name} · CyberCoderCRM`;
  const logoEl = document.getElementById('businessLogo');
  const firstLetter = (business.name || '?').charAt(0).toUpperCase();
  if (business.logo) {
    const logoUrl = apiUrl(`/uploads/${business.logo}`);
    logoEl.innerHTML = `<img src="${logoUrl}" alt="${escapeHtml(business.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'logo-placeholder w-full h-full\\'>${firstLetter}</div>'" />`;
  } else {
    logoEl.innerHTML = `<div class="logo-placeholder w-full h-full">${firstLetter}</div>`;
  }
  document.getElementById('businessName').textContent = business.name;
}

// ============================================
// SIDEBAR
// ============================================

function buildSidebar(enabledModules, modulesInfo) {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = `<div class="mono text-[10px] text-zinc-500 px-3 mb-2 uppercase tracking-widest">${t('nav.modules')}</div>`;

  const order = ['employees', 'directionsPiecework', 'directionsDaily', 'dailyReport', 'monthlyReport', 'archive'];

  // Backward compat: eski 'directions' yoqilgan bo'lsa, ikkalasini ham qo'shamiz
  let effectiveModules = [...enabledModules];
  if (enabledModules.includes('directions') && !enabledModules.includes('directionsPiecework') && !enabledModules.includes('directionsDaily')) {
    effectiveModules = effectiveModules.filter(m => m !== 'directions');
    effectiveModules.push('directionsPiecework', 'directionsDaily');
  }

  const sortedKeys = order.filter(k => effectiveModules.includes(k));

  const items = sortedKeys.map(key => {
    const icon = MODULE_ICONS[key] || MODULE_ICONS.employees;
    const label = t(`nav.${key}`);
    return `<a href="#" class="nav-item" data-page="${key}">${icon}<span>${label}</span></a>`;
  }).join('');

  nav.insertAdjacentHTML('beforeend', items);
  nav.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  state.business.effectiveModules = sortedKeys;
}

// ============================================
// ROUTER
// ============================================

function navigateTo(pageKey) {
  const effective = state.business?.effectiveModules || state.business?.enabledModules || [];
  if (!effective.includes(pageKey)) {
    const firstPage = effective[0];
    if (firstPage) pageKey = firstPage;
    else return;
  }

  state.currentPage = pageKey;

  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageKey);
  });

  document.getElementById('pageTitle').textContent = t(`nav.${pageKey}`);
  document.getElementById('pageSubtitle').textContent = '';
  document.getElementById('headerActions').innerHTML = '';

  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.dataset.page === pageKey);
  });

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.add('hidden');

  applyStaticTranslations();

  switch (pageKey) {
    case 'employees': loadEmployees(); break;
    case 'directionsPiecework': loadDepartmentsForType('piecework'); break;
    case 'directionsDaily': loadDepartmentsForType('daily'); break;
    case 'dailyReport':
      if (!state.dailyDate) state.dailyDate = todayISO();
      loadDailyReport(state.dailyDate);
      break;
    case 'monthlyReport': initMonthlyReport(); break;
    case 'archive': loadArchive(); break;
  }
}

// ============================================
// EMPLOYEES
// ============================================

async function loadEmployees() {
  const container = document.getElementById('empTableContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';
  try {
    const search = document.getElementById('empSearch').value.trim();
    const url = search ? `/api/employees?search=${encodeURIComponent(search)}` : '/api/employees';
    const employees = await api(url);
    if (!employees) return;
    state.employees = employees;
    renderEmployees(employees);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderEmployees(employees) {
  const container = document.getElementById('empTableContainer');
  if (employees.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
        </div>
        <h3 class="font-bold mb-1">${t('emp.empty')}</h3>
        <p class="text-sm text-zinc-500">${t('emp.emptyHint')}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('emp.table.name')}</th>
            <th>${t('emp.table.code')}</th>
            <th>${t('emp.table.phone')}</th>
            <th class="text-right">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(e => `
            <tr>
              <td class="font-medium">${escapeHtml(e.firstName)}</td>
              <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
              <td class="mono text-sm text-zinc-400">${escapeHtml(e.phone || '—')}</td>
              <td class="text-right whitespace-nowrap">
                <button type="button" data-act="emp-edit" data-id="${e._id}" class="btn-icon" title="${t('common.edit')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button type="button" data-act="emp-delete" data-id="${e._id}" data-name="${escapeHtml(e.firstName)}" class="btn-icon danger ml-1" title="${t('common.delete')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                  </svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.act;
      const id = btn.dataset.id;
      if (action === 'emp-edit') openEmpEdit(id);
      else if (action === 'emp-delete') confirmDeleteEmployee(id, btn.dataset.name);
    });
  });
}

function setupEmployeesPage() {
  let searchTimer;
  document.getElementById('empSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadEmployees(), 300);
  });

  document.getElementById('empAddBtn').addEventListener('click', () => {
    state.editingEmpId = null;
    document.getElementById('empForm').reset();
    document.getElementById('empEditingId').value = '';
    document.getElementById('empModalTitle').textContent = t('emp.add');
    openModal('empModal');
  });

  document.getElementById('empForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('empSubmitBtn');
    const spinner = document.getElementById('empSubmitSpinner');
    const body = {
      firstName: document.getElementById('empFirstName').value.trim(),
      lastName: document.getElementById('empLastName').value.trim() || '-',
      code: document.getElementById('empCode').value.trim(),
      phone: document.getElementById('empPhone').value.trim(),
    };
    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      if (state.editingEmpId) {
        await api(`/api/employees/${state.editingEmpId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/employees', { method: 'POST', body: JSON.stringify(body) });
      }
      toast(t('msg.saved'), 'success');
      closeModal('empModal');
      loadEmployees();
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function openEmpEdit(id) {
  const emp = state.employees.find(e => e._id === id);
  if (!emp) return;
  state.editingEmpId = id;
  document.getElementById('empEditingId').value = id;
  document.getElementById('empModalTitle').textContent = t('emp.edit');
  document.getElementById('empFirstName').value = emp.firstName || '';
  document.getElementById('empLastName').value = emp.lastName || '-';
  document.getElementById('empCode').value = emp.code || '';
  document.getElementById('empPhone').value = emp.phone || '';
  openModal('empModal');
}

function confirmDeleteEmployee(id, name) {
  openConfirm(t('emp.deleteConfirm'), `"${name}" — ${t('emp.deleteWarn')}`, async () => {
    try {
      await api(`/api/employees/${id}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadEmployees();
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

// ============================================
// DEPARTMENTS + DIRECTIONS - YANGI (har tur uchun alohida)
// ============================================

function suffixForType(type) {
  return type === 'daily' ? '_d' : '_pw';
}

async function loadDepartmentsForType(type) {
  const suffix = suffixForType(type);
  const container = document.getElementById('departmentsContainer' + suffix);
  container.innerHTML = '<div class="skeleton h-24"></div>';

  try {
    const departments = await api('/api/departments');
    if (!departments) return;
    state[`departments${suffix}`] = departments;
    renderDepartments(type);

    const selectedKey = `selectedDepartmentId${suffix}`;
    if (departments.length > 0 && !state[selectedKey]) {
      selectDepartment(type, departments[0]._id);
    } else if (state[selectedKey]) {
      selectDepartment(type, state[selectedKey]);
    }
  } catch (err) {
    container.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(err.message)}</div>`;
  }
}

function renderDepartments(type) {
  const suffix = suffixForType(type);
  const departments = state[`departments${suffix}`] || [];
  const selectedKey = `selectedDepartmentId${suffix}`;
  const container = document.getElementById('departmentsContainer' + suffix);

  if (departments.length === 0) {
    container.innerHTML = `
      <div class="card p-8 text-center">
        <div class="inline-flex w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h3 class="font-bold mb-1">${t('dept.empty')}</h3>
        <p class="text-sm text-zinc-500">${t('dept.emptyHint')}</p>
      </div>
    `;
    const sectionEl = document.getElementById('directionsSection' + suffix);
    if (sectionEl) sectionEl.classList.add('hidden');
    return;
  }

  const selectedId = state[selectedKey];
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${departments.map(d => `
        <div class="dept-card ${selectedId === d._id ? 'selected' : ''}" data-dept-id="${d._id}">
          <div class="dept-card-actions">
            <button type="button" data-act="dept-edit" data-id="${d._id}" class="btn-icon" title="${t('common.edit')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button" data-act="dept-delete" data-id="${d._id}" data-name="${escapeHtml(d.name)}" class="btn-icon danger" title="${t('common.delete')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
              </svg>
            </button>
          </div>
          <div class="font-bold text-base pr-16 truncate">${escapeHtml(d.name)}</div>
          <div class="mono text-xs text-zinc-500 mt-1">${d.directionCount || 0} ${t('dept.directionCount')}</div>
          ${d.description ? `<div class="text-xs text-zinc-500 mt-2 line-clamp-2">${escapeHtml(d.description)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.dept-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      selectDepartment(type, card.dataset.deptId);
    });
  });

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (act === 'dept-edit') openDeptEdit(type, id);
      else if (act === 'dept-delete') confirmDeleteDept(type, id, btn.dataset.name);
    });
  });
}

function selectDepartment(type, deptId) {
  const suffix = suffixForType(type);
  state[`selectedDepartmentId${suffix}`] = deptId;
  const departments = state[`departments${suffix}`] || [];
  const dept = departments.find(d => d._id === deptId);

  document.querySelectorAll(`#departmentsContainer${suffix} .dept-card`).forEach(c => {
    c.classList.toggle('selected', c.dataset.deptId === deptId);
  });

  if (dept) {
    const nameEl = document.getElementById('currentDeptName' + suffix);
    const hintEl = document.getElementById('currentDeptHint' + suffix);
    if (nameEl) nameEl.textContent = dept.name;
    if (hintEl) hintEl.textContent = `${dept.directionCount || 0} ${t('dept.directionCount')}`;
  }

  loadDirections(type, deptId);
}

async function loadDirections(type, departmentId) {
  const suffix = suffixForType(type);
  const container = document.getElementById('dirTableContainer' + suffix);
  const dirSection = document.getElementById('directionsSection' + suffix);

  if (!departmentId) {
    if (dirSection) dirSection.classList.add('hidden');
    return;
  }

  if (dirSection) dirSection.classList.remove('hidden');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';

  try {
    const directions = await api(`/api/directions?type=${type}&departmentId=${departmentId}`);
    if (!directions) return;
    state[`directions${suffix}`] = directions;
    renderDirections(type, directions);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderDirections(type, directions) {
  const suffix = suffixForType(type);
  const container = document.getElementById('dirTableContainer' + suffix);
  const selectedKey = `selectedDepartmentId${suffix}`;

  if (!state[selectedKey]) {
    container.innerHTML = `<div class="p-10 text-center text-zinc-500"><p class="text-sm">${t('dir.selectDept')}</p></div>`;
    return;
  }

  if (directions.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        </div>
        <h3 class="font-bold mb-1">${t('dir.empty')}</h3>
        <p class="text-sm text-zinc-500">${t('dir.emptyHint')}</p>
      </div>
    `;
    return;
  }

  const priceLabel = type === 'daily' ? t('dir.dailyPriceShort') : t('dir.pieceworkPriceShort');
  const priceColor = type === 'daily' ? '#34d399' : '#a78bfa';
  const priceBg = type === 'daily' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)';
  const priceBorder = type === 'daily' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.25)';

  container.innerHTML = `
    <div class="p-5 space-y-3">
      ${directions.map(d => {
        const price = d.price || d.currentPrice || 0;
        return `
          <div class="card p-4 flex items-center justify-between gap-3 flex-wrap" style="background: rgba(139, 92, 246, 0.04);">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-base truncate">${escapeHtml(d.name)}</div>
              <div class="flex gap-2 mt-2 flex-wrap">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: ${priceBg}; border: 1px solid ${priceBorder};">
                  <span class="text-xs font-medium" style="color: ${priceColor};">${priceLabel}</span>
                  <span class="mono text-xs font-bold" style="color: ${priceColor};">${formatMoney(price)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" data-act="dir-edit" data-id="${d._id}" class="btn-icon" title="${t('common.edit')}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button type="button" data-act="dir-delete" data-id="${d._id}" data-name="${escapeHtml(d.name)}" class="btn-icon danger">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.act;
      const id = btn.dataset.id;
      if (action === 'dir-edit') openDirEdit(type, id);
      else if (action === 'dir-delete') confirmDeleteDirection(type, id, btn.dataset.name);
    });
  });
}

function openDeptAddModal(type) {
  state.deptModalType = type;
  state.editingDeptId = null;
  document.getElementById('deptForm').reset();
  document.getElementById('deptEditingId').value = '';
  document.getElementById('deptModalTitle').textContent = t('dept.add');
  openModal('deptModal');
}

function openDeptEdit(type, id) {
  state.deptModalType = type;
  const suffix = suffixForType(type);
  const dept = (state[`departments${suffix}`] || []).find(d => d._id === id);
  if (!dept) return;
  state.editingDeptId = id;
  document.getElementById('deptEditingId').value = id;
  document.getElementById('deptModalTitle').textContent = t('dept.edit');
  document.getElementById('deptName').value = dept.name || '';
  document.getElementById('deptDescription').value = dept.description || '';
  openModal('deptModal');
}

function confirmDeleteDept(type, id, name) {
  const suffix = suffixForType(type);
  const dept = (state[`departments${suffix}`] || []).find(d => d._id === id);
  const hasDirections = dept && dept.directionCount > 0;
  openConfirm(
    t('dept.deleteConfirm'),
    `"${name}"${hasDirections ? ` (${dept.directionCount} ${t('dept.directionCount')})` : ''} — ${t('dept.deleteWarn')}`,
    async () => {
      try {
        const url = hasDirections ? `/api/departments/${id}?force=true` : `/api/departments/${id}`;
        await api(url, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        const selectedKey = `selectedDepartmentId${suffix}`;
        if (state[selectedKey] === id) state[selectedKey] = null;
        loadDepartmentsForType(type);
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

function openDirAddModal(type) {
  state.dirModalType = type;
  const suffix = suffixForType(type);
  const selectedDeptId = state[`selectedDepartmentId${suffix}`];

  if (!selectedDeptId) {
    toast(t('dept.selectFirst'), 'error');
    return;
  }

  state.editingDirId = null;
  document.getElementById('dirForm').reset();
  document.getElementById('dirEditingId').value = '';
  document.getElementById('dirType').value = type;
  document.getElementById('dirModalTitle').textContent = t('dir.add');

  applyDirModalTypeStyles(type);
  fillDepartmentSelect('dirDepartment', selectedDeptId, type);

  openModal('dirModal');
}

function openDirEdit(type, id) {
  state.dirModalType = type;
  const suffix = suffixForType(type);
  const dir = (state[`directions${suffix}`] || []).find(d => d._id === id);
  if (!dir) return;
  state.editingDirId = id;
  document.getElementById('dirEditingId').value = id;
  document.getElementById('dirType').value = type;
  document.getElementById('dirModalTitle').textContent = t('dir.edit');
  document.getElementById('dirName').value = dir.name || '';
  document.getElementById('dirPrice').value = dir.price || dir.currentPrice || 0;

  applyDirModalTypeStyles(type);
  const deptId = dir.departmentId?._id || dir.departmentId || state[`selectedDepartmentId${suffix}`];
  fillDepartmentSelect('dirDepartment', deptId, type);

  openModal('dirModal');
}

function applyDirModalTypeStyles(type) {
  const badge = document.getElementById('dirTypeBadge');
  const badgeText = document.getElementById('dirTypeBadgeText');
  const priceLabel = document.getElementById('dirPriceLabel');
  const priceHint = document.getElementById('dirPriceHint');
  const priceInput = document.getElementById('dirPrice');

  if (type === 'daily') {
    if (badge) {
      badge.style.background = 'rgba(16, 185, 129, 0.12)';
      badge.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      badge.style.color = '#34d399';
    }
    if (badgeText) badgeText.textContent = t('nav.directionsDaily');
    if (priceLabel) priceLabel.textContent = t('dir.dailyPriceLong');
    if (priceHint) priceHint.textContent = t('dir.dailyHint');
    if (priceInput) priceInput.placeholder = '120000';
  } else {
    if (badge) {
      badge.style.background = 'rgba(139, 92, 246, 0.12)';
      badge.style.border = '1px solid rgba(139, 92, 246, 0.4)';
      badge.style.color = '#a78bfa';
    }
    if (badgeText) badgeText.textContent = t('nav.directionsPiecework');
    if (priceLabel) priceLabel.textContent = t('dir.pieceworkPriceLong');
    if (priceHint) priceHint.textContent = t('dir.pieceworkHint');
    if (priceInput) priceInput.placeholder = '250';
  }
}

function fillDepartmentSelect(selectId, selectedId, type) {
  const suffix = suffixForType(type);
  const departments = state[`departments${suffix}`] || [];
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">—</option>' +
    departments.map(d =>
      `<option value="${d._id}" ${selectedId === d._id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`
    ).join('');
}

function confirmDeleteDirection(type, id, name) {
  openConfirm(t('dir.deleteConfirm'), `"${name}" — ${t('dir.deleteWarn')}`, async () => {
    try {
      await api(`/api/directions/${id}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      const suffix = suffixForType(type);
      const deptId = state[`selectedDepartmentId${suffix}`];
      if (deptId) loadDirections(type, deptId);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

function setupDirectionsPiecework() {
  document.getElementById('deptAddBtn_pw').addEventListener('click', () => openDeptAddModal('piecework'));
  document.getElementById('dirAddBtn_pw').addEventListener('click', () => openDirAddModal('piecework'));
}

function setupDirectionsDaily() {
  document.getElementById('deptAddBtn_d').addEventListener('click', () => openDeptAddModal('daily'));
  document.getElementById('dirAddBtn_d').addEventListener('click', () => openDirAddModal('daily'));
}

function setupDirectionForms() {
  // Department form (umumiy)
  document.getElementById('deptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('deptSubmitBtn');
    const spinner = document.getElementById('deptSubmitSpinner');
    const body = {
      name: document.getElementById('deptName').value.trim(),
      description: document.getElementById('deptDescription').value.trim(),
    };
    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      if (state.editingDeptId) {
        await api(`/api/departments/${state.editingDeptId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/departments', { method: 'POST', body: JSON.stringify(body) });
      }
      toast(t('msg.saved'), 'success');
      closeModal('deptModal');
      loadDepartmentsForType(state.deptModalType);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // Direction form
  document.getElementById('dirForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('dirSubmitBtn');
    const spinner = document.getElementById('dirSubmitSpinner');
    const type = document.getElementById('dirType').value || 'piecework';

    const body = {
      name: document.getElementById('dirName').value.trim(),
      departmentId: document.getElementById('dirDepartment').value,
      type,
      price: Number(document.getElementById('dirPrice').value || 0),
    };

    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      if (state.editingDirId) {
        await api(`/api/directions/${state.editingDirId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/directions', { method: 'POST', body: JSON.stringify(body) });
      }
      toast(t('msg.saved'), 'success');
      closeModal('dirModal');
      const suffix = suffixForType(type);
      const deptId = state[`selectedDepartmentId${suffix}`];
      if (deptId) loadDirections(type, deptId);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

// ============================================
// DAILY REPORT
// ============================================

async function loadDailyReport(dateStr) {
  const url = dateStr ? `/api/daily-report?date=${dateStr}` : '/api/daily-report';
  try {
    const data = await api(url);
    if (!data) return;
    state.dailyData = data;
    if (data.dateStr) state.dailyDate = data.dateStr;
    renderDailyReport(data);
    updateDailyDateInput();
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

function updateDailyDateInput() {
  const input = document.getElementById('dailyDateInput');
  const label = document.getElementById('dailyDateLabel');
  if (!input || !state.dailyDate) return;
  input.value = state.dailyDate;
  if (label) {
    const d = new Date(state.dailyDate);
    label.textContent = formatDate(d);
  }
}

function renderDailyReport(data) {
  document.getElementById('dailyStatAssigned').textContent = data.stats.totalAssigned;
  document.getElementById('dailyStatUnassigned').textContent = data.stats.totalUnassigned;
  document.getElementById('dailyStatEarning').textContent = formatMoney(data.stats.totalEarning);
  document.getElementById('dailyStatProducts').textContent = data.stats.totalProducts;

  const assignedEl = document.getElementById('assignedList');
  if (data.assigned.length === 0) {
    assignedEl.innerHTML = '<div class="text-center text-zinc-500 text-sm py-8">' + t('daily.emptyAssigned') + '</div>';
  } else {
    assignedEl.innerHTML = '<div class="space-y-2">' + data.assigned.map(function(a) {
      var bonus = a.bonus || 0;
      var isManual = a.isManual;
      var manualAmount = a.manualAmount;
      var fairShare = a.fairShare || 0;
      var isDaily = a.type === 'daily';
      var deficit = (!isDaily && isManual && manualAmount !== null && manualAmount < fairShare) ? fairShare - manualAmount : 0;
      var lastName = (a.employeeSnapshot.lastName && a.employeeSnapshot.lastName !== '-') ? ' ' + escapeHtml(a.employeeSnapshot.lastName) : '';
      var dailyTag = isDaily ? '<span class="daily-badge">KUNLIK</span>' : '';
      var bonusHtml = (!isDaily && bonus > 0) ? '<div class="bonus-badge mt-1">+' + formatMoney(bonus) + '</div>' : '';
      var deficitHtml = (!isDaily && deficit > 0) ? '<div class="deficit-badge mt-1">\u2212' + formatMoney(deficit) + '</div>' : '';
      var bgClass = isDaily ? 'bg-emerald-500/5 border border-emerald-500/15' : 'bg-purple-500/5 border border-purple-500/10';
      var codeClass = isDaily ? 'text-emerald-300' : 'text-purple-300';
      var shiftStr = a.shift === 0.5 ? '\u00bd' : '1';

      return '<div class="flex items-center justify-between gap-3 p-3 rounded-xl ' + bgClass + '">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="font-medium text-sm truncate flex items-center gap-2">' +
            escapeHtml(a.employeeSnapshot.firstName) + lastName + dailyTag +
          '</div>' +
          '<div class="mono text-xs text-zinc-500 mt-0.5 truncate">' +
            '<span class="' + codeClass + '">' + escapeHtml(a.employeeSnapshot.code) + '</span>' +
            ' \u00b7 ' + escapeHtml(a.directionSnapshot.name) +
            ' \u00b7 ' + shiftStr +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-1 shrink-0">' +
          '<div class="text-right mr-1">' +
            '<div class="mono text-sm font-semibold text-emerald-400">' + formatMoney(a.earning) + '</div>' +
            bonusHtml + deficitHtml +
          '</div>' +
          '<button type="button" data-act="edit-earning" data-id="' + a._id + '" class="btn-icon" title="' + t('daily.editEarning') + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button type="button" data-act="unassign" data-id="' + a._id + '" class="btn-icon danger">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    assignedEl.querySelectorAll('[data-act="unassign"]').forEach(function(btn) {
      btn.addEventListener('click', function() { unassignEmployee(btn.dataset.id); });
    });
    assignedEl.querySelectorAll('[data-act="edit-earning"]').forEach(function(btn) {
      btn.addEventListener('click', function() { openEarningEditModal(btn.dataset.id); });
    });
  }

  var unassignedEl = document.getElementById('unassignedList');
  if (data.unassigned.length === 0) {
    unassignedEl.innerHTML = '<div class="text-center text-zinc-500 text-sm py-8">' + t('daily.emptyUnassigned') + '</div>';
  } else {
    unassignedEl.innerHTML = '<div class="space-y-2">' + data.unassigned.map(function(e) {
      return '<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="font-medium text-sm truncate">' + escapeHtml(e.firstName) + ' ' + escapeHtml(e.lastName) + '</div>' +
          '<div class="mono text-xs text-amber-300/70 mt-0.5 truncate">' + escapeHtml(e.code) + '</div>' +
        '</div>' +
        '<button type="button" data-act="assign" data-id="' + e._id + '" data-name="' + escapeHtml(e.firstName + ' ' + e.lastName) + '" class="btn-ghost px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">' + t('daily.assign') + '</button>' +
      '</div>';
    }).join('') + '</div>';

    unassignedEl.querySelectorAll('[data-act="assign"]').forEach(function(btn) {
      btn.addEventListener('click', function() { openAssignModal(btn.dataset.id, btn.dataset.name); });
    });
  }

  renderProducts(data.products);
}

function renderProducts(products) {
  var container = document.getElementById('productsContainer');
  if (products.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-zinc-500 text-sm">' + t('common.emptyData') + '</div>';
    return;
  }
  container.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>' + t('daily.productName') + '</th>' +
    '<th>' + t('daily.quantity') + '</th>' +
    '<th class="text-right">' + t('common.actions') + '</th>' +
    '</tr></thead><tbody>' +
    products.map(function(p) {
      return '<tr><td class="font-medium">' + escapeHtml(p.productName) + '</td>' +
        '<td class="mono text-purple-300">' + formatMoney(p.quantity) + '</td>' +
        '<td class="text-right whitespace-nowrap">' +
          '<button type="button" data-act="product-edit" data-id="' + p._id + '" class="btn-icon">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button type="button" data-act="product-delete" data-id="' + p._id + '" class="btn-icon danger ml-1">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>' +
          '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';

  container.querySelectorAll('[data-act]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var act = btn.dataset.act;
      var id = btn.dataset.id;
      if (act === 'product-edit') openProductEdit(id);
      else if (act === 'product-delete') confirmDeleteProduct(id);
    });
  });
}

async function unassignEmployee(assignmentId) {
  try {
    await api('/api/daily-report/assign/' + assignmentId, { method: 'DELETE' });
    toast(t('msg.deleted'), 'success');
    loadDailyReport(state.dailyDate);
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

async function openAssignModal(employeeId, employeeName) {
  document.getElementById('assignEmployeeId').value = employeeId;
  document.getElementById('assignEmployeeName').textContent = employeeName;

  var effective = (state.business && state.business.effectiveModules) || [];
  var hasPiecework = effective.indexOf('directionsPiecework') !== -1;
  var hasDaily = effective.indexOf('directionsDaily') !== -1;

  var pwLabel = document.getElementById('assignWorkTypePwLabel');
  var dLabel = document.getElementById('assignWorkTypeDLabel');
  var pwRadio = document.querySelector('input[name="workType"][value="piecework"]');
  var dRadio = document.querySelector('input[name="workType"][value="daily"]');

  if (pwLabel) pwLabel.style.display = hasPiecework ? '' : 'none';
  if (dLabel) dLabel.style.display = hasDaily ? '' : 'none';

  if (hasPiecework) {
    if (pwRadio) pwRadio.checked = true;
  } else if (hasDaily) {
    if (dRadio) dRadio.checked = true;
  } else {
    toast("Hech qanday ish turi yoqilmagan", 'error');
    return;
  }

  var sh1 = document.querySelector('input[name="shift"][value="1"]');
  if (sh1) sh1.checked = true;

  await loadDirectionsForAssign();
  openModal('assignModal');
}

async function loadDirectionsForAssign() {
  var radio = document.querySelector('input[name="workType"]:checked');
  var type = radio ? radio.value : 'piecework';
  try {
    var directions = await api('/api/directions?type=' + type);
    if (!directions) return;
    state._assignDirections = directions;

    var deptMap = {};
    directions.forEach(function(d) {
      var dept = d.departmentId;
      if (dept && dept._id) deptMap[dept._id] = dept.name;
    });

    var deptSelect = document.getElementById('assignDepartment');
    var depts = Object.keys(deptMap).map(function(id) { return { id: id, name: deptMap[id] }; });

    if (depts.length === 0) {
      deptSelect.innerHTML = '<option value="">' + (type === 'daily' ? "Kunlik yo'nalish yo'q" : "Dona yo'nalish yo'q") + '</option>';
      deptSelect.disabled = true;
    } else {
      deptSelect.innerHTML = '<option value="">\u2014</option>' +
        depts.map(function(d) { return '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>'; }).join('');
      deptSelect.disabled = false;
    }

    var dirSelect = document.getElementById('assignDirection');
    dirSelect.innerHTML = '<option value="">\u2014</option>';
    dirSelect.disabled = true;
  } catch (err) {
    console.error('Directions load error:', err);
    toast(err.message || t('msg.error'), 'error');
  }
}

function fillDirectionsByDepartment(departmentId) {
  var dirSelect = document.getElementById('assignDirection');
  if (!departmentId) {
    dirSelect.innerHTML = '<option value="">\u2014</option>';
    dirSelect.disabled = true;
    return;
  }
  var filtered = (state._assignDirections || []).filter(function(d) {
    var dId = (d.departmentId && d.departmentId._id) || d.departmentId;
    return String(dId) === String(departmentId);
  });
  if (filtered.length === 0) {
    dirSelect.innerHTML = '<option value="">\u2014</option>';
    dirSelect.disabled = true;
    return;
  }
  dirSelect.innerHTML = '<option value="">\u2014</option>' +
    filtered.map(function(d) {
      var price = d.price || d.currentPrice || 0;
      return '<option value="' + d._id + '">' + escapeHtml(d.name) + ' \u2014 ' + formatMoney(price) + '</option>';
    }).join('');
  dirSelect.disabled = false;
}

function setupDailyReportPage() {
  var deptSelect = document.getElementById('assignDepartment');
  if (deptSelect) {
    deptSelect.addEventListener('change', function() { fillDirectionsByDepartment(deptSelect.value); });
  }

  document.querySelectorAll('input[name="workType"]').forEach(function(radio) {
    radio.addEventListener('change', async function() {
      if (radio.checked) await loadDirectionsForAssign();
    });
  });

  var dateInput = document.getElementById('dailyDateInput');
  if (dateInput) {
    dateInput.max = todayISO();
    dateInput.addEventListener('change', function() {
      if (dateInput.value > todayISO()) {
        toast(t('daily.futureNotAllowed'), 'error');
        dateInput.value = state.dailyDate || todayISO();
        return;
      }
      state.dailyDate = dateInput.value;
      loadDailyReport(state.dailyDate);
    });
  }

  var datePrevBtn = document.getElementById('datePrevBtn');
  if (datePrevBtn) {
    datePrevBtn.addEventListener('click', function() {
      if (!state.dailyDate) state.dailyDate = todayISO();
      var d = new Date(state.dailyDate);
      d.setDate(d.getDate() - 1);
      state.dailyDate = d.toISOString().split('T')[0];
      loadDailyReport(state.dailyDate);
    });
  }

  var dateNextBtn = document.getElementById('dateNextBtn');
  if (dateNextBtn) {
    dateNextBtn.addEventListener('click', function() {
      if (!state.dailyDate) state.dailyDate = todayISO();
      var d = new Date(state.dailyDate);
      d.setDate(d.getDate() + 1);
      var newDate = d.toISOString().split('T')[0];
      if (newDate > todayISO()) {
        toast(t('daily.futureNotAllowed'), 'error');
        return;
      }
      state.dailyDate = newDate;
      loadDailyReport(state.dailyDate);
    });
  }

  var dateTodayBtn = document.getElementById('dateTodayBtn');
  if (dateTodayBtn) {
    dateTodayBtn.addEventListener('click', function() {
      state.dailyDate = todayISO();
      loadDailyReport(state.dailyDate);
    });
  }

  document.getElementById('assignForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('assignSubmitBtn');
    var spinner = document.getElementById('assignSubmitSpinner');
    var currentDate = state.dailyDate || todayISO();

    var body = {
      employeeId: document.getElementById('assignEmployeeId').value,
      directionId: document.getElementById('assignDirection').value,
      shift: document.querySelector('input[name="shift"]:checked').value,
      date: currentDate,
    };

    if (!body.directionId) {
      toast(t('daily.direction'), 'error');
      return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      await api('/api/daily-report/assign', { method: 'POST', body: JSON.stringify(body) });
      toast(t('msg.saved'), 'success');
      closeModal('assignModal');
      loadDailyReport(state.dailyDate);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  document.getElementById('productAddBtn').addEventListener('click', function() {
    state.editingProductId = null;
    document.getElementById('productForm').reset();
    document.getElementById('productEditingId').value = '';
    document.getElementById('productModalTitle').textContent = t('daily.addProduct');
    openModal('productModal');
  });

  document.getElementById('productForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('productSubmitBtn');
    var spinner = document.getElementById('productSubmitSpinner');
    var currentDate = state.dailyDate || todayISO();
    var body = {
      productName: document.getElementById('productName').value.trim(),
      quantity: Number(document.getElementById('productQty').value),
      date: currentDate,
    };
    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      if (state.editingProductId) {
        await api('/api/daily-report/products/' + state.editingProductId, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/daily-report/products', { method: 'POST', body: JSON.stringify(body) });
      }
      toast(t('msg.saved'), 'success');
      closeModal('productModal');
      loadDailyReport(state.dailyDate);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function openProductEdit(id) {
  var product = state.dailyData && state.dailyData.products.find(function(p) { return p._id === id; });
  if (!product) return;
  state.editingProductId = id;
  document.getElementById('productEditingId').value = id;
  document.getElementById('productModalTitle').textContent = t('common.edit');
  document.getElementById('productName').value = product.productName;
  document.getElementById('productQty').value = product.quantity;
  openModal('productModal');
}

function openEarningEditModal(assignmentId) {
  var assignment = state.dailyData && state.dailyData.assigned.find(function(a) { return a._id === assignmentId; });
  if (!assignment) return;
  var lastName = (assignment.employeeSnapshot.lastName && assignment.employeeSnapshot.lastName !== '-') ? ' ' + assignment.employeeSnapshot.lastName : '';
  var fullName = assignment.employeeSnapshot.firstName + lastName;
  document.getElementById('earningAssignmentId').value = assignmentId;
  document.getElementById('earningEmployeeName').textContent = fullName + ' (' + assignment.employeeSnapshot.code + ')';
  document.getElementById('earningDirectionName').textContent = assignment.directionSnapshot.name;
  document.getElementById('earningAmount').value = assignment.earning;
  openModal('earningModal');
}

function setupEarningEdit() {
  var form = document.getElementById('earningForm');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('earningSubmitBtn');
    var spinner = document.getElementById('earningSubmitSpinner');
    var assignmentId = document.getElementById('earningAssignmentId').value;
    var earning = Number(document.getElementById('earningAmount').value);
    if (isNaN(earning) || earning < 0) {
      toast(t('msg.error'), 'error');
      return;
    }
    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      await api('/api/daily-report/assign/' + assignmentId + '/earning', {
        method: 'PUT', body: JSON.stringify({ earning: earning }),
      });
      toast(t('msg.saved'), 'success');
      closeModal('earningModal');
      loadDailyReport(state.dailyDate);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function confirmDeleteProduct(id) {
  openConfirm(t('common.delete'), t('common.confirm'), async function() {
    try {
      await api('/api/daily-report/products/' + id, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadDailyReport(state.dailyDate);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

function initMonthlyReport() {
  var today = new Date();
  if (!state.monthData) {
    state.monthData = { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  updateMonthLabel();
  loadMonthlyReport();
}

function updateMonthLabel() {
  var monthNames = {
    'uz-lat': ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
    'uz-cyr': ['\u042f\u043d\u0432', '\u0424\u0435\u0432', '\u041c\u0430\u0440', '\u0410\u043f\u0440', '\u041c\u0430\u0439', '\u0418\u044e\u043d', '\u0418\u044e\u043b', '\u0410\u0432\u0433', '\u0421\u0435\u043d', '\u041e\u043a\u0442', '\u041d\u043e\u044f', '\u0414\u0435\u043a'],
    'ru': ['\u042f\u043d\u0432', '\u0424\u0435\u0432', '\u041c\u0430\u0440', '\u0410\u043f\u0440', '\u041c\u0430\u0439', '\u0418\u044e\u043d', '\u0418\u044e\u043b', '\u0410\u0432\u0433', '\u0421\u0435\u043d', '\u041e\u043a\u0442', '\u041d\u043e\u044f', '\u0414\u0435\u043a'],
  };
  var lang = localStorage.getItem('cc_lang') || 'uz-lat';
  var names = monthNames[lang] || monthNames['uz-lat'];
  var label = document.getElementById('monthLabel');
  if (label && state.monthData) {
    label.textContent = names[state.monthData.month - 1] + ' ' + state.monthData.year;
  }
}

async function loadMonthlyReport() {
  var year = state.monthData.year;
  var month = state.monthData.month;
  var tbody = document.getElementById('monthlyTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="20" class="p-6 text-center"><div class="skeleton h-32"></div></td></tr>';

  try {
    var data = await api('/api/monthly-report?year=' + year + '&month=' + month);
    if (!data) return;
    state.monthlyData = data;
    renderMonthlyReport(data);
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="20" class="p-6 text-center text-red-400">' + escapeHtml(err.message) + '</td></tr>';
  }
}

function renderMonthlyReport(data) {
  var tbody = document.getElementById('monthlyTableBody');
  var headRow = document.getElementById('monthlyTableHead');
  if (!tbody || !headRow) return;

  var days = data.days || [];

  var headHTML = '<tr>' +
    '<th style="position: sticky; left: 0; z-index: 2; background: var(--bg-secondary);"><input type="checkbox" id="monthSelectAll" /></th>' +
    '<th class="font-bold" style="position: sticky; left: 40px; z-index: 2; background: var(--bg-secondary);">' + t('emp.table.name') + '</th>';

  days.forEach(function(day) {
    headHTML += '<th class="text-center"><span class="mono text-xs">' + day.day + '</span></th>';
  });

  headHTML += '<th class="text-right">' + t('monthly.totalShift') + '</th>' +
    '<th class="text-right">' + t('monthly.totalEarning') + '</th>' +
    '<th class="text-right">' + t('monthly.paid') + '</th>' +
    '<th class="text-right">' + t('monthly.remaining') + '</th>' +
    '<th class="text-center">' + t('common.actions') + '</th>' +
  '</tr>';
  headRow.innerHTML = headHTML;

  if (data.employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" class="p-12 text-center text-zinc-500">' + t('common.emptyData') + '</td></tr>';
    return;
  }

  tbody.innerHTML = data.employees.map(function(emp) {
    var cells = '';
    days.forEach(function(day) {
      var dd = emp.daysData && emp.daysData[day.day];
      var shift = dd ? (dd.totalShift || 0) : 0;
      var earned = dd ? (dd.totalEarning || 0) : 0;
      var isPaid = dd ? dd.paid : false;
      var cellContent = shift > 0
        ? '<div class="text-xs">' + (shift === 0.5 ? '\u00bd' : shift) + '</div><div class="mono text-[10px] text-emerald-400 mt-0.5">' + formatMoney(earned) + '</div>'
        : '<span class="text-zinc-700">\u2014</span>';
      cells += '<td class="text-center ' + (isPaid ? 'paid-cell' : '') + '">' + cellContent + '</td>';
    });

    var actionBtn = emp.totalEarning > 0
      ? '<button type="button" data-act="pay-emp" data-id="' + emp._id + '" data-name="' + escapeHtml(emp.firstName) + '" class="btn-ghost px-2 py-1 rounded text-[10px]">' + t('monthly.pay') + '</button>'
      : '\u2014';

    return '<tr>' +
      '<td style="position: sticky; left: 0; z-index: 1; background: var(--bg-secondary);"><input type="checkbox" class="emp-select" data-id="' + emp._id + '" /></td>' +
      '<td class="font-medium" style="position: sticky; left: 40px; z-index: 1; background: var(--bg-secondary);"><div>' + escapeHtml(emp.firstName) + '</div><div class="mono text-[10px] text-zinc-500">' + escapeHtml(emp.code) + '</div></td>' +
      cells +
      '<td class="text-right mono text-sm">' + emp.totalShift + '</td>' +
      '<td class="text-right mono font-semibold text-emerald-400">' + formatMoney(emp.totalEarning) + '</td>' +
      '<td class="text-right mono text-emerald-300">' + formatMoney(emp.totalPaid || 0) + '</td>' +
      '<td class="text-right mono font-bold ' + ((emp.remaining || 0) > 0 ? 'text-amber-400' : 'text-zinc-500') + '">' + formatMoney(emp.remaining || 0) + '</td>' +
      '<td class="text-center">' + actionBtn + '</td>' +
    '</tr>';
  }).join('');

  tbody.querySelectorAll('[data-act="pay-emp"]').forEach(function(btn) {
    btn.addEventListener('click', function() { payEmployeeAction(btn.dataset.id, btn.dataset.name); });
  });
}

async function payEmployeeAction(empId, empName) {
  var emp = state.monthlyData && state.monthlyData.employees.find(function(e) { return e._id === empId; });
  if (!emp || emp.remaining <= 0) {
    toast("Bu xodimga to'lov yo'q", 'error');
    return;
  }
  if (!confirm(empName + ' ga ' + formatMoney(emp.remaining) + " so'm to'lansinmi?")) return;

  try {
    await api('/api/monthly-report/pay', {
      method: 'POST',
      body: JSON.stringify({
        employeeIds: [empId],
        year: state.monthData.year,
        month: state.monthData.month,
        amount: emp.remaining,
      }),
    });
    toast(t('msg.saved'), 'success');
    loadMonthlyReport();
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

function setupMonthlyReportPage() {
  var prevBtn = document.getElementById('monthPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      state.monthData.month--;
      if (state.monthData.month < 1) {
        state.monthData.month = 12;
        state.monthData.year--;
      }
      updateMonthLabel();
      loadMonthlyReport();
    });
  }
  var nextBtn = document.getElementById('monthNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      var today = new Date();
      if (state.monthData.year >= today.getFullYear() && state.monthData.month >= today.getMonth() + 1) {
        toast("Kelajakdagi oyga o'tib bo'lmaydi", 'error');
        return;
      }
      state.monthData.month++;
      if (state.monthData.month > 12) {
        state.monthData.month = 1;
        state.monthData.year++;
      }
      updateMonthLabel();
      loadMonthlyReport();
    });
  }

  var exportBtn = document.getElementById('exportExcelBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }
}

function exportToExcel() {
  if (!state.monthlyData) {
    toast(t('msg.error'), 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    toast("XLSX kutubxonasi yo'q", 'error');
    return;
  }
  var data = state.monthlyData;
  var wb = XLSX.utils.book_new();
  var ws_data = [];

  var headerRow = ['#', 'Xodim', 'Kod'];
  data.days.forEach(function(d) { headerRow.push(d.day); });
  headerRow.push('Jami smena', 'Jami pul', "To'langan", 'Qoldiq');
  ws_data.push(headerRow);

  data.employees.forEach(function(emp, idx) {
    var row = [idx + 1, emp.firstName, emp.code];
    data.days.forEach(function(day) {
      var shift = (emp.daysData && emp.daysData[day.day]) ? emp.daysData[day.day].totalShift || 0 : 0;
      row.push(shift > 0 ? shift : '');
    });
    row.push(emp.totalShift, emp.totalEarning, emp.totalPaid || 0, emp.remaining || 0);
    ws_data.push(row);
  });

  var ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Oylik hisobot');
  XLSX.writeFile(wb, 'oylik_' + data.year + '_' + String(data.month).padStart(2, '0') + '.xlsx');
}

async function loadArchive() {
  var container = document.getElementById('archiveContainer');
  if (!container) return;
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';
  try {
    var archives = await api('/api/archive');
    if (!archives) return;
    state.archives = archives;
    renderArchive(archives);
  } catch (err) {
    container.innerHTML = '<div class="p-6 text-center text-red-400">' + escapeHtml(err.message) + '</div>';
  }
}

function renderArchive(archives) {
  var container = document.getElementById('archiveContainer');
  if (archives.length === 0) {
    container.innerHTML = '<div class="p-12 text-center text-zinc-500">' + t('common.emptyData') + '</div>';
    return;
  }
  container.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">' +
    archives.map(function(a) {
      return '<div class="card p-4"><div class="font-bold">' + a.year + ' \u00b7 ' + String(a.month).padStart(2, '0') + '</div>' +
        '<div class="mono text-xs text-zinc-500 mt-1">' + (a.employeeCount || 0) + " xodim \u00b7 " + formatMoney(a.totalPaid || 0) + " so'm</div></div>";
    }).join('') + '</div>';
}

function openModal(id) {
  var modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  applyStaticTranslations();
}

function closeModal(id) {
  var modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

function setupModalCloses() {
  document.querySelectorAll('[data-close]').forEach(function(btn) {
    btn.addEventListener('click', function() { closeModal(btn.dataset.close); });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function(modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal(modal.id);
    });
  });
}

function openConfirm(title, text, callback) {
  state.confirmCallback = callback;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  openModal('confirmModal');
}

function setupConfirmModal() {
  document.getElementById('confirmYesBtn').addEventListener('click', async function() {
    var cb = state.confirmCallback;
    state.confirmCallback = null;
    closeModal('confirmModal');
    if (typeof cb === 'function') await cb();
  });
}

function setupSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebarBackdrop');
  var toggle = document.getElementById('menuToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      sidebar.classList.add('open');
      backdrop.classList.remove('hidden');
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', function() {
      sidebar.classList.remove('open');
      backdrop.classList.add('hidden');
    });
  }
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm(t('common.logoutConfirm'))) logout();
  });
}

async function initApp() {
  try {
    var me = await api('/api/auth/me');
    if (!me || me.role !== 'admin') {
      logout();
      return;
    }
    state.user = me;
    state.business = me;
    applyBranding(me);
    buildSidebar(me.enabledModules || [], me.modulesInfo || []);

    showApp();

    var effective = state.business.effectiveModules || [];
    if (effective.length > 0) {
      navigateTo(effective[0]);
    }
  } catch (err) {
    console.error('Init error:', err);
    logout();
  }
}

function setupKeyboard() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(function(m) { closeModal(m.id); });
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setupThemeToggle();
  setupLangSwitchers();
  setupLogin();
  setupSidebar();
  setupEmployeesPage();
  setupDirectionsPiecework();
  setupDirectionsDaily();
  setupDirectionForms();
  setupDailyReportPage();
  setupMonthlyReportPage();
  setupEarningEdit();
  setupModalCloses();
  setupConfirmModal();
  setupKeyboard();

  applyStaticTranslations();

  if (state.token) {
    initApp();
  } else {
    showLogin();
  }
});