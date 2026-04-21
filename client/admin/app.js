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
  dailyData: null,
  monthData: null,
  archives: [],

  editingEmpId: null,
  editingDirId: null,
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
      // Refresh current page content
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
    case 'directions': loadDirections(); break;
    case 'dailyReport': loadDailyReport(); break;
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
            <th>${t('emp.table.lastName')}</th>
            <th>${t('emp.table.code')}</th>
            <th>${t('emp.table.phone')}</th>
            <th class="text-right">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(e => `
            <tr>
              <td class="font-medium">${escapeHtml(e.firstName)}</td>
              <td>${escapeHtml(e.lastName)}</td>
              <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
              <td class="mono text-sm text-zinc-400">${escapeHtml(e.phone || '—')}</td>
              <td class="text-right whitespace-nowrap">
                <button type="button" data-act="emp-edit" data-id="${e._id}" class="btn-icon" title="${t('common.edit')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button type="button" data-act="emp-delete" data-id="${e._id}" data-name="${escapeHtml(e.firstName + ' ' + e.lastName)}" class="btn-icon danger ml-1" title="${t('common.delete')}">
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
      lastName: document.getElementById('empLastName').value.trim(),
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
  document.getElementById('empLastName').value = emp.lastName || '';
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

async function loadDirections() {
  const container = document.getElementById('dirTableContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';

  try {
    const directions = await api('/api/directions');
    if (!directions) return;
    state.directions = directions;
    renderDirections(directions);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderDirections(directions) {
  const container = document.getElementById('dirTableContainer');

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
  document.getElementById('dirAddBtn').addEventListener('click', () => {
    state.editingDirId = null;
    document.getElementById('dirForm').reset();
    document.getElementById('dirEditingId').value = '';
    document.getElementById('dirModalTitle').textContent = t('dir.add');
    document.getElementById('dirPriceWarning').classList.add('hidden');
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
  openModal('dirModal');
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

async function loadDailyReport() {
  try {
    const data = await api('/api/daily-report');
    if (!data) return;
    state.dailyData = data;
    renderDailyReport(data);
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

function renderDailyReport(data) {
  document.getElementById('dailyStatAssigned').textContent = data.stats.totalAssigned;
  document.getElementById('dailyStatUnassigned').textContent = data.stats.totalUnassigned;
  document.getElementById('dailyStatEarning').textContent = formatMoney(data.stats.totalEarning);
  document.getElementById('dailyStatProducts').textContent = data.stats.totalProducts;
  document.getElementById('todayDateLabel').textContent = formatDate(data.date);

  const assignedEl = document.getElementById('assignedList');
  if (data.assigned.length === 0) {
    assignedEl.innerHTML = `<div class="text-center text-zinc-500 text-sm py-8">${t('daily.emptyAssigned')}</div>`;
  } else {
    assignedEl.innerHTML = `<div class="space-y-2">${data.assigned.map(a => `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${escapeHtml(a.employeeSnapshot.firstName)} ${escapeHtml(a.employeeSnapshot.lastName)}</div>
          <div class="mono text-xs text-zinc-500 mt-0.5 truncate">
            <span class="text-purple-300">${escapeHtml(a.employeeSnapshot.code)}</span>
            · ${escapeHtml(a.directionSnapshot.name)}
            · ${a.shift === 0.5 ? '½' : '1'}
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="mono text-sm font-semibold text-emerald-400">${formatMoney(a.earning)}</div>
        </div>
        <button type="button" data-act="unassign" data-id="${a._id}" class="btn-icon danger">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('')}</div>`;

    assignedEl.querySelectorAll('[data-act="unassign"]').forEach(btn => {
      btn.addEventListener('click', () => unassignEmployee(btn.dataset.id));
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
    loadDailyReport();
  } catch (err) {
    toast(err.message || t('msg.error'), 'error');
  }
}

async function openAssignModal(employeeId, employeeName) {
  document.getElementById('assignEmployeeId').value = employeeId;
  document.getElementById('assignEmployeeName').textContent = employeeName;

  if (state.directions.length === 0) {
    try {
      const directions = await api('/api/directions');
      if (directions) state.directions = directions;
    } catch (err) {}
  }

  const select = document.getElementById('assignDirection');
  select.innerHTML = '<option value="">—</option>' +
    state.directions.map(d =>
      `<option value="${d._id}">${escapeHtml(d.name)} — ${formatMoney(d.currentPrice)}</option>`
    ).join('');

  document.querySelector('input[name="shift"][value="1"]').checked = true;
  openModal('assignModal');
}

function setupDailyReportPage() {
  document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('assignSubmitBtn');
    const spinner = document.getElementById('assignSubmitSpinner');

    const body = {
      employeeId: document.getElementById('assignEmployeeId').value,
      directionId: document.getElementById('assignDirection').value,
      shift: document.querySelector('input[name="shift"]:checked').value,
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
      loadDailyReport();
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

    const body = {
      productName: document.getElementById('productName').value.trim(),
      quantity: Number(document.getElementById('productQty').value),
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
      loadDailyReport();
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

function confirmDeleteProduct(id) {
  openConfirm(
    t('common.delete'),
    t('common.confirm'),
    async () => {
      try {
        await api(`/api/daily-report/products/${id}`, { method: 'DELETE' });
        toast(t('msg.deleted'), 'success');
        loadDailyReport();
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
  document.getElementById('monthLoadBtn').addEventListener('click', loadMonthlyReport);

  document.getElementById('monthArchiveBtn').addEventListener('click', () => {
    const startDate = document.getElementById('monthStart').value;
    const endDate = document.getElementById('monthEnd').value;

    if (!startDate || !endDate) {
      toast(t('msg.error'), 'error');
      return;
    }

    openConfirm(
      t('month.archive'),
      t('month.archiveConfirm'),
      async () => {
        try {
          await api('/api/monthly-report/archive', {
            method: 'POST',
            body: JSON.stringify({ startDate, endDate }),
          });
          toast(t('month.archived'), 'success');
        } catch (err) {
          toast(err.message || t('msg.error'), 'error');
        }
      },
      'btn-primary'
    );
  });

  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const now = new Date();
      let start, end;

      if (preset === 'today') { start = end = now; }
      else if (preset === 'yesterday') { start = end = new Date(now.getTime() - 86400000); }
      else if (preset === 'week') { start = new Date(now.getTime() - 7 * 86400000); end = now; }
      else if (preset === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }

      document.getElementById('monthStart').value = start.toISOString().split('T')[0];
      document.getElementById('monthEnd').value = end.toISOString().split('T')[0];
      loadMonthlyReport();
    });
  });
}

async function loadMonthlyReport() {
  const startDate = document.getElementById('monthStart').value;
  const endDate = document.getElementById('monthEnd').value;
  const code = document.getElementById('monthCode').value.trim();

  if (!startDate || !endDate) return;

  const container = document.getElementById('monthResultsContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-48"></div></div>';

  try {
    let url = `/api/monthly-report?startDate=${startDate}&endDate=${endDate}`;
    if (code) url += `&code=${encodeURIComponent(code)}`;

    const data = await api(url);
    if (!data) return;
    state.monthData = data;

    document.getElementById('monthStatEarning').textContent = formatMoney(data.stats.totalEarning);
    document.getElementById('monthStatEmployees').textContent = data.stats.totalEmployees;
    document.getElementById('monthStatProducts').textContent = data.stats.totalProductCount;

    renderMonthlyReport(data);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderMonthlyReport(data) {
  const container = document.getElementById('monthResultsContainer');

  if (data.employees.length === 0) {
    container.innerHTML = `<div class="p-10 text-center text-zinc-500 text-sm">${t('month.empty')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('emp.table.name')}</th>
            <th>${t('emp.table.code')}</th>
            <th>${t('month.totalDays')}</th>
            <th>${t('month.totalShifts')}</th>
            <th>${t('month.totalEarning')}</th>
          </tr>
        </thead>
        <tbody>
          ${data.employees.map(e => `
            <tr>
              <td class="font-medium">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td>
              <td><span class="mono text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">${escapeHtml(e.code)}</span></td>
              <td class="mono">${e.totalDays}</td>
              <td class="mono">${e.totalShifts}</td>
              <td class="mono font-semibold text-emerald-400">${formatMoney(e.totalEarning)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================
// PAGE: ARCHIVE
// ============================================

async function loadArchive() {
  const container = document.getElementById('archiveContainer');
  container.innerHTML = '<div class="p-6"><div class="skeleton h-32"></div></div>';

  try {
    const archives = await api('/api/archive');
    if (!archives) return;
    state.archives = archives;
    renderArchive(archives);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-red-400">${escapeHtml(err.message)}</div>`;
  }
}

function renderArchive(archives) {
  const container = document.getElementById('archiveContainer');

  if (archives.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
            <polyline points="21 8 21 21 3 21 3 8"/>
            <rect x="1" y="3" width="22" height="5"/>
          </svg>
        </div>
        <h3 class="font-bold mb-1">${t('archive.empty')}</h3>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('archive.period')}</th>
            <th>${t('archive.archivedAt')}</th>
            <th>${t('month.totalEarning')}</th>
            <th>${t('nav.employees')}</th>
          </tr>
        </thead>
        <tbody>
          ${archives.map(a => `
            <tr>
              <td class="font-medium">${escapeHtml(a.periodLabel)}</td>
              <td class="mono text-xs text-zinc-400">${formatDate(a.archivedAt, { withTime: true })}</td>
              <td class="mono font-semibold text-emerald-400">${formatMoney(a.stats?.totalEarnings || 0)}</td>
              <td class="mono">${a.stats?.totalEmployeesWorked || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
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

  ['empModal', 'dirModal', 'assignModal', 'productModal', 'confirmModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) closeModal(id);
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['empModal', 'dirModal', 'assignModal', 'productModal', 'confirmModal'].forEach(id => {
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
  setupLangSwitchers();
  setupLogin();
  setupSidebar();
  setupModalCloseButtons();
  setupConfirmModal();
  setupEmployeesPage();
  setupDirectionsPage();
  setupDailyReportPage();
  setupMonthlyReportPage();

  applyStaticTranslations();

  if (state.token) {
    initApp();
  } else {
    showLogin();
  }
});