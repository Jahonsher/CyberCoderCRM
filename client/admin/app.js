/**
 * CyberCoderCRM - Admin Application (SPA)
 * Bitta fayl ichida 5 sahifa + dinamik sidebar + white-label
 * YANGI: Yo'nalishlarda piecework va daily turlari (toggle)
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
  directions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
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
  directions: [],
  departments: [],
  selectedDepartmentId: null,
  dailyData: null,
  dailyDate: null,
  monthData: null,
  monthlyData: null,
  monthSelected: new Set(),
  monthSelectedDays: new Set(),
  archives: [],

  // Assign modal cache
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

function getCurrentTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton();
}

function toggleTheme() {
  setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}

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
// VIEW SWITCHER
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
// LANGUAGE SWITCHER
// ============================================

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

      if (state.currentPage) {
        navigateTo(state.currentPage);
      } else {
        applyStaticTranslations();
      }
    });
  });
  updateLangButtonsActive();
}

function updateLangButtonsActive() {
  const currentLang = (typeof window.getCurrentLang === 'function')
    ? window.getCurrentLang() : 'uz-lat';
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

  const items = enabledModules.map(key => {
    const info = modulesInfo.find(m => m.key === key);
    if (!info) return '';
    const icon = MODULE_ICONS[key] || MODULE_ICONS.employees;
    const label = t(`nav.${key}`);
    return `
      <a href="#" class="nav-item" data-page="${key}">
        ${icon}
        <span>${label}</span>
      </a>
    `;
  }).join('');

  nav.insertAdjacentHTML('beforeend', items);

  nav.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });
}

// ============================================
// ROUTER
// ============================================

function navigateTo(pageKey) {
  if (!state.business || !state.business.enabledModules.includes(pageKey)) {
    const firstPage = state.business?.enabledModules?.[0];
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
    case 'directions': loadDepartments(); break;
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
// DEPARTMENTS & DIRECTIONS (YANGI - 2 type bilan)
// ============================================

async function loadDirections(departmentId) {
  const container = document.getElementById('dirTableContainer');
  const dirSection = document.getElementById('directionsSection');

  if (!departmentId) {
    dirSection.classList.add('hidden');
    return;
  }

  dirSection.classList.remove('hidden');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';

  try {
    const directions = await api(`/api/directions?departmentId=${departmentId}`);
    if (!directions) return;
    state.directions = directions;
    renderDirections(directions);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartments() {
  const container = document.getElementById('departmentsContainer');
  container.innerHTML = '<div class="skeleton h-24"></div>';

  try {
    const departments = await api('/api/departments');
    if (!departments) return;
    state.departments = departments;
    renderDepartments(departments);

    if (departments.length > 0 && !state.selectedDepartmentId) {
      selectDepartment(departments[0]._id);
    } else if (state.selectedDepartmentId) {
      selectDepartment(state.selectedDepartmentId);
    }
  } catch (err) {
    container.innerHTML = `<div class="text-center text-red-400 p-6">${escapeHtml(err.message)}</div>`;
  }
}

function renderDepartments(departments) {
  const container = document.getElementById('departmentsContainer');
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
    document.getElementById('directionsSection').classList.add('hidden');
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${departments.map(d => `
        <div class="dept-card ${state.selectedDepartmentId === d._id ? 'selected' : ''}" data-dept-id="${d._id}">
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
      selectDepartment(card.dataset.deptId);
    });
  });

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (act === 'dept-edit') openDeptEdit(id);
      else if (act === 'dept-delete') confirmDeleteDept(id, btn.dataset.name);
    });
  });
}

function selectDepartment(deptId) {
  state.selectedDepartmentId = deptId;
  const dept = state.departments.find(d => d._id === deptId);

  document.querySelectorAll('.dept-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.deptId === deptId);
  });

  if (dept) {
    document.getElementById('currentDeptName').textContent = dept.name;
    document.getElementById('currentDeptHint').textContent = `${dept.directionCount || 0} ${t('dept.directionCount')}`;
  }

  loadDirections(deptId);
}

// YANGI - Yo'nalishlar 2 ta type badge bilan
function renderDirections(directions) {
  const container = document.getElementById('dirTableContainer');

  if (!state.selectedDepartmentId) {
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

  container.innerHTML = `
    <div class="p-5 space-y-3">
      ${directions.map(d => {
        const pwEnabled = d.pieceworkEnabled !== false;
        const dEnabled = d.dailyEnabled === true;
        const pwPrice = d.pieceworkPrice || d.currentPrice || 0;
        const dPrice = d.dailyPrice || 0;

        return `
          <div class="card p-4 flex items-center justify-between gap-3 flex-wrap" style="background: rgba(139, 92, 246, 0.04);">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-base truncate">${escapeHtml(d.name)}</div>

              <div class="flex gap-2 mt-2 flex-wrap">
                ${pwEnabled ? `
                  <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25">
                    <span class="text-xs font-medium text-purple-300">${t('daily.piecework')}</span>
                    <span class="mono text-xs font-bold text-purple-300">${formatMoney(pwPrice)}</span>
                  </div>
                ` : `
                  <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/5 border border-zinc-500/15 opacity-40">
                    <span class="text-xs font-medium text-zinc-500 line-through">${t('daily.piecework')}</span>
                  </div>
                `}

                ${dEnabled ? `
                  <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);">
                    <span class="text-xs font-medium" style="color: #34d399;">${t('daily.dailyWork')}</span>
                    <span class="mono text-xs font-bold" style="color: #34d399;">${formatMoney(dPrice)}</span>
                  </div>
                ` : `
                  <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/5 border border-zinc-500/15 opacity-40">
                    <span class="text-xs font-medium text-zinc-500 line-through">${t('daily.dailyWork')}</span>
                  </div>
                `}
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
      if (action === 'dir-edit') openDirEdit(id);
      else if (action === 'dir-delete') confirmDeleteDirection(id, btn.dataset.name);
    });
  });
}

function setupDirectionsPage() {
  // Department
  const deptAddBtn = document.getElementById('deptAddBtn');
  if (deptAddBtn) {
    deptAddBtn.addEventListener('click', () => {
      state.editingDeptId = null;
      document.getElementById('deptForm').reset();
      document.getElementById('deptEditingId').value = '';
      document.getElementById('deptModalTitle').textContent = t('dept.add');
      openModal('deptModal');
    });
  }

  const deptForm = document.getElementById('deptForm');
  if (deptForm) {
    deptForm.addEventListener('submit', async (e) => {
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
        loadDepartments();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
      }
    });
  }

  // Direction - YANGI 2 ta type bilan + biznes ruxsati
  document.getElementById('dirAddBtn').addEventListener('click', () => {
    if (!state.selectedDepartmentId) {
      toast(t('dept.selectFirst'), 'error');
      return;
    }
    state.editingDirId = null;
    document.getElementById('dirForm').reset();
    document.getElementById('dirEditingId').value = '';
    document.getElementById('dirModalTitle').textContent = t('dir.add');

    // YANGI: Biznes ruxsatlariga qarab default values
    const bizWT = state.business?.enabledWorkTypes || { piecework: true, daily: true };
    document.getElementById('dirPieceworkEnabled').checked = bizWT.piecework;
    document.getElementById('dirDailyEnabled').checked = false;
    document.getElementById('dirPieceworkPrice').value = '';
    document.getElementById('dirDailyPrice').value = '';

    fillDepartmentSelect('dirDepartment', state.selectedDepartmentId);
    applyBusinessWorkTypeRestrictions(); // YANGI
    toggleDirPieceworkWrap();
    toggleDirDailyWrap();

    openModal('dirModal');
  });

  // Toggle listeners
  const pwCheck = document.getElementById('dirPieceworkEnabled');
  if (pwCheck) pwCheck.addEventListener('change', toggleDirPieceworkWrap);
  const dCheck = document.getElementById('dirDailyEnabled');
  if (dCheck) dCheck.addEventListener('change', toggleDirDailyWrap);

  document.getElementById('dirForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('dirSubmitBtn');
    const spinner = document.getElementById('dirSubmitSpinner');

    const pwEnabled = document.getElementById('dirPieceworkEnabled').checked;
    const dEnabled = document.getElementById('dirDailyEnabled').checked;

    if (!pwEnabled && !dEnabled) {
      toast(t('dir.atLeastOne'), 'error');
      return;
    }

    const body = {
      name: document.getElementById('dirName').value.trim(),
      departmentId: document.getElementById('dirDepartment').value,
      pieceworkEnabled: pwEnabled,
      pieceworkPrice: pwEnabled ? Number(document.getElementById('dirPieceworkPrice').value || 0) : 0,
      dailyEnabled: dEnabled,
      dailyPrice: dEnabled ? Number(document.getElementById('dirDailyPrice').value || 0) : 0,
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
      loadDirections(state.selectedDepartmentId);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function toggleDirPieceworkWrap() {
  const enabled = document.getElementById('dirPieceworkEnabled').checked;
  const wrap = document.getElementById('dirPieceworkWrap');
  const toggleWrap = document.getElementById('dirPieceworkEnabled').closest('.type-toggle-wrap');
  if (wrap) {
    if (enabled) {
      wrap.classList.remove('hidden');
      if (toggleWrap) toggleWrap.classList.remove('disabled');
    } else {
      wrap.classList.add('hidden');
      if (toggleWrap) toggleWrap.classList.add('disabled');
    }
  }
}

function toggleDirDailyWrap() {
  const enabled = document.getElementById('dirDailyEnabled').checked;
  const wrap = document.getElementById('dirDailyWrap');
  const toggleWrap = document.getElementById('dirDailyToggleWrap');
  if (wrap) {
    if (enabled) {
      wrap.classList.remove('hidden');
      if (toggleWrap) toggleWrap.classList.remove('disabled');
    } else {
      wrap.classList.add('hidden');
      if (toggleWrap) toggleWrap.classList.add('disabled');
    }
  }
}

function openDirEdit(id) {
  const dir = state.directions.find(d => d._id === id);
  if (!dir) return;
  state.editingDirId = id;
  document.getElementById('dirEditingId').value = id;
  document.getElementById('dirModalTitle').textContent = t('dir.edit');
  document.getElementById('dirName').value = dir.name || '';

  document.getElementById('dirPieceworkEnabled').checked = dir.pieceworkEnabled !== false;
  document.getElementById('dirPieceworkPrice').value = dir.pieceworkPrice || dir.currentPrice || 0;
  document.getElementById('dirDailyEnabled').checked = dir.dailyEnabled === true;
  document.getElementById('dirDailyPrice').value = dir.dailyPrice || 0;

  const deptId = dir.departmentId?._id || dir.departmentId || state.selectedDepartmentId;
  fillDepartmentSelect('dirDepartment', deptId);

  applyBusinessWorkTypeRestrictions(); // YANGI
  toggleDirPieceworkWrap();
  toggleDirDailyWrap();

  openModal('dirModal');
}

// YANGI: Biznes yoqgan ish turlariga qarab toggle'larni cheklash
function applyBusinessWorkTypeRestrictions() {
  const bizWT = state.business?.enabledWorkTypes || { piecework: true, daily: true };

  const pwCheckbox = document.getElementById('dirPieceworkEnabled');
  const pwToggleWrap = pwCheckbox?.closest('.type-toggle-wrap');
  const pwLabel = pwToggleWrap?.querySelector('label');

  const dCheckbox = document.getElementById('dirDailyEnabled');
  const dToggleWrap = document.getElementById('dirDailyToggleWrap');
  const dLabel = dToggleWrap?.querySelector('label');

  // Piecework
  if (pwCheckbox && pwToggleWrap) {
    if (!bizWT.piecework) {
      pwCheckbox.checked = false;
      pwCheckbox.disabled = true;
      pwToggleWrap.style.opacity = '0.4';
      pwToggleWrap.style.cursor = 'not-allowed';
      if (pwLabel) pwLabel.style.cursor = 'not-allowed';
      // Hint badge
      const existingHint = pwToggleWrap.querySelector('.biz-disabled-hint');
      if (!existingHint) {
        const hint = document.createElement('div');
        hint.className = 'biz-disabled-hint mono text-[10px] px-3 py-2 text-amber-400/80';
        hint.textContent = "⚠ Biznesda Shtuk turi yoqilmagan (SuperAdmin)";
        pwToggleWrap.appendChild(hint);
      }
    } else {
      pwCheckbox.disabled = false;
      pwToggleWrap.style.opacity = '';
      pwToggleWrap.style.cursor = '';
      if (pwLabel) pwLabel.style.cursor = 'pointer';
      const hint = pwToggleWrap.querySelector('.biz-disabled-hint');
      if (hint) hint.remove();
    }
  }

  // Daily
  if (dCheckbox && dToggleWrap) {
    if (!bizWT.daily) {
      dCheckbox.checked = false;
      dCheckbox.disabled = true;
      dToggleWrap.style.opacity = '0.4';
      dToggleWrap.style.cursor = 'not-allowed';
      if (dLabel) dLabel.style.cursor = 'not-allowed';
      const existingHint = dToggleWrap.querySelector('.biz-disabled-hint');
      if (!existingHint) {
        const hint = document.createElement('div');
        hint.className = 'biz-disabled-hint mono text-[10px] px-3 py-2 text-amber-400/80';
        hint.textContent = "⚠ Biznesda Kunlik turi yoqilmagan (SuperAdmin)";
        dToggleWrap.appendChild(hint);
      }
    } else {
      dCheckbox.disabled = false;
      dToggleWrap.style.opacity = '';
      dToggleWrap.style.cursor = '';
      if (dLabel) dLabel.style.cursor = 'pointer';
      const hint = dToggleWrap.querySelector('.biz-disabled-hint');
      if (hint) hint.remove();
    }
  }
}

function fillDepartmentSelect(selectId, selectedId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">—</option>' +
    state.departments.map(d =>
      `<option value="${d._id}" ${selectedId === d._id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`
    ).join('');
}

function openDeptEdit(id) {
  const dept = state.departments.find(d => d._id === id);
  if (!dept) return;
  state.editingDeptId = id;
  document.getElementById('deptEditingId').value = id;
  document.getElementById('deptModalTitle').textContent = t('dept.edit');
  document.getElementById('deptName').value = dept.name || '';
  document.getElementById('deptDescription').value = dept.description || '';
  openModal('deptModal');
}

function confirmDeleteDept(id, name) {
  const dept = state.departments.find(d => d._id === id);
  const hasDirections = dept && dept.directionCount > 0;

  openConfirm(
    t('dept.deleteConfirm'),
    `"${name}"${hasDirections ? ` (${dept.directionCount} ${t('dept.directionCount')})` : ''} — ${t('dept.deleteWarn')}`,
    async () => {
      try {
        const url = hasDirections ? `/api/departments/${id}?force=true` : `/api/departments/${id}`;
        await api(url, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        if (state.selectedDepartmentId === id) state.selectedDepartmentId = null;
        loadDepartments();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

function confirmDeleteDirection(id, name) {
  openConfirm(t('dir.deleteConfirm'), `"${name}" — ${t('dir.deleteWarn')}`, async () => {
    try {
      await api(`/api/directions/${id}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadDirections(state.selectedDepartmentId);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
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
    assignedEl.innerHTML = `<div class="text-center text-zinc-500 text-sm py-8">${t('daily.emptyAssigned')}</div>`;
  } else {
    assignedEl.innerHTML = `<div class="space-y-2">${data.assigned.map(a => {
      const bonus = a.bonus || 0;
      const isManual = a.isManual;
      const manualAmount = a.manualAmount;
      const fairShare = a.fairShare || 0;
      const isDaily = a.type === 'daily';
      const deficit = !isDaily && isManual && manualAmount !== null && manualAmount < fairShare
        ? fairShare - manualAmount : 0;

      return `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl ${isDaily ? 'bg-emerald-500/5 border border-emerald-500/15' : 'bg-purple-500/5 border border-purple-500/10'}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate flex items-center gap-2">
            ${escapeHtml(a.employeeSnapshot.firstName)}${a.employeeSnapshot.lastName && a.employeeSnapshot.lastName !== '-' ? ' ' + escapeHtml(a.employeeSnapshot.lastName) : ''}
            ${isDaily ? '<span class="daily-badge">KUNLIK</span>' : ''}
          </div>
          <div class="mono text-xs text-zinc-500 mt-0.5 truncate">
            <span class="${isDaily ? 'text-emerald-300' : 'text-purple-300'}">${escapeHtml(a.employeeSnapshot.code)}</span>
            · ${escapeHtml(a.directionSnapshot.name)}
            · ${a.shift === 0.5 ? '½' : '1'}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <div class="text-right mr-1">
            <div class="mono text-sm font-semibold text-emerald-400">${formatMoney(a.earning)}</div>
            ${!isDaily && bonus > 0 ? `<div class="bonus-badge mt-1">+${formatMoney(bonus)}</div>` : ''}
            ${!isDaily && deficit > 0 ? `<div class="deficit-badge mt-1">−${formatMoney(deficit)}</div>` : ''}
          </div>
          <button type="button" data-act="edit-earning" data-id="${a._id}" class="btn-icon" title="${t('daily.editEarning')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" data-act="unassign" data-id="${a._id}" class="btn-icon danger">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;}).join('')}</div>`;

    assignedEl.querySelectorAll('[data-act="unassign"]').forEach(btn => {
      btn.addEventListener('click', () => unassignEmployee(btn.dataset.id));
    });
    assignedEl.querySelectorAll('[data-act="edit-earning"]').forEach(btn => {
      btn.addEventListener('click', () => openEarningEditModal(btn.dataset.id));
    });
  }

  const unassignedEl = document.getElementById('unassignedList');
  if (data.unassigned.length === 0) {
    unassignedEl.innerHTML = `<div class="text-center text-zinc-500 text-sm py-8">${t('daily.emptyUnassigned')}</div>`;
  } else {
    unassignedEl.innerHTML = `<div class="space-y-2">${data.unassigned.map(e => `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div>
          <div class="mono text-xs text-amber-300/70 mt-0.5 truncate">${escapeHtml(e.code)}</div>
        </div>
        <button type="button" data-act="assign" data-id="${e._id}" data-name="${escapeHtml(e.firstName + ' ' + e.lastName)}" class="btn-ghost px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
          ${t('daily.assign')}
        </button>
      </div>
    `).join('')}</div>`;

    unassignedEl.querySelectorAll('[data-act="assign"]').forEach(btn => {
      btn.addEventListener('click', () => openAssignModal(btn.dataset.id, btn.dataset.name));
    });
  }

  renderProducts(data.products);
}

function renderProducts(products) {
  const container = document.getElementById('productsContainer');
  if (products.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-zinc-500 text-sm">${t('common.emptyData')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('daily.productName')}</th>
            <th>${t('daily.quantity')}</th>
            <th class="text-right">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td class="font-medium">${escapeHtml(p.productName)}</td>
              <td class="mono text-purple-300">${formatMoney(p.quantity)}</td>
              <td class="text-right whitespace-nowrap">
                <button type="button" data-act="product-edit" data-id="${p._id}" class="btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button type="button" data-act="product-delete" data-id="${p._id}" class="btn-icon danger ml-1">
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
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (act === 'product-edit') openProductEdit(id);
      else if (act === 'product-delete') confirmDeleteProduct(id);
    });
  });
}

async function unassignEmployee(assignmentId) {
  try {
    await api(`/api/daily-report/assign/${assignmentId}`, { method: 'DELETE' });
    toast(t('msg.deleted'), 'success');
    loadDailyReport(state.dailyDate);
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

// ============================================
// ASSIGN MODAL - YANGI tartib (Xodim → Ish turi → Bo'lim → Yo'nalish)
// ============================================

async function openAssignModal(employeeId, employeeName) {
  document.getElementById('assignEmployeeId').value = employeeId;
  document.getElementById('assignEmployeeName').textContent = employeeName;

  // Default piecework
  const pwRadio = document.querySelector('input[name="workType"][value="piecework"]');
  if (pwRadio) pwRadio.checked = true;

  // Default smena 1
  const sh1 = document.querySelector('input[name="shift"][value="1"]');
  if (sh1) sh1.checked = true;

  // Yo'nalishlarni yuklash (piecework type bilan)
  await loadDirectionsForAssign();

  openModal('assignModal');
}

async function loadDirectionsForAssign() {
  const type = document.querySelector('input[name="workType"]:checked')?.value || 'piecework';

  try {
    // Backend filter - faqat tegishli tur yoqilgan yo'nalishlar
    const directions = await api(`/api/directions?type=${type}`);
    if (!directions) return;

    state._assignDirections = directions;

    // Bo'limlarni yo'nalishlardan yig'amiz (faqat tegishli tur yoqilganlari)
    const deptMap = {};
    directions.forEach(d => {
      const dept = d.departmentId;
      if (dept && dept._id) {
        deptMap[dept._id] = dept.name;
      }
    });

    const deptSelect = document.getElementById('assignDepartment');
    const depts = Object.entries(deptMap).map(([id, name]) => ({ id, name }));

    if (depts.length === 0) {
      deptSelect.innerHTML = `<option value="">${type === 'daily' ? "Kunlik yo'nalish yo'q" : "Shtuk yo'nalish yo'q"}</option>`;
      deptSelect.disabled = true;
    } else {
      deptSelect.innerHTML = '<option value="">—</option>' +
        depts.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      deptSelect.disabled = false;
    }

    // Direction reset
    const dirSelect = document.getElementById('assignDirection');
    dirSelect.innerHTML = '<option value="">—</option>';
    dirSelect.disabled = true;
  } catch (err) {
    console.error('Directions load error:', err);
    toast(err.message || t('msg.error'), 'error');
  }
}

function fillDirectionsByDepartment(departmentId) {
  const dirSelect = document.getElementById('assignDirection');
  if (!departmentId) {
    dirSelect.innerHTML = '<option value="">—</option>';
    dirSelect.disabled = true;
    return;
  }

  const filtered = (state._assignDirections || []).filter(d => {
    const dId = d.departmentId?._id || d.departmentId;
    return String(dId) === String(departmentId);
  });

  const type = document.querySelector('input[name="workType"]:checked')?.value || 'piecework';

  if (filtered.length === 0) {
    dirSelect.innerHTML = '<option value="">—</option>';
    dirSelect.disabled = true;
    return;
  }

  dirSelect.innerHTML = '<option value="">—</option>' +
    filtered.map(d => {
      const price = type === 'piecework'
        ? (d.pieceworkPrice || d.currentPrice || 0)
        : (d.dailyPrice || 0);
      return `<option value="${d._id}">${escapeHtml(d.name)} — ${formatMoney(price)}</option>`;
    }).join('');
  dirSelect.disabled = false;
}

function setupDailyReportPage() {
  // Department change
  const deptSelect = document.getElementById('assignDepartment');
  if (deptSelect) {
    deptSelect.addEventListener('change', () => {
      fillDirectionsByDepartment(deptSelect.value);
    });
  }

  // Work type change - yo'nalishlarni qayta yuklash
  document.querySelectorAll('input[name="workType"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      if (radio.checked) {
        await loadDirectionsForAssign();
      }
    });
  });

  // Date controls
  const dateInput = document.getElementById('dailyDateInput');
  if (dateInput) {
    dateInput.max = todayISO();
    dateInput.addEventListener('change', () => {
      if (dateInput.value > todayISO()) {
        toast(t('daily.futureNotAllowed'), 'error');
        dateInput.value = state.dailyDate || todayISO();
        return;
      }
      state.dailyDate = dateInput.value;
      loadDailyReport(state.dailyDate);
    });
  }

  const datePrevBtn = document.getElementById('datePrevBtn');
  if (datePrevBtn) {
    datePrevBtn.addEventListener('click', () => {
      if (!state.dailyDate) state.dailyDate = todayISO();
      const d = new Date(state.dailyDate);
      d.setDate(d.getDate() - 1);
      state.dailyDate = d.toISOString().split('T')[0];
      loadDailyReport(state.dailyDate);
    });
  }

  const dateNextBtn = document.getElementById('dateNextBtn');
  if (dateNextBtn) {
    dateNextBtn.addEventListener('click', () => {
      if (!state.dailyDate) state.dailyDate = todayISO();
      const d = new Date(state.dailyDate);
      d.setDate(d.getDate() + 1);
      const newDate = d.toISOString().split('T')[0];
      if (newDate > todayISO()) {
        toast(t('daily.futureNotAllowed'), 'error');
        return;
      }
      state.dailyDate = newDate;
      loadDailyReport(state.dailyDate);
    });
  }

  const dateTodayBtn = document.getElementById('dateTodayBtn');
  if (dateTodayBtn) {
    dateTodayBtn.addEventListener('click', () => {
      state.dailyDate = todayISO();
      loadDailyReport(state.dailyDate);
    });
  }

  // Assign form submit - YANGI (dailyAmount yo'q)
  document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('assignSubmitBtn');
    const spinner = document.getElementById('assignSubmitSpinner');

    const workType = document.querySelector('input[name="workType"]:checked')?.value || 'piecework';
    const currentDate = state.dailyDate || todayISO();

    const body = {
      employeeId: document.getElementById('assignEmployeeId').value,
      directionId: document.getElementById('assignDirection').value,
      shift: document.querySelector('input[name="shift"]:checked').value,
      date: currentDate,
      type: workType,
      // dailyAmount endi YOQ - yo'nalishdan olinadi
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

  // Product handlers
  document.getElementById('productAddBtn').addEventListener('click', () => {
    state.editingProductId = null;
    document.getElementById('productForm').reset();
    document.getElementById('productEditingId').value = '';
    document.getElementById('productModalTitle').textContent = t('daily.addProduct');
    openModal('productModal');
  });

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('productSubmitBtn');
    const spinner = document.getElementById('productSubmitSpinner');

    const currentDate = state.dailyDate || todayISO();
    const body = {
      productName: document.getElementById('productName').value.trim(),
      quantity: Number(document.getElementById('productQty').value),
      date: currentDate,
    };

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      if (state.editingProductId) {
        await api(`/api/daily-report/products/${state.editingProductId}`, { method: 'PUT', body: JSON.stringify(body) });
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
  const product = state.dailyData?.products.find(p => p._id === id);
  if (!product) return;
  state.editingProductId = id;
  document.getElementById('productEditingId').value = id;
  document.getElementById('productModalTitle').textContent = t('common.edit');
  document.getElementById('productName').value = product.productName;
  document.getElementById('productQty').value = product.quantity;
  openModal('productModal');
}

function openEarningEditModal(assignmentId) {
  const assignment = state.dailyData?.assigned.find(a => a._id === assignmentId);
  if (!assignment) return;

  const fullName = assignment.employeeSnapshot.firstName +
    (assignment.employeeSnapshot.lastName && assignment.employeeSnapshot.lastName !== '-'
      ? ' ' + assignment.employeeSnapshot.lastName : '');

  document.getElementById('earningAssignmentId').value = assignmentId;
  document.getElementById('earningEmployeeName').textContent = `${fullName} (${assignment.employeeSnapshot.code})`;
  document.getElementById('earningDirectionName').textContent = assignment.directionSnapshot.name;
  document.getElementById('earningAmount').value = assignment.earning;
  openModal('earningModal');
}

function setupEarningEdit() {
  const form = document.getElementById('earningForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('earningSubmitBtn');
    const spinner = document.getElementById('earningSubmitSpinner');
    const assignmentId = document.getElementById('earningAssignmentId').value;
    const earning = Number(document.getElementById('earningAmount').value);

    if (isNaN(earning) || earning < 0) {
      toast(t('msg.error'), 'error');
      return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      await api(`/api/daily-report/assign/${assignmentId}/earning`, {
        method: 'PUT', body: JSON.stringify({ earning }),
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
  openConfirm(t('common.delete'), t('common.confirm'), async () => {
    try {
      await api(`/api/daily-report/products/${id}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadDailyReport(state.dailyDate);
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

// ============================================
// MONTHLY REPORT (o'zgarmagan, faqat o'sha versiya)
// ============================================

function initMonthlyReport() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById('monthStart').value = startOfMonth.toISOString().split('T')[0];
  document.getElementById('monthEnd').value = now.toISOString().split('T')[0];
  loadMonthlyReport();
}

function setupMonthlyReportPage() {
  const exportBtn = document.getElementById('monthExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportMonthlyToExcel);
  const exportDetailBtn = document.getElementById('monthExportDetailBtn');
  if (exportDetailBtn) exportDetailBtn.addEventListener('click', exportEmployeeDetailToExcel);

  const today = todayISO();
  const d = new Date();
  d.setDate(1);
  const monthStart = d.toISOString().split('T')[0];

  document.getElementById('monthStart').value = monthStart;
  document.getElementById('monthEnd').value = today;
  document.getElementById('monthLoadBtn').addEventListener('click', loadMonthlyReport);

  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const now = new Date();
      const end = now.toISOString().split('T')[0];
      let start = end;

      if (preset === 'today') start = end;
      else if (preset === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        start = y.toISOString().split('T')[0];
        document.getElementById('monthEnd').value = start;
      }
      else if (preset === 'week') {
        const w = new Date();
        w.setDate(w.getDate() - 7);
        start = w.toISOString().split('T')[0];
      }
      else if (preset === 'month') {
        const m = new Date();
        m.setDate(1);
        start = m.toISOString().split('T')[0];
      }

      document.getElementById('monthStart').value = start;
      if (preset !== 'yesterday') document.getElementById('monthEnd').value = end;
      loadMonthlyReport();
    });
  });

  const selectAllCb = document.getElementById('monthSelectAll');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      const checked = selectAllCb.checked;
      state.monthSelected.clear();
      document.querySelectorAll('.pay-checkbox').forEach(cb => {
        const row = cb.closest('.emp-row');
        if (row && row.classList.contains('paid')) return;
        cb.checked = checked;
        if (checked) state.monthSelected.add(cb.dataset.employeeId);
      });
      updateMonthActionBar();
    });
  }

  const payBtn = document.getElementById('monthPayBtn');
  if (payBtn) payBtn.addEventListener('click', openPayModal);

  const payForm = document.getElementById('payForm');
  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitPay();
    });
  }
}

async function loadMonthlyReport() {
  const startDate = document.getElementById('monthStart').value;
  const endDate = document.getElementById('monthEnd').value;
  const code = document.getElementById('monthCode').value.trim();

  if (!startDate || !endDate) {
    toast(t('msg.error'), 'error');
    return;
  }

  state.monthSelected.clear();

  const params = new URLSearchParams({ startDate, endDate });
  if (code) params.append('code', code);

  try {
    const data = await api(`/api/monthly-report?${params}`);
    if (!data) return;
    state.monthData = data;
    renderMonthlyReport(data);
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

function renderMonthlyReport(data) {
  state.monthlyData = data;

  document.getElementById('monthStatEarning').textContent = formatMoney(data.stats.totalEarning);
  document.getElementById('monthStatEmployees').textContent = data.stats.totalEmployees;
  document.getElementById('monthStatPaid').textContent = formatMoney(data.stats.totalPaid || 0);
  document.getElementById('monthStatProducts').textContent = data.stats.totalProductCount;

  const container = document.getElementById('monthResultsContainer');
  const actionBar = document.getElementById('monthActionBar');
  const detailsContainer = document.getElementById('monthDetailsContainer');

  if (!data.employees || data.employees.length === 0) {
    container.innerHTML = `<div class="p-10 text-center text-zinc-500"><p class="text-sm">${t('month.empty')}</p></div>`;
    actionBar.classList.add('hidden');
    detailsContainer.classList.add('hidden');
    return;
  }

  state.monthSelected.clear();
  state.monthSelectedDays.clear();

  const isSingleEmployee = data.employees.length === 1 && document.getElementById('monthCode').value.trim();

  if (isSingleEmployee) {
    const emp = data.employees[0];
    const fullName = emp.firstName + (emp.lastName && emp.lastName !== '-' ? ' ' + emp.lastName : '');

    container.innerHTML = `
      <div class="p-5">
        <div class="mb-4">
          <div class="font-bold text-lg">${escapeHtml(fullName)}</div>
          <div class="mono text-xs text-zinc-500 mt-1">
            <span class="text-purple-300">${escapeHtml(emp.code)}</span>
            · ${emp.totalDays} kun · ${emp.totalShifts} smena
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="stat-card">
            <div class="mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Jami</div>
            <div class="text-2xl font-bold">${formatMoney(emp.totalEarning)}</div>
            <div class="mono text-xs text-zinc-500 mt-1">${emp.totalDays} kun</div>
          </div>
          <div class="stat-card" style="border-color: rgba(16, 185, 129, 0.3)">
            <div class="mono text-[10px] text-emerald-400 uppercase tracking-wider mb-2">Berilgan</div>
            <div class="text-2xl font-bold text-emerald-400">${formatMoney(emp.paidAmount || 0)}</div>
            <div class="mono text-xs text-zinc-500 mt-1">${emp.paidDays || 0} kun</div>
          </div>
          <div class="stat-card" style="border-color: rgba(245, 158, 11, 0.3)">
            <div class="mono text-[10px] text-amber-400 uppercase tracking-wider mb-2">Qolgan</div>
            <div class="text-2xl font-bold text-amber-400">${formatMoney(emp.remainingAmount || 0)}</div>
            <div class="mono text-xs text-zinc-500 mt-1">${emp.remainingDays || 0} kun</div>
          </div>
        </div>
      </div>
    `;

    detailsContainer.classList.remove('hidden');
    document.getElementById('monthDetailsSubtitle').textContent = `${escapeHtml(emp.code)} · ${emp.totalDays} kun`;

    document.getElementById('monthDetailsTable').innerHTML = `
      <div class="p-4 border-b border-purple-500/10 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="dayselectAll" class="w-5 h-5 rounded cursor-pointer accent-purple-600" />
            <span class="text-sm font-medium">${t('month.selectUnpaidOnly')}</span>
          </label>
          <span class="mono text-xs text-zinc-500" id="daySelectedCount"></span>
        </div>
        <button id="dayPayBtn" type="button" class="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          <span>${t('month.paySelectedDays')}</span>
        </button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px"></th>
              <th>Sana</th>
              <th>${t('dept.title')}</th>
              <th>${t('daily.direction')}</th>
              <th class="text-center">Smena</th>
              <th class="text-right">Daromad</th>
              <th class="text-center">Holat</th>
            </tr>
          </thead>
          <tbody>
            ${emp.days.map(day => `
              <tr class="day-row ${day.isPaid ? 'paid' : ''}" data-assignment-id="${day.assignmentId}" data-paid="${day.isPaid ? '1' : '0'}" data-payment-id="${day.paymentId || ''}">
                <td>
                  <input type="checkbox" class="day-checkbox" data-assignment-id="${day.assignmentId}" ${day.isPaid ? 'checked disabled' : ''} />
                </td>
                <td class="mono text-sm">${formatDate(day.date)}</td>
                <td class="text-sm text-zinc-400">${escapeHtml(day.departmentName || '—')}</td>
                <td class="text-sm">${escapeHtml(day.directionName)}</td>
                <td class="mono text-sm text-center">${day.shift === 0.5 ? '½' : '1'}</td>
                <td class="mono font-semibold text-emerald-400 text-right">${formatMoney(day.earning)}</td>
                <td class="text-center">
                  ${day.isPaid
                    ? `<button type="button" data-act="undo-pay" data-payment-id="${day.paymentId}" class="paid-badge cursor-pointer hover:opacity-80" title="${t('month.undoPayConfirm')}">${t('month.paidStatus')}</button>`
                    : `<span class="mono text-xs text-zinc-500">—</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    detailsContainer.querySelectorAll('.day-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.disabled) return;
        const aid = cb.dataset.assignmentId;
        if (cb.checked) state.monthSelectedDays.add(aid);
        else state.monthSelectedDays.delete(aid);
        updateDayActionBar();
      });
    });

    const selectAllDays = document.getElementById('dayselectAll');
    if (selectAllDays) {
      selectAllDays.addEventListener('change', () => {
        const checked = selectAllDays.checked;
        state.monthSelectedDays.clear();
        detailsContainer.querySelectorAll('.day-checkbox').forEach(cb => {
          if (cb.disabled) return;
          cb.checked = checked;
          if (checked) state.monthSelectedDays.add(cb.dataset.assignmentId);
        });
        updateDayActionBar();
      });
    }

    const dayPayBtn = document.getElementById('dayPayBtn');
    if (dayPayBtn) dayPayBtn.addEventListener('click', () => payDays(false));

    detailsContainer.querySelectorAll('[data-act="undo-pay"]').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmUndoPay(btn.dataset.paymentId);
      });
    });

    actionBar.classList.add('hidden');
    return;
  }

  detailsContainer.classList.add('hidden');
  actionBar.classList.remove('hidden');

  document.getElementById('monthSelectAll').checked = false;

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table" style="table-layout: fixed; width: 100%;">
        <colgroup>
          <col style="width: 50px" />
          <col style="width: auto" />
          <col style="width: 120px" />
          <col style="width: 90px" />
          <col style="width: 130px" />
          <col style="width: 130px" />
          <col style="width: 130px" />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th style="text-align: left">${t('emp.table.name')}</th>
            <th style="text-align: left">${t('emp.table.code')}</th>
            <th style="text-align: right">Kunlar</th>
            <th style="text-align: right">Jami</th>
            <th style="text-align: right; color: #34d399">Berilgan</th>
            <th style="text-align: right; color: #fbbf24">Qolgan</th>
          </tr>
        </thead>
        <tbody>
          ${data.employees.map(e => {
            const fullName = e.firstName + (e.lastName && e.lastName !== '-' ? ' ' + e.lastName : '');
            const isFullyPaid = e.remainingAmount === 0 && e.totalEarning > 0;
            return `
              <tr class="emp-row ${isFullyPaid ? 'paid' : ''}" data-employee-id="${e.employeeId}">
                <td>
                  <input type="checkbox" class="pay-checkbox" data-employee-id="${e.employeeId}" ${isFullyPaid ? 'disabled' : ''} />
                </td>
                <td class="font-medium" style="text-align: left">${escapeHtml(fullName)}</td>
                <td style="text-align: left"><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
                <td class="mono" style="text-align: right">${e.totalDays}</td>
                <td class="mono font-semibold" style="text-align: right">${formatMoney(e.totalEarning)}</td>
                <td class="mono" style="text-align: right; color: #34d399">${formatMoney(e.paidAmount || 0)}</td>
                <td class="mono font-semibold" style="text-align: right; color: ${e.remainingAmount > 0 ? '#fbbf24' : '#34d399'}">${formatMoney(e.remainingAmount || 0)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.pay-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const empId = cb.dataset.employeeId;
      if (cb.checked) state.monthSelected.add(empId);
      else state.monthSelected.delete(empId);
      updateMonthActionBar();
    });
  });

  updateMonthActionBar();
}

function updateDayActionBar() {
  const count = state.monthSelectedDays.size;
  const countEl = document.getElementById('daySelectedCount');
  const payBtn = document.getElementById('dayPayBtn');
  if (countEl) countEl.textContent = count > 0 ? `(${count} kun)` : '';
  if (payBtn) payBtn.disabled = count === 0;
}

async function payDays(skipConfirm) {
  if (state.monthSelectedDays.size === 0) return;
  const ids = Array.from(state.monthSelectedDays);
  if (!skipConfirm) {
    const ok = confirm(`${ids.length} kun uchun to'lash?`);
    if (!ok) return;
  }
  try {
    const result = await api('/api/monthly-report/pay-days', {
      method: 'POST', body: JSON.stringify({ assignmentIds: ids }),
    });
    if (result) {
      toast(`${result.paidCount} kun uchun to'lov qilindi`, 'success');
      state.monthSelectedDays.clear();
      loadMonthlyReport();
    }
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

function confirmUndoPay(paymentId) {
  openConfirm(t('month.undoPayConfirm'), t('month.undoPayWarn'), async () => {
    try {
      await api(`/api/monthly-report/pay/${paymentId}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadMonthlyReport();
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

function updateMonthActionBar() {
  const count = state.monthSelected.size;
  document.getElementById('monthSelectedCount').textContent = count > 0 ? `(${count})` : '';
  document.getElementById('monthPayBtn').disabled = count === 0;
}

function openPayModal() {
  if (state.monthSelected.size === 0) return;
  const selectedEmps = state.monthData.employees.filter(e =>
    state.monthSelected.has(String(e.employeeId))
  );
  const total = selectedEmps.reduce((sum, e) => sum + e.totalEarning, 0);
  document.getElementById('payCountLabel').textContent = selectedEmps.length;
  document.getElementById('payTotalLabel').textContent = formatMoney(total);

  const listEl = document.getElementById('payList');
  listEl.innerHTML = selectedEmps.map(e => {
    const fullName = e.firstName + (e.lastName && e.lastName !== '-' ? ' ' + e.lastName : '');
    return `
      <div class="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${escapeHtml(fullName)}</div>
          <div class="mono text-xs text-zinc-500">${escapeHtml(e.code)} · ${e.totalDays} kun</div>
        </div>
        <div class="mono font-semibold text-emerald-400 text-sm shrink-0 ml-3">${formatMoney(e.totalEarning)}</div>
      </div>
    `;
  }).join('');

  openModal('payModal');
}

async function submitPay() {
  const btn = document.getElementById('paySubmitBtn');
  const spinner = document.getElementById('paySubmitSpinner');

  const body = {
    employeeIds: Array.from(state.monthSelected),
    startDate: document.getElementById('monthStart').value,
    endDate: document.getElementById('monthEnd').value,
  };

  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    const result = await api('/api/monthly-report/pay-remaining', {
      method: 'POST', body: JSON.stringify(body),
    });
    if (result) {
      const msg = `Qolgani to'landi: ${result.paidCount} kun` +
        (result.errorsCount > 0 ? ` (${result.errorsCount} xato)` : '');
      toast(msg, result.paidCount > 0 ? 'success' : 'error');
      closeModal('payModal');
      state.monthSelected.clear();
      loadMonthlyReport();
    }
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ============================================
// ARCHIVE
// ============================================

async function loadArchive() {
  const container = document.getElementById('archiveResultsContainer');
  container.innerHTML = '<div class="card p-10 text-center"><div class="skeleton h-32"></div></div>';

  const month = document.getElementById('archiveMonth').value;
  const code = document.getElementById('archiveCode').value.trim();

  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (code) params.append('code', code);

  try {
    const data = await api(`/api/archive?${params}`);
    if (!data) return;
    state.archives = data;
    renderArchive(data);
  } catch (err) {
    container.innerHTML = `<div class="card p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderArchive(data) {
  document.getElementById('archiveStatPayments').textContent = data.stats.totalPayments || 0;
  document.getElementById('archiveStatAmount').textContent = formatMoney(data.stats.totalAmount || 0);
  document.getElementById('archiveStatEmployees').textContent = data.stats.uniqueEmployees || 0;
  document.getElementById('archiveStatMonths').textContent = data.stats.monthsCount || 0;

  const container = document.getElementById('archiveResultsContainer');

  if (!data.months || data.months.length === 0) {
    container.innerHTML = `
      <div class="card p-12 text-center">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </div>
        <h3 class="font-bold mb-1">${t('archive.empty')}</h3>
      </div>
    `;
    return;
  }

  container.innerHTML = data.months.map(m => `
    <div class="archive-month-card">
      <div class="archive-month-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <div class="font-bold text-lg">${formatMonthLabel(m.periodMonth)}</div>
          <div class="mono text-xs text-zinc-500 mt-1">
            ${m.totalEmployees} ${t('nav.employees')} · ${m.payments.length} ${t('archive.totalPayments')}
          </div>
        </div>
        <div class="text-right">
          <div class="mono text-xs text-zinc-500">${t('archive.monthlyTotal')}</div>
          <div class="text-xl font-bold text-emerald-400">${formatMoney(m.totalAmount)}</div>
        </div>
      </div>
      <div>
        ${m.payments.map(p => {
          const fullName = p.employeeSnapshot.firstName +
            (p.employeeSnapshot.lastName && p.employeeSnapshot.lastName !== '-' ? ' ' + p.employeeSnapshot.lastName : '');
          return `
            <div class="archive-payment-row flex items-center justify-between gap-3 flex-wrap">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">${escapeHtml(fullName)}</div>
                <div class="mono text-xs text-zinc-500 mt-1">
                  <span class="text-purple-300">${escapeHtml(p.employeeSnapshot.code)}</span>
                  · ${formatDate(p.paidAt, { withTime: true })}
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <div class="text-right">
                  <div class="mono font-bold text-emerald-400">${formatMoney(p.amount)}</div>
                </div>
                <button type="button" data-act="archive-delete" data-id="${p._id}" data-name="${escapeHtml(fullName)}" class="btn-icon danger" title="${t('common.delete')}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-act="archive-delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDeleteArchive(btn.dataset.id, btn.dataset.name);
    });
  });
}

function formatMonthLabel(periodMonth) {
  const [year, month] = periodMonth.split('-');
  const monthNames = {
    'uz-lat': ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    'uz-cyr': ['Январ', 'Феврал', 'Март', 'Апрел', 'Май', 'Июн', 'Июл', 'Август', 'Сентабр', 'Октабр', 'Ноябр', 'Декабр'],
    'ru': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  };
  const lang = localStorage.getItem('cc_lang') || 'uz-lat';
  const names = monthNames[lang] || monthNames['uz-lat'];
  const monthName = names[parseInt(month, 10) - 1];
  return `${monthName} ${year}`;
}

function confirmDeleteArchive(id, name) {
  openConfirm(t('archive.deleteConfirm'), `"${name}" — ${t('archive.deleteWarn')}`, async () => {
    try {
      await api(`/api/archive/${id}`, { method: 'DELETE' });
      toast(t('msg.deleted'), 'success');
      loadArchive();
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    }
  });
}

function setupArchivePage() {
  const loadBtn = document.getElementById('archiveLoadBtn');
  if (loadBtn) loadBtn.addEventListener('click', loadArchive);

  const resetBtn = document.getElementById('archiveResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('archiveMonth').value = '';
      document.getElementById('archiveCode').value = '';
      loadArchive();
    });
  }
}

// ============================================
// MODALS
// ============================================

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.classList.remove('flex');
  document.body.style.overflow = '';
}

function setupModalCloseButtons() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  ['empModal', 'dirModal', 'deptModal', 'assignModal', 'productModal', 'confirmModal', 'earningModal', 'payModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) closeModal(id);
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['empModal', 'dirModal', 'deptModal', 'assignModal', 'productModal', 'confirmModal', 'earningModal', 'payModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) closeModal(id);
      });
    }
  });
}

function openConfirm(title, text, callback, btnClass = 'btn-danger') {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  state.confirmCallback = callback;
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.className = `flex-1 ${btnClass} py-2.5 rounded-xl font-medium flex items-center justify-center gap-2`;
  openModal('confirmModal');
}

function setupConfirmModal() {
  document.getElementById('confirmOkBtn').addEventListener('click', async () => {
    if (!state.confirmCallback) return;
    const btn = document.getElementById('confirmOkBtn');
    const spinner = document.getElementById('confirmOkSpinner');
    btn.disabled = true;
    spinner.classList.remove('hidden');
    try {
      await state.confirmCallback();
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
      closeModal('confirmModal');
      state.confirmCallback = null;
    }
  });
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
    if (confirm('Logout?')) logout();
  });
}

async function initApp() {
  try {
    const me = await api('/api/auth/me');
    if (!me || me.role !== 'admin') {
      logout();
      return;
    }
    state.user = me;
    state.business = me;

    if (me.defaultLanguage && typeof window.setLang === 'function') {
      const savedLang = localStorage.getItem('cc_lang');
      if (!savedLang) window.setLang(me.defaultLanguage);
    }
    updateLangButtonsActive();
    applyBranding(me);
    buildSidebar(me.enabledModules || [], me.modulesInfo || []);
    showApp();

    const firstModule = me.enabledModules?.[0];
    if (firstModule) navigateTo(firstModule);

    applyStaticTranslations();
  } catch (err) {
    console.error('Init error:', err);
    logout();
  }
}

// ============================================
// EXCEL EXPORT
// ============================================

function exportMonthlyToExcel() {
  if (!state.monthlyData || !state.monthlyData.employees || state.monthlyData.employees.length === 0) {
    toast(t('msg.error'), 'error');
    return;
  }

  const lang = localStorage.getItem('cc_lang') || 'uz-lat';
  const data = state.monthlyData;

  const headers = {
    'uz-lat': {
      no: '№', name: 'Xodim', code: 'Kod', days: 'Kunlar',
      total: 'Jami', paid: 'Berilgan', remaining: 'Qolgan',
      sheetName: 'Oylik hisobot',
      productsTitle: "KUNLIK MAHSULOTLAR",
      date: 'Sana', productName: 'Mahsulot nomi', quantity: 'Soni',
      productsTotal: 'JAMI MAHSULOT',
    },
    'uz-cyr': {
      no: '№', name: 'Ходим', code: 'Код', days: 'Кунлар',
      total: 'Жами', paid: 'Берилган', remaining: 'Қолган',
      sheetName: 'Ойлик ҳисобот',
      productsTitle: 'КУНЛИК МАҲСУЛОТЛАР',
      date: 'Сана', productName: 'Маҳсулот номи', quantity: 'Сони',
      productsTotal: 'ЖАМИ МАҲСУЛОТ',
    },
    'ru': {
      no: '№', name: 'Сотрудник', code: 'Код', days: 'Дни',
      total: 'Всего', paid: 'Выплачено', remaining: 'Остаток',
      sheetName: 'Месячный отчёт',
      productsTitle: 'ДНЕВНЫЕ ПРОДУКТЫ',
      date: 'Дата', productName: 'Название продукта', quantity: 'Количество',
      productsTotal: 'ВСЕГО ПРОДУКТОВ',
    },
  };
  const h = headers[lang] || headers['uz-lat'];

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
  }

  const rows = [
    [h.no, h.name, h.code, h.days, h.total, h.paid, h.remaining]
  ];

  data.employees.forEach((e, i) => {
    const fullName = e.firstName + (e.lastName && e.lastName !== '-' ? ' ' + e.lastName : '');
    rows.push([i + 1, fullName, e.code, e.totalDays, e.totalEarning, e.paidAmount || 0, e.remainingAmount || 0]);
  });

  const totals = { 'uz-lat': 'JAMI', 'uz-cyr': 'ЖАМИ', 'ru': 'ИТОГО' };
  rows.push(['', totals[lang] || 'JAMI', '',
    data.employees.reduce((s, e) => s + e.totalDays, 0),
    data.stats.totalEarning, data.stats.totalPaid || 0, data.stats.totalRemaining || 0]);

  const employeesEndRow = rows.length;
  rows.push(['']);
  rows.push(['']);

  const productsTitleRow = rows.length;
  rows.push([h.productsTitle, '', '', '', '', '', '']);
  rows.push(['']);

  const productsHeaderRow = rows.length;
  rows.push([h.no, h.date, h.productName, h.quantity, '', '', '']);

  const productsList = data.products || [];
  if (productsList.length > 0) {
    productsList.forEach((p, i) => {
      rows.push([i + 1, fmtDate(p.dateString), p.productName, p.quantity, '', '', '']);
    });
    const totalProducts = productsList.reduce((s, p) => s + (p.quantity || 0), 0);
    rows.push(['', h.productsTotal, '', totalProducts, '', '', '']);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 22 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 15 },
  ];

  for (let C = 0; C <= 6; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '6D28D9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  for (let R = 1; R <= employeesEndRow - 1; R++) {
    for (const C of [4, 5, 6]) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) {
        ws[cellAddr].t = 'n';
        ws[cellAddr].z = '#,##0';
      }
    }
  }

  const totalRowIdx = employeesEndRow - 1;
  for (let C = 0; C <= 6; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c: C });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: 'F3E8FF' } },
        alignment: { horizontal: C === 1 ? 'left' : 'center', vertical: 'center' },
      };
      if ([4, 5, 6].includes(C)) {
        ws[cellAddr].t = 'n';
        ws[cellAddr].z = '#,##0';
      }
    }
  }

  if (productsList.length > 0) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: productsTitleRow, c: 0 }, e: { r: productsTitleRow, c: 6 } });

    const titleAddr = XLSX.utils.encode_cell({ r: productsTitleRow, c: 0 });
    if (ws[titleAddr]) {
      ws[titleAddr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill: { fgColor: { rgb: '7C3AED' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }

    for (let C = 0; C <= 3; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: productsHeaderRow, c: C });
      if (ws[cellAddr]) {
        ws[cellAddr].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          fill: { fgColor: { rgb: '8B5CF6' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }

    productsList.forEach((p, i) => {
      const r = productsHeaderRow + 1 + i;
      const isAlt = i % 2 === 1;
      const bgColor = isAlt ? 'F8FAFC' : 'FFFFFF';
      for (let C = 0; C <= 3; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c: C });
        if (ws[cellAddr]) {
          ws[cellAddr].s = {
            font: { sz: 11 },
            alignment: { horizontal: C === 2 ? 'left' : 'center', vertical: 'center' },
            fill: { fgColor: { rgb: bgColor } },
            border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
          };
        }
      }
      const qtyAddr = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws[qtyAddr]) {
        ws[qtyAddr].t = 'n';
        ws[qtyAddr].z = '#,##0';
        ws[qtyAddr].s.font = { sz: 11, bold: true, color: { rgb: '6D28D9' } };
      }
    });

    const totalProductsRow = productsHeaderRow + 1 + productsList.length;
    for (let C = 0; C <= 3; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: totalProductsRow, c: C });
      if (ws[cellAddr]) {
        ws[cellAddr].s = {
          font: { bold: true, sz: 12, color: { rgb: '6D28D9' } },
          fill: { fgColor: { rgb: 'F3E8FF' } },
          alignment: { horizontal: C === 3 ? 'center' : 'left', vertical: 'center', indent: 1 },
        };
        if (C === 3) {
          ws[cellAddr].t = 'n';
          ws[cellAddr].z = '#,##0';
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, h.sheetName.slice(0, 31));
  const period = data.period;
  const fileName = `${h.sheetName}_${period.startDate}_${period.endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
  toast(t('msg.exportSuccess'), 'success');
}

function exportEmployeeDetailToExcel() {
  if (!state.monthlyData || !state.monthlyData.employees || state.monthlyData.employees.length !== 1) {
    toast(t('msg.error'), 'error');
    return;
  }

  const lang = localStorage.getItem('cc_lang') || 'uz-lat';
  const emp = state.monthlyData.employees[0];

  const labels = {
    'uz-lat': {
      title: "XODIM MA'LUMOTI", name: 'Ism', code: 'Kod', period: 'Davr',
      total: 'Jami', paid: 'Berilgan', remaining: 'Qolgan', days: 'kun',
      detailTitle: "KUNLIK MA'LUMOT",
      date: 'Sana', dept: "Bo'lim", direction: "Yo'nalish",
      shift: 'Smena', earning: 'Daromad', status: 'Holat',
      paidStatus: '✓ Berilgan', notPaidStatus: '—', sheetName: 'Hisobot',
    },
    'uz-cyr': {
      title: 'ХОДИМ МАЪЛУМОТИ', name: 'Исм', code: 'Код', period: 'Давр',
      total: 'Жами', paid: 'Берилган', remaining: 'Қолган', days: 'кун',
      detailTitle: 'КУНЛИК МАЪЛУМОТ',
      date: 'Сана', dept: 'Бўлим', direction: 'Йўналиш',
      shift: 'Смена', earning: 'Даромад', status: 'Ҳолат',
      paidStatus: '✓ Берилган', notPaidStatus: '—', sheetName: 'Ҳисобот',
    },
    'ru': {
      title: 'ИНФОРМАЦИЯ О СОТРУДНИКЕ', name: 'Имя', code: 'Код', period: 'Период',
      total: 'Всего', paid: 'Выплачено', remaining: 'Остаток', days: 'дн.',
      detailTitle: 'ДЕТАЛЬНАЯ ИНФОРМАЦИЯ',
      date: 'Дата', dept: 'Отдел', direction: 'Направление',
      shift: 'Смена', earning: 'Доход', status: 'Статус',
      paidStatus: '✓ Выплачено', notPaidStatus: '—', sheetName: 'Отчёт',
    },
  };
  const L = labels[lang] || labels['uz-lat'];

  const fullName = emp.firstName + (emp.lastName && emp.lastName !== '-' ? ' ' + emp.lastName : '');
  const period = state.monthlyData.period;

  function fmtDate(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  const rows = [];
  rows.push([L.title, '', '', '', '', '']);
  rows.push(['', '', '', '', '', '']);
  rows.push([L.name + ':', fullName, '', '', '', '']);
  rows.push([L.code + ':', emp.code, '', '', '', '']);
  rows.push([L.period + ':', `${fmtDate(period.startDate)} — ${fmtDate(period.endDate)}`, '', '', '', '']);
  rows.push(['', '', '', '', '', '']);
  rows.push([L.total, '', L.paid, '', L.remaining, '']);
  rows.push([emp.totalEarning, '', emp.paidAmount || 0, '', emp.remainingAmount || 0, '']);
  rows.push([
    `${emp.totalDays} ${L.days}`, '',
    `${emp.paidDays || 0} ${L.days}`, '',
    `${emp.remainingDays || 0} ${L.days}`, ''
  ]);
  rows.push(['', '', '', '', '', '']);
  rows.push([L.detailTitle, '', '', '', '', '']);
  rows.push(['', '', '', '', '', '']);
  rows.push([L.date, L.dept, L.direction, L.shift, L.earning, L.status]);

  emp.days.forEach(day => {
    rows.push([
      fmtDate(day.dateString || day.date),
      day.departmentName || '—',
      day.directionName || '',
      day.shift === 0.5 ? '½' : day.shift,
      day.earning,
      day.isPaid ? L.paidStatus : L.notPaidStatus,
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 18 },
    { wch: 10 }, { wch: 16 }, { wch: 16 },
  ];

  ws['!rows'] = [
    { hpt: 28 }, { hpt: 8 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 8 },
    { hpt: 22 }, { hpt: 32 }, { hpt: 18 }, { hpt: 12 }, { hpt: 24 }, { hpt: 8 }, { hpt: 24 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 5 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
    { s: { r: 6, c: 2 }, e: { r: 6, c: 3 } },
    { s: { r: 6, c: 4 }, e: { r: 6, c: 5 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
    { s: { r: 7, c: 2 }, e: { r: 7, c: 3 } },
    { s: { r: 7, c: 4 }, e: { r: 7, c: 5 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    { s: { r: 8, c: 2 }, e: { r: 8, c: 3 } },
    { s: { r: 8, c: 4 }, e: { r: 8, c: 5 } },
    { s: { r: 10, c: 0 }, e: { r: 10, c: 5 } },
  ];

  if (ws['A1']) {
    ws['A1'].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
      fill: { fgColor: { rgb: '6D28D9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  for (let r = 2; r <= 4; r++) {
    const labelCell = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelCell]) {
      ws[labelCell].s = {
        font: { bold: true, sz: 11, color: { rgb: '6D28D9' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { fgColor: { rgb: 'F3E8FF' } },
      };
    }
    const valueCell = XLSX.utils.encode_cell({ r, c: 1 });
    if (ws[valueCell]) {
      ws[valueCell].s = {
        font: { sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }
  }

  for (let c = 0; c <= 5; c += 2) {
    const cellAddr = XLSX.utils.encode_cell({ r: 6, c });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: 10, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'F8FAFC' } },
      };
    }
  }

  const statColors = ['1E293B', '059669', 'D97706'];
  for (let i = 0; i < 3; i++) {
    const c = i * 2;
    const cellAddr = XLSX.utils.encode_cell({ r: 7, c });
    if (ws[cellAddr]) {
      ws[cellAddr].t = 'n';
      ws[cellAddr].z = '#,##0';
      ws[cellAddr].s = {
        font: { bold: true, sz: 16, color: { rgb: statColors[i] } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'FFFFFF' } },
      };
    }
  }

  for (let c = 0; c <= 5; c += 2) {
    const cellAddr = XLSX.utils.encode_cell({ r: 8, c });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { sz: 9, color: { rgb: '94A3B8' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  if (ws['A11']) {
    ws['A11'].s = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '6D28D9' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
  }

  for (let c = 0; c <= 5; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 12, c });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '7C3AED' } },
        alignment: {
          horizontal: c === 0 || c === 1 || c === 2 ? 'left' : 'center',
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: 'C4B5FD' } },
          bottom: { style: 'thin', color: { rgb: 'C4B5FD' } },
        },
      };
    }
  }

  emp.days.forEach((day, i) => {
    const r = 13 + i;
    const isAlt = i % 2 === 1;
    const bgColor = isAlt ? 'F8FAFC' : 'FFFFFF';

    [0, 1, 2].forEach(c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.s = {
          font: { sz: 11 },
          alignment: { horizontal: 'left', vertical: 'center', indent: c === 0 ? 1 : 0 },
          fill: { fgColor: { rgb: bgColor } },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
        };
      }
    });

    const shiftCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (shiftCell) {
      shiftCell.s = {
        font: { sz: 11, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: bgColor } },
        border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      };
    }

    const earnAddr = XLSX.utils.encode_cell({ r, c: 4 });
    if (ws[earnAddr]) {
      ws[earnAddr].t = 'n';
      ws[earnAddr].z = '#,##0';
      ws[earnAddr].s = {
        font: { sz: 11, bold: true, color: { rgb: '059669' } },
        alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
        fill: { fgColor: { rgb: bgColor } },
        border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      };
    }

    const statusCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (statusCell) {
      statusCell.s = {
        font: { sz: 11, color: { rgb: day.isPaid ? '059669' : '94A3B8' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: bgColor } },
        border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, L.sheetName.slice(0, 31));
  const fileName = `${fullName}_${period.startDate}_${period.endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
  toast(t('msg.exportSuccess'), 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupLangSwitchers();
  setupLogin();
  setupSidebar();
  setupModalCloseButtons();
  setupConfirmModal();
  setupEmployeesPage();
  setupDirectionsPage();
  setupDailyReportPage();
  setupMonthlyReportPage();
  setupArchivePage();
  setupEarningEdit();

  applyStaticTranslations();

  if (state.token) {
    initApp();
  } else {
    showLogin();
  }
});