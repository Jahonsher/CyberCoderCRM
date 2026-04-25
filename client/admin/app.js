/**
 * CyberCoderCRM - Admin Application (SPA)
 * Bitta fayl ichida 5 sahifa + dinamik sidebar + white-label
 */

// ============================================
// CONFIG
// ============================================
const API_BASE = window.API_BASE || '';

function apiUrl(path) {
  if (!API_BASE) return path;
  return API_BASE.replace(/\/$/, '') + path;
}

// ============================================
// STORAGE KEYS
// ============================================
const STORAGE = {
  token: 'cc_admin_token',
  user: 'cc_admin_user',
};

// ============================================
// MODULE ICONS
// ============================================
const MODULE_ICONS = {
  employees: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  directions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  dailyReport: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  monthlyReport: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>`,
  archive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

// ============================================
// STATE
// ============================================
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
  monthSelected: new Set(),
  archives: [],

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
  // translations.js global _t funksiyasini chaqiradi
  if (window.TRANSLATIONS) {
    const lang = localStorage.getItem('cc_lang') || 'uz-lat';
    const dict = window.TRANSLATIONS[lang] || window.TRANSLATIONS['uz-lat'];
    return (dict && dict[key]) || key;
  }
  return key;
}

// ============================================
// THEME MANAGEMENT (Dark/Light)
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
  const current = getCurrentTheme();
  const newTheme = current === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function updateThemeButton() {
  const theme = getCurrentTheme();
  const iconDark = document.getElementById('themeIconDark');
  const iconLight = document.getElementById('themeIconLight');
  const text = document.getElementById('themeText');

  if (!iconDark || !iconLight || !text) return;

  if (theme === 'dark') {
    // Dark mode - show sun icon (click to go light)
    iconDark.classList.remove('hidden');
    iconLight.classList.add('hidden');
    text.textContent = t('theme.light');
  } else {
    // Light mode - show moon icon (click to go dark)
    iconDark.classList.add('hidden');
    iconLight.classList.remove('hidden');
    text.textContent = t('theme.dark');
  }
}

function setupThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  // Dastlab saqlangan theme'ni tatbiq qilish
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
      if (typeof window.setLang === 'function') {
        window.setLang(lang);
      }
      updateLangButtonsActive();
      updateThemeButton();  // Theme button text til bilan

      // Sidebar ni qayta chizish (modul nomlari til bilan)
      if (state.business && state.business.enabledModules) {
        buildSidebar(state.business.enabledModules, state.business.modulesInfo || []);
        // Active nav item ni qaytarish
        if (state.currentPage) {
          document.querySelectorAll('[data-page]').forEach(el => {
            el.classList.toggle('active', el.dataset.page === state.currentPage);
          });
        }
      }

      // Joriy sahifani qayta chizish
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
    ? window.getCurrentLang()
    : 'uz-lat';

  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function applyStaticTranslations() {
  if (typeof window.applyTranslations === 'function') {
    window.applyTranslations();
  }
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

      if (!res.ok || !data.success) {
        throw new Error(data.error || t('msg.loginWrong'));
      }

      if (data.user.role !== 'admin') {
        throw new Error('SuperAdmin: /superadmin/');
      }

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE.token, data.token);
      localStorage.setItem(STORAGE.user, JSON.stringify(data.user));

      if (data.user.defaultLanguage && typeof window.setLang === 'function') {
        const savedLang = localStorage.getItem('cc_lang');
        if (!savedLang) {
          window.setLang(data.user.defaultLanguage);
        }
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

// ============================================
// LOGOUT
// ============================================

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
    // Logo Railway'dan yuklanadi
    const logoUrl = apiUrl(`/uploads/${business.logo}`);
    logoEl.innerHTML = `<img src="${logoUrl}" alt="${escapeHtml(business.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'logo-placeholder w-full h-full\\'>${firstLetter}</div>'" />`;
  } else {
    logoEl.innerHTML = `<div class="logo-placeholder w-full h-full">${firstLetter}</div>`;
  }

  document.getElementById('businessName').textContent = business.name;
}

// ============================================
// DYNAMIC SIDEBAR
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
// SPA ROUTER
// ============================================

function navigateTo(pageKey) {
  if (!state.business || !state.business.enabledModules.includes(pageKey)) {
    const firstPage = state.business?.enabledModules?.[0];
    if (firstPage) {
      pageKey = firstPage;
    } else {
      return;
    }
  }

  state.currentPage = pageKey;

  // Update active nav item
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageKey);
  });

  // Update header
  document.getElementById('pageTitle').textContent = t(`nav.${pageKey}`);
  document.getElementById('pageSubtitle').textContent = '';
  document.getElementById('headerActions').innerHTML = '';

  // Show only active page
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.dataset.page === pageKey);
  });

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.add('hidden');

  // Apply static translations
  applyStaticTranslations();

  // Load page data
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
// PAGE: EMPLOYEES
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
  // lastName hidden - eski qiymat saqlanadi
  document.getElementById('empLastName').value = emp.lastName || '-';
  document.getElementById('empCode').value = emp.code || '';
  document.getElementById('empPhone').value = emp.phone || '';
  openModal('empModal');
}

function confirmDeleteEmployee(id, name) {
  openConfirm(
    t('emp.deleteConfirm'),
    `"${name}" — ${t('emp.deleteWarn')}`,
    async () => {
      try {
        await api(`/api/employees/${id}`, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        loadEmployees();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

// ============================================
// PAGE: DIRECTIONS
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

    // Default - birinchi bo'limni tanlash
    if (departments.length > 0 && !state.selectedDepartmentId) {
      selectDepartment(departments[0]._id);
    } else if (state.selectedDepartmentId) {
      // Tanlangan bo'lim bor bo'lsa, qayta ko'rsatish
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

  // Click handlers
  container.querySelectorAll('.dept-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Actions tugmalarga bosilganda bo'lim tanlanmasin
      if (e.target.closest('[data-act]')) return;
      const deptId = card.dataset.deptId;
      selectDepartment(deptId);
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

  // Update active card
  document.querySelectorAll('.dept-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.deptId === deptId);
  });

  // Update title
  if (dept) {
    document.getElementById('currentDeptName').textContent = dept.name;
    document.getElementById('currentDeptHint').textContent = `${dept.directionCount || 0} ${t('dept.directionCount')}`;
  }

  // Load directions
  loadDirections(deptId);
}

function renderDirections(directions) {
  const container = document.getElementById('dirTableContainer');

  if (!state.selectedDepartmentId) {
    container.innerHTML = `
      <div class="p-10 text-center text-zinc-500">
        <p class="text-sm">${t('dir.selectDept')}</p>
      </div>
    `;
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
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('dir.table.type')}</th>
            <th>${t('dir.table.price')}</th>
            <th class="text-right">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${directions.map(d => `
            <tr>
              <td class="font-medium">${escapeHtml(d.name)}</td>
              <td class="mono"><span class="text-purple-300">${formatMoney(d.currentPrice)}</span> <span class="text-zinc-500 text-xs">so'm</span></td>
              <td class="text-right whitespace-nowrap">
                <button type="button" data-act="dir-edit" data-id="${d._id}" class="btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button type="button" data-act="dir-delete" data-id="${d._id}" data-name="${escapeHtml(d.name)}" class="btn-icon danger ml-1">
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
      if (action === 'dir-edit') openDirEdit(id);
      else if (action === 'dir-delete') confirmDeleteDirection(id, btn.dataset.name);
    });
  });
}

function setupDirectionsPage() {
  // Department add button
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

  // Department form submit
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
          await api(`/api/departments/${state.editingDeptId}`, {
            method: 'PUT', body: JSON.stringify(body)
          });
        } else {
          await api('/api/departments', {
            method: 'POST', body: JSON.stringify(body)
          });
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

  // Direction add
  document.getElementById('dirAddBtn').addEventListener('click', () => {
    if (!state.selectedDepartmentId) {
      toast(t('dept.selectFirst'), 'error');
      return;
    }

    state.editingDirId = null;
    document.getElementById('dirForm').reset();
    document.getElementById('dirEditingId').value = '';
    document.getElementById('dirModalTitle').textContent = t('dir.add');
    document.getElementById('dirPriceWarning').classList.add('hidden');

    // Department dropdown to'ldirish
    fillDepartmentSelect('dirDepartment', state.selectedDepartmentId);

    openModal('dirModal');
  });

  document.getElementById('dirPrice').addEventListener('input', () => {
    if (!state.editingDirId) return;
    const dir = state.directions.find(d => d._id === state.editingDirId);
    if (!dir) return;
    const newPrice = Number(document.getElementById('dirPrice').value);
    const warning = document.getElementById('dirPriceWarning');
    warning.classList.toggle('hidden', newPrice === dir.currentPrice);
  });

  document.getElementById('dirForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('dirSubmitBtn');
    const spinner = document.getElementById('dirSubmitSpinner');

    const body = {
      name: document.getElementById('dirName').value.trim(),
      currentPrice: Number(document.getElementById('dirPrice').value),
      departmentId: document.getElementById('dirDepartment').value,
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
      loadDirections();
    } catch (err) {
      toast(err.message || t('msg.error'), 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function openDirEdit(id) {
  const dir = state.directions.find(d => d._id === id);
  if (!dir) return;
  state.editingDirId = id;
  document.getElementById('dirEditingId').value = id;
  document.getElementById('dirModalTitle').textContent = t('dir.edit');
  document.getElementById('dirName').value = dir.name || '';
  document.getElementById('dirPrice').value = dir.currentPrice || 0;
  document.getElementById('dirPriceWarning').classList.add('hidden');

  // Department dropdown
  const deptId = dir.departmentId?._id || dir.departmentId || state.selectedDepartmentId;
  fillDepartmentSelect('dirDepartment', deptId);

  openModal('dirModal');
}

// ============================================
// DEPARTMENT HELPER FUNCTIONS
// ============================================

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
        const url = hasDirections
          ? `/api/departments/${id}?force=true`
          : `/api/departments/${id}`;
        await api(url, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');

        // Agar o'chirilgan bo'lim tanlangan bo'lsa - null qilish
        if (state.selectedDepartmentId === id) {
          state.selectedDepartmentId = null;
        }

        loadDepartments();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

function confirmDeleteDirection(id, name) {
  openConfirm(
    t('dir.deleteConfirm'),
    `"${name}" — ${t('dir.deleteWarn')}`,
    async () => {
      try {
        await api(`/api/directions/${id}`, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        loadDirections();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

// ============================================
// PAGE: DAILY REPORT
// ============================================

async function loadDailyReport(dateStr) {
  // dateStr - YYYY-MM-DD formatda (ixtiyoriy)
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

  // Label - to'liq sana
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


async function openAssignModal(employeeId, employeeName) {
  document.getElementById('assignEmployeeId').value = employeeId;
  document.getElementById('assignEmployeeName').textContent = employeeName;

  // Departmentlarni yuklash
  if (state.departments.length === 0) {
    try {
      const depts = await api('/api/departments');
      if (depts) state.departments = depts;
    } catch (err) {}
  }

  fillDepartmentSelect('assignDepartment', '');

  const dirSelect = document.getElementById('assignDirection');
  dirSelect.innerHTML = '<option value="">—</option>';
  dirSelect.disabled = true;

  document.querySelector('input[name="shift"][value="1"]').checked = true;

  // Default work type = piecework
  const pwRadio = document.querySelector('input[name="workType"][value="piecework"]');
  if (pwRadio) pwRadio.checked = true;

  // Daily amount yashirilsin va tozalansin
  const wrap = document.getElementById('assignDailyAmountWrap');
  if (wrap) wrap.classList.add('hidden');
  const amtInput = document.getElementById('assignDailyAmount');
  if (amtInput) {
    amtInput.value = '';
    amtInput.required = false;
  }

  openModal('assignModal');
}

async function loadDirectionsForAssign(departmentId) {
  const dirSelect = document.getElementById('assignDirection');
  dirSelect.innerHTML = '<option value="">—</option>';

  if (!departmentId) {
    dirSelect.disabled = true;
    return;
  }

  try {
    const directions = await api(`/api/directions?departmentId=${departmentId}`);
    if (directions && directions.length > 0) {
      dirSelect.innerHTML = '<option value="">—</option>' +
        directions.map(d =>
          `<option value="${d._id}">${escapeHtml(d.name)} — ${formatMoney(d.currentPrice)}</option>`
        ).join('');
      dirSelect.disabled = false;
    } else {
      dirSelect.disabled = true;
    }
  } catch (err) {
    console.error('Directions load error:', err);
  }
}

function setupDailyReportPage() {
  // Department change - direction yuklash
  const deptSelect = document.getElementById('assignDepartment');
  if (deptSelect) {
    deptSelect.addEventListener('change', () => {
      loadDirectionsForAssign(deptSelect.value);
    });
  }

  // Work type radio - dailyAmount maydonini ko'rsatish/yashirish
  document.querySelectorAll('input[name="workType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const wrap = document.getElementById('assignDailyAmountWrap');
      const dailyAmtInput = document.getElementById('assignDailyAmount');
      if (radio.value === 'daily' && radio.checked) {
        wrap.classList.remove('hidden');
        dailyAmtInput.required = true;
      } else if (radio.value === 'piecework' && radio.checked) {
        wrap.classList.add('hidden');
        dailyAmtInput.required = false;
        dailyAmtInput.value = '';
      }
    });
  });

  // Date controls
  const dateInput = document.getElementById('dailyDateInput');
  if (dateInput) {
    // Maksimal sana - bugun (kelajakni cheklash)
    dateInput.max = todayISO();

    dateInput.addEventListener('change', () => {
      // Kelajak sanani rad qilish
      if (dateInput.value > todayISO()) {
        toast(t('daily.futureNotAllowed') || "Kelajakdagi kun mumkin emas", 'error');
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

      // Kelajak sanani rad qilish
      if (newDate > todayISO()) {
        toast(t('daily.futureNotAllowed') || "Kelajakdagi kun mumkin emas", 'error');
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

  document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('assignSubmitBtn');
    const spinner = document.getElementById('assignSubmitSpinner');

    const workType = document.querySelector('input[name="workType"]:checked')?.value || 'piecework';
    const dailyAmount = workType === 'daily'
      ? Number(document.getElementById('assignDailyAmount').value || 0)
      : 0;

    if (workType === 'daily' && (isNaN(dailyAmount) || dailyAmount <= 0)) {
      toast(t('daily.dailyAmountRequired') || "Kunlik summa kiriting", 'error');
      return;
    }

    // MUHIM: state.dailyDate har doim to'g'ri sana bilan bo'lsin
    const currentDate = state.dailyDate || todayISO();

    const body = {
      employeeId: document.getElementById('assignEmployeeId').value,
      directionId: document.getElementById('assignDirection').value,
      shift: document.querySelector('input[name="shift"]:checked').value,
      date: currentDate,  // ALWAYS send the date
      type: workType,
      dailyAmount: dailyAmount,
    };

    if (!body.directionId) {
      toast(t('daily.direction'), 'error');
      return;
    }

    console.log('📤 Assign yuborilyapti:', { date: body.date, type: body.type, dailyAmount: body.dailyAmount });

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

    console.log('📤 Product yuborilyapti:', { date: body.date });

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


// ============================================
// EARNING EDIT (3-talab: qo'lda narx tahrirlash)
// ============================================

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
        method: 'PUT',
        body: JSON.stringify({ earning }),
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
  openConfirm(
    t('common.delete'),
    t('common.confirm'),
    async () => {
      try {
        await api(`/api/daily-report/products/${id}`, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        loadDailyReport(state.dailyDate);
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

// ============================================
// PAGE: MONTHLY REPORT
// ============================================

function initMonthlyReport() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  document.getElementById('monthStart').value = startOfMonth.toISOString().split('T')[0];
  document.getElementById('monthEnd').value = now.toISOString().split('T')[0];

  loadMonthlyReport();
}

function setupMonthlyReportPage() {
  const today = todayISO();
  const d = new Date();
  d.setDate(1);
  const monthStart = d.toISOString().split('T')[0];

  document.getElementById('monthStart').value = monthStart;
  document.getElementById('monthEnd').value = today;

  document.getElementById('monthLoadBtn').addEventListener('click', loadMonthlyReport);

  // Presets
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

  // Select all checkbox
  const selectAllCb = document.getElementById('monthSelectAll');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      const checked = selectAllCb.checked;
      state.monthSelected.clear();

      document.querySelectorAll('.pay-checkbox').forEach(cb => {
        const row = cb.closest('.emp-row');
        if (row && row.classList.contains('paid')) return; // Paidlarga tegmaymiz

        cb.checked = checked;
        if (checked) state.monthSelected.add(cb.dataset.employeeId);
      });

      updateMonthActionBar();
    });
  }

  // Pay button
  const payBtn = document.getElementById('monthPayBtn');
  if (payBtn) {
    payBtn.addEventListener('click', openPayModal);
  }

  // Pay form submit
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

  // Reset selection
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
  // Stats
  document.getElementById('monthStatEarning').textContent = formatMoney(data.stats.totalEarning);
  document.getElementById('monthStatEmployees').textContent = data.stats.totalEmployees;
  document.getElementById('monthStatPaid').textContent = data.stats.totalPaid || 0;
  document.getElementById('monthStatProducts').textContent = data.stats.totalProductCount;

  const container = document.getElementById('monthResultsContainer');
  const actionBar = document.getElementById('monthActionBar');
  const detailsContainer = document.getElementById('monthDetailsContainer');

  // Agar xodimlar yo'q bo'lsa
  if (!data.employees || data.employees.length === 0) {
    container.innerHTML = `<div class="p-10 text-center text-zinc-500"><p class="text-sm">${t('month.empty')}</p></div>`;
    actionBar.classList.add('hidden');
    detailsContainer.classList.add('hidden');
    return;
  }

  // Agar bitta xodim (kod bo'yicha qidirilgan) - batafsil ko'rinish
  const isSingleEmployee = data.employees.length === 1 && document.getElementById('monthCode').value.trim();

  if (isSingleEmployee) {
    const emp = data.employees[0];
    const fullName = emp.firstName + (emp.lastName && emp.lastName !== '-' ? ' ' + emp.lastName : '');

    // Summary (ro'yxat)
    container.innerHTML = `
      <div class="p-5">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div class="font-bold text-lg">${escapeHtml(fullName)}</div>
            <div class="mono text-xs text-zinc-500 mt-1">
              <span class="text-purple-300">${escapeHtml(emp.code)}</span>
              · ${emp.totalDays} kun · ${emp.totalShifts} smena
              ${emp.isPaid ? `<span class="paid-badge ml-2">✓ ${t('month.paidBadge')}</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <div class="mono text-xs text-zinc-500">${t('month.totalEarning')}</div>
            <div class="text-2xl font-bold text-emerald-400">${formatMoney(emp.totalEarning)}</div>
          </div>
        </div>
      </div>
    `;

    // Details table - har kun alohida
    detailsContainer.classList.remove('hidden');
    document.getElementById('monthDetailsSubtitle').textContent = `${escapeHtml(emp.code)} · ${emp.totalDays} ${t('common.days') || 'kun'}`;
    document.getElementById('monthDetailsTable').innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('common.date') || 'Sana'}</th>
              <th>${t('dept.title')}</th>
              <th>${t('daily.direction')}</th>
              <th class="text-center">${t('daily.shift') || 'Smena'}</th>
              <th class="text-right">${t('daily.earning') || 'Daromad'}</th>
            </tr>
          </thead>
          <tbody>
            ${emp.days.map(day => `
              <tr>
                <td class="mono text-sm">${formatDate(day.date)}</td>
                <td class="text-sm text-zinc-400">${escapeHtml(day.departmentName || '—')}</td>
                <td class="text-sm">${escapeHtml(day.directionName)}</td>
                <td class="mono text-sm text-center">${day.shift === 0.5 ? '½' : '1'}</td>
                <td class="mono font-semibold text-emerald-400 text-right">${formatMoney(day.earning)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    actionBar.classList.add('hidden');
    return;
  }

  // Oddiy ro'yxat (checkbox + pay)
  detailsContainer.classList.add('hidden');
  actionBar.classList.remove('hidden');

  // Select all reset
  document.getElementById('monthSelectAll').checked = false;

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 50px"></th>
            <th>${t('emp.table.name')}</th>
            <th>${t('emp.table.code')}</th>
            <th class="text-center">${t('common.days') || 'Kunlar'}</th>
            <th class="text-center">${t('common.shifts') || 'Smena'}</th>
            <th class="text-right">${t('month.totalEarning')}</th>
            <th class="text-center">${t('common.status') || 'Holat'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.employees.map(e => {
            const fullName = e.firstName + (e.lastName && e.lastName !== '-' ? ' ' + e.lastName : '');
            return `
              <tr class="emp-row ${e.isPaid ? 'paid' : ''}" data-employee-id="${e.employeeId}">
                <td>
                  <input type="checkbox" class="pay-checkbox" data-employee-id="${e.employeeId}" ${e.isPaid ? 'disabled' : ''} />
                </td>
                <td class="font-medium">${escapeHtml(fullName)}</td>
                <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
                <td class="mono text-center">${e.totalDays}</td>
                <td class="mono text-center">${e.totalShifts}</td>
                <td class="mono font-semibold text-emerald-400 text-right">${formatMoney(e.totalEarning)}</td>
                <td class="text-center">
                  ${e.isPaid
                    ? `<span class="paid-badge">✓ ${t('month.paidBadge')}</span>`
                    : `<span class="mono text-xs text-zinc-500">${t('month.unpaidBadge')}</span>`}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Checkbox handlerlar
  container.querySelectorAll('.pay-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const empId = cb.dataset.employeeId;
      if (cb.checked) {
        state.monthSelected.add(empId);
      } else {
        state.monthSelected.delete(empId);
      }
      updateMonthActionBar();
    });
  });

  updateMonthActionBar();
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
    const result = await api('/api/monthly-report/pay', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result) {
      const msg = `${t('month.paySuccess')}: ${result.paidCount}` +
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
  // Stats
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

  // Oy oy ko'rsatish
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

  // Delete button handlers
  container.querySelectorAll('[data-act="archive-delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      confirmDeleteArchive(id, name);
    });
  });
}

function formatMonthLabel(periodMonth) {
  // YYYY-MM format
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
  openConfirm(
    t('archive.deleteConfirm'),
    `"${name}" — ${t('archive.deleteWarn')}`,
    async () => {
      try {
        await api(`/api/archive/${id}`, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        loadArchive();
      } catch (err) {
        toast(err.message || t('msg.error'), 'error');
      }
    }
  );
}

function setupArchivePage() {
  const loadBtn = document.getElementById('archiveLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadArchive);
  }

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

// ============================================
// SIDEBAR
// ============================================

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

// ============================================
// INIT
// ============================================

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
      if (!savedLang) {
        window.setLang(me.defaultLanguage);
      }
    }
    updateLangButtonsActive();

    applyBranding(me);
    buildSidebar(me.enabledModules || [], me.modulesInfo || []);

    showApp();

    const firstModule = me.enabledModules?.[0];
    if (firstModule) {
      navigateTo(firstModule);
    }

    applyStaticTranslations();
  } catch (err) {
    console.error('Init error:', err);
    logout();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();  // Theme birinchi navbatda
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
  setupEarningEdit();  // 3-talab

  applyStaticTranslations();

  if (state.token) {
    initApp();
  } else {
    showLogin();
  }
});