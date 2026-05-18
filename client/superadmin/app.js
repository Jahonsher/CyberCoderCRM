const API_BASE = window.API_BASE || "";

function apiUrl(path) {
  if (!API_BASE) return path;
  return API_BASE.replace(/\/$/, "") + path;
}

/**
 * CyberCoderCRM - SuperAdmin Application
 * YANGI: enabledWorkTypes (piecework + daily) qo'shildi
 */

const STORAGE = {
  token: 'cc_sa_token',
  user: 'cc_sa_user',
};

const state = {
  token: localStorage.getItem(STORAGE.token) || null,
  user: null,
  businesses: [],
  allModules: [],
  editingId: null,
  deleteTargetId: null,
  logoFile: null,
  selectedModules: new Set(),
  // YANGI: ish turlari (default ikkalasi yoqilgan)
  workTypes: { piecework: true, daily: true },
};

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
    text.textContent = 'Light Mode';
  } else {
    iconDark.classList.add('hidden');
    iconLight.classList.remove('hidden');
    text.textContent = 'Dark Mode';
  }
}

function setupThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  setTheme(getCurrentTheme());
}

// ============================================
// UTILS
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  const headers = {
    Authorization: `Bearer ${state.token}`,
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(apiUrl(endpoint), { ...options, headers });
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
    console.error(`API error [${endpoint}]:`, err);
    throw err;
  }
}

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
  const togglePwBtn = document.getElementById('togglePassword');
  const pwInput = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');

  togglePwBtn.addEventListener('click', () => {
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
      errorEl.textContent = 'Username va parolni kiriting';
      errorEl.classList.remove('hidden');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Signing in...';
    spinner.classList.remove('hidden');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Login yoki parol noto'g'ri");
      }
      if (data.user.role !== 'superadmin') {
        throw new Error("Faqat SuperAdmin uchun. Admin panelga o'ting.");
      }

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE.token, data.token);
      localStorage.setItem(STORAGE.user, JSON.stringify(data.user));

      btnText.textContent = 'Welcome!';
      spinner.classList.add('hidden');
      setTimeout(() => initApp(), 300);
    } catch (err) {
      errorEl.textContent = err.message || 'Xato';
      errorEl.classList.remove('hidden');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
      btn.disabled = false;
      btnText.textContent = 'Sign In';
      spinner.classList.add('hidden');
    }
  });
}

function logout() {
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.user);
  state.token = null;
  state.user = null;
  showLogin();
}

// ============================================
// SIDEBAR
// ============================================

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggle = document.getElementById('menuToggle');

  toggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.remove('hidden');
  });

  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.add('hidden');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Chiqishni tasdiqlaysizmi?')) logout();
  });
}

// ============================================
// DATA LOADING
// ============================================

async function loadStats() {
  try {
    const stats = await api('/api/superadmin/stats');
    if (!stats) return;
    document.getElementById('statTotal').textContent = stats.totalBusinesses;
    document.getElementById('statActive').textContent = stats.activeBusinesses;
    document.getElementById('statSuspended').textContent = stats.suspendedBusinesses;
    document.getElementById('statEmployees').textContent = stats.totalEmployees;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function loadModules() {
  try {
    const modules = await api('/api/superadmin/modules');
    state.allModules = modules || [];
  } catch (err) {
    console.error('Modules error:', err);
  }
}

async function loadBusinesses() {
  const loadingEl = document.getElementById('loadingState');
  const emptyEl = document.getElementById('emptyState');
  const gridEl = document.getElementById('businessesGrid');

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  gridEl.classList.add('hidden');

  try {
    const businesses = await api('/api/superadmin/businesses');
    if (!businesses) return;
    state.businesses = businesses;

    loadingEl.classList.add('hidden');

    if (businesses.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    renderBusinesses(businesses);
    gridEl.classList.remove('hidden');
  } catch (err) {
    loadingEl.classList.add('hidden');
    toast('Yuklashda xato: ' + err.message, 'error');
  }
}

// ============================================
// BUSINESS CARD RENDER
// ============================================

function renderBusinesses(businesses) {
  const gridEl = document.getElementById('businessesGrid');
  if (businesses.length === 0) {
    gridEl.innerHTML = '<div class="col-span-full text-center py-12 text-zinc-500">Topilmadi</div>';
    return;
  }

  gridEl.innerHTML = businesses.map((b, idx) => renderBusinessCard(b, idx)).join('');

  gridEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (action === 'edit') openEditModal(id);
      else if (action === 'suspend') toggleSuspend(id);
      else if (action === 'delete') confirmDelete(id, name);
    });
  });
}

function renderBusinessCard(b, idx) {
  const firstLetter = (b.name || '?').charAt(0).toUpperCase();
  const logoHtml = b.logo
    ? `<img src="${apiUrl('/uploads/' + escapeHtml(b.logo))}" alt="${escapeHtml(b.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'logo-placeholder w-full h-full\\'>${firstLetter}</div>'" />`
    : `<div class="logo-placeholder w-full h-full">${firstLetter}</div>`;

  const statusBadge = b.status === 'active'
    ? '<span class="badge badge-active"><span class="dot"></span>ACTIVE</span>'
    : '<span class="badge badge-suspended"><span class="dot"></span>SUSPENDED</span>';

  const moduleCount = (b.enabledModules || []).length;

  // YANGI: Ish turlari badge
  const wt = b.enabledWorkTypes || { piecework: true, daily: true };
  const workTypeBadges = [];
  if (wt.piecework) {
    workTypeBadges.push(`<span class="mono text-[10px] px-2 py-1 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300">Shtuk</span>`);
  }
  if (wt.daily) {
    workTypeBadges.push(`<span class="mono text-[10px] px-2 py-1 rounded" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399;">Kunlik</span>`);
  }

  const suspendIcon = b.status === 'active'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

  return `
    <div class="biz-card fade-in ${b.status === 'suspended' ? 'suspended' : ''}" style="animation-delay: ${idx * 0.04}s">
      <div class="flex items-start gap-4 mb-4">
        <div class="w-16 h-16 rounded-2xl overflow-hidden shrink-0 text-2xl">${logoHtml}</div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-lg truncate">${escapeHtml(b.name)}</h3>
          <div class="mono text-xs text-zinc-500 truncate">@${escapeHtml(b.login)}</div>
          ${statusBadge}
        </div>
      </div>

      <div class="space-y-2 mb-3 pt-4 border-t border-purple-500/10">
        <div class="flex items-center gap-2 text-sm text-zinc-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-500">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          <span class="mono text-xs truncate">${escapeHtml(b.phone)}</span>
        </div>

        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <span class="mono text-xs text-zinc-400">${b.stats?.employees || 0} xodim</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span class="mono text-xs text-zinc-400">${moduleCount} modul</span>
          </div>
        </div>

        <!-- YANGI: Ish turlari -->
        <div class="flex items-center gap-1.5 flex-wrap pt-1">
          ${workTypeBadges.join('')}
        </div>
      </div>

      <div class="flex gap-2 pt-3 border-t border-purple-500/10">
        <button data-action="edit" data-id="${b._id}" class="btn-icon flex-1" title="Tahrirlash">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span class="ml-2 text-sm">Tahrirlash</span>
        </button>
        <button data-action="suspend" data-id="${b._id}" class="btn-icon" title="${b.status === 'active' ? "To'xtatish" : 'Yoqish'}">
          ${suspendIcon}
        </button>
        <button data-action="delete" data-id="${b._id}" data-name="${escapeHtml(b.name)}" class="btn-icon danger" title="O'chirish">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// SEARCH
// ============================================

function setupSearch() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderBusinesses(state.businesses);
      return;
    }
    const filtered = state.businesses.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.login || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q)
    );
    renderBusinesses(filtered);
  });
}

// ============================================
// MODULES
// ============================================

function renderModulesInForm() {
  const container = document.getElementById('modulesContainer');
  container.innerHTML = state.allModules.map(mod => {
    const enabled = state.selectedModules.has(mod.key);
    return `
      <div class="module-toggle ${enabled ? 'enabled' : ''}" data-module="${mod.key}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm">${escapeHtml(mod.name)}</div>
          <div class="mono text-[10px] text-zinc-500 mt-0.5">${escapeHtml(mod.key)}</div>
        </div>
        <div class="switch ${enabled ? 'on' : ''}"></div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-module]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.module;
      if (state.selectedModules.has(key)) {
        state.selectedModules.delete(key);
      } else {
        state.selectedModules.add(key);
      }
      renderModulesInForm();
    });
  });
}

// ============================================
// YANGI: WORK TYPES TOGGLE
// ============================================

function renderWorkTypes() {
  const pwCard = document.getElementById('wt_pieceworkCard');
  const pwSwitch = document.getElementById('wt_pieceworkSwitch');
  const dCard = document.getElementById('wt_dailyCard');
  const dSwitch = document.getElementById('wt_dailySwitch');

  if (pwCard) {
    pwCard.classList.toggle('enabled', state.workTypes.piecework);
    pwSwitch.classList.toggle('on', state.workTypes.piecework);
  }
  if (dCard) {
    dCard.classList.toggle('enabled', state.workTypes.daily);
    dSwitch.classList.toggle('on', state.workTypes.daily);
  }
}

function setupWorkTypeToggles() {
  const pwCard = document.getElementById('wt_pieceworkCard');
  const dCard = document.getElementById('wt_dailyCard');

  if (pwCard) {
    pwCard.addEventListener('click', () => {
      state.workTypes.piecework = !state.workTypes.piecework;
      // Kamida bittasi yoqilgan bo'lishi kerak
      if (!state.workTypes.piecework && !state.workTypes.daily) {
        state.workTypes.piecework = true;
        toast("Kamida bitta ish turi yoqilgan bo'lishi kerak", 'error');
      }
      renderWorkTypes();
    });
  }

  if (dCard) {
    dCard.addEventListener('click', () => {
      state.workTypes.daily = !state.workTypes.daily;
      if (!state.workTypes.piecework && !state.workTypes.daily) {
        state.workTypes.daily = true;
        toast("Kamida bitta ish turi yoqilgan bo'lishi kerak", 'error');
      }
      renderWorkTypes();
    });
  }
}

// ============================================
// MODAL: CREATE/EDIT
// ============================================

function openCreateModal() {
  state.editingId = null;
  state.logoFile = null;
  state.selectedModules = new Set(
    state.allModules.filter(m => m.default).map(m => m.key)
  );
  // YANGI: default ikkalasi yoqilgan
  state.workTypes = { piecework: true, daily: true };

  document.getElementById('businessForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('modalTitle').textContent = 'Yangi biznes';
  document.getElementById('passwordLabel').textContent = 'Parol *';
  document.getElementById('passwordHint').classList.add('hidden');
  document.getElementById('f_password').required = true;
  document.getElementById('submitModalText').textContent = 'Yaratish';

  resetLogoPreview();
  renderModulesInForm();
  renderWorkTypes();

  const modal = document.getElementById('businessModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('f_name').focus(), 100);
}

function openEditModal(id) {
  const biz = state.businesses.find(b => b._id === id);
  if (!biz) return;

  state.editingId = id;
  state.logoFile = null;
  state.selectedModules = new Set(biz.enabledModules || []);
  // YANGI: biznes ish turlarini olamiz
  state.workTypes = {
    piecework: biz.enabledWorkTypes?.piecework !== false,
    daily: biz.enabledWorkTypes?.daily !== false,
  };

  document.getElementById('editingId').value = id;
  document.getElementById('modalTitle').textContent = 'Biznesni tahrirlash';
  document.getElementById('passwordLabel').textContent = 'Yangi parol';
  document.getElementById('passwordHint').classList.remove('hidden');
  document.getElementById('f_password').required = false;
  document.getElementById('submitModalText').textContent = 'Saqlash';

  document.getElementById('f_name').value = biz.name || '';
  document.getElementById('f_phone').value = biz.phone || '';
  document.getElementById('f_login').value = biz.login || '';
  document.getElementById('f_password').value = '';
  document.getElementById('f_language').value = biz.defaultLanguage || 'uz-lat';
  document.getElementById('f_note').value = biz.note || '';

  const preview = document.getElementById('logoPreview');
  if (biz.logo) {
    preview.innerHTML = `<img src="${apiUrl('/uploads/' + escapeHtml(biz.logo))}" alt="logo" class="w-full h-full object-cover" />`;
  } else {
    resetLogoPreview();
  }

  renderModulesInForm();
  renderWorkTypes();

  const modal = document.getElementById('businessModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeBusinessModal() {
  const modal = document.getElementById('businessModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  state.editingId = null;
  state.logoFile = null;
}

function resetLogoPreview() {
  document.getElementById('logoPreview').innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  `;
}

function setupBusinessModal() {
  const modal = document.getElementById('businessModal');

  document.getElementById('createBtn').addEventListener('click', openCreateModal);
  document.getElementById('emptyCreateBtn').addEventListener('click', openCreateModal);

  document.getElementById('closeModalBtn').addEventListener('click', closeBusinessModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeBusinessModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBusinessModal();
  });

  document.getElementById('logoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Fayl 2MB dan oshmasligi kerak', 'error');
      e.target.value = '';
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast('Faqat PNG, JPG yoki WEBP', 'error');
      e.target.value = '';
      return;
    }
    state.logoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('logoPreview').innerHTML =
        `<img src="${ev.target.result}" alt="logo" class="w-full h-full object-cover" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('businessForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('submitModalBtn');
    const text = document.getElementById('submitModalText');
    const spinner = document.getElementById('submitModalSpinner');

    const fd = new FormData();
    fd.append('name', document.getElementById('f_name').value.trim());
    fd.append('phone', document.getElementById('f_phone').value.trim());
    fd.append('login', document.getElementById('f_login').value.trim());

    const pw = document.getElementById('f_password').value;
    if (pw) fd.append('password', pw);

    fd.append('defaultLanguage', document.getElementById('f_language').value);
    fd.append('note', document.getElementById('f_note').value.trim());
    fd.append('enabledModules', JSON.stringify(Array.from(state.selectedModules)));

    // YANGI: ish turlarini yuborish
    fd.append('enabledWorkTypes', JSON.stringify(state.workTypes));

    if (state.logoFile) fd.append('logo', state.logoFile);

    btn.disabled = true;
    text.textContent = state.editingId ? 'Saqlanmoqda...' : 'Yaratilmoqda...';
    spinner.classList.remove('hidden');

    try {
      const endpoint = state.editingId
        ? `/api/superadmin/businesses/${state.editingId}`
        : '/api/superadmin/businesses';
      const method = state.editingId ? 'PUT' : 'POST';

      const result = await api(endpoint, { method, body: fd });
      if (!result) return;

      toast(state.editingId ? 'Yangilandi ✓' : 'Yaratildi ✓', 'success');
      closeBusinessModal();
      await loadBusinesses();
      await loadStats();
    } catch (err) {
      toast(err.message || 'Xato', 'error');
    } finally {
      btn.disabled = false;
      text.textContent = state.editingId ? 'Saqlash' : 'Yaratish';
      spinner.classList.add('hidden');
    }
  });
}

// ============================================
// SUSPEND TOGGLE
// ============================================

async function toggleSuspend(id) {
  const biz = state.businesses.find(b => b._id === id);
  if (!biz) return;
  const action = biz.status === 'active' ? "to'xtatish" : 'faollashtirish';
  if (!confirm(`"${biz.name}" ni ${action}ni tasdiqlaysizmi?`)) return;

  try {
    const result = await api(`/api/superadmin/businesses/${id}/suspend`, {
      method: 'POST',
    });
    if (!result) return;
    toast(result.message, 'success');
    await loadBusinesses();
    await loadStats();
  } catch (err) {
    toast(err.message || 'Xato', 'error');
  }
}

// ============================================
// DELETE
// ============================================

function confirmDelete(id, name) {
  state.deleteTargetId = id;
  document.getElementById('confirmText').textContent =
    `"${name}" biznes va BARCHA ma'lumotlari (xodimlar, yo'nalishlar, hisobotlar, arxivlar) butunlay o'chiriladi. Bu amal qaytarilmaydi!`;

  const modal = document.getElementById('confirmModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  state.deleteTargetId = null;
}

function setupConfirmModal() {
  const modal = document.getElementById('confirmModal');
  document.getElementById('cancelConfirmBtn').addEventListener('click', closeConfirmModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeConfirmModal();
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!state.deleteTargetId) return;

    const btn = document.getElementById('confirmDeleteBtn');
    const text = document.getElementById('confirmDeleteText');
    const spinner = document.getElementById('confirmDeleteSpinner');

    btn.disabled = true;
    text.textContent = "O'chirilmoqda...";
    spinner.classList.remove('hidden');

    try {
      await api(`/api/superadmin/businesses/${state.deleteTargetId}`, { method: 'DELETE' });
      toast("Biznes o'chirildi", 'success');
      closeConfirmModal();
      await loadBusinesses();
      await loadStats();
    } catch (err) {
      toast(err.message || 'Xato', 'error');
    } finally {
      btn.disabled = false;
      text.textContent = "O'chirish";
      spinner.classList.add('hidden');
    }
  });
}

// ============================================
// KEYBOARD
// ============================================

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const bModal = document.getElementById('businessModal');
      const cModal = document.getElementById('confirmModal');
      if (!bModal.classList.contains('hidden')) closeBusinessModal();
      if (!cModal.classList.contains('hidden')) closeConfirmModal();
    }
  });
}

// ============================================
// INIT
// ============================================

async function initApp() {
  try {
    const me = await api('/api/auth/me');
    if (!me || me.role !== 'superadmin') {
      logout();
      return;
    }
    state.user = me;
    document.getElementById('userName').textContent = me.username;

    showApp();

    await loadModules();
    await loadBusinesses();
    await loadStats();

    setInterval(() => loadStats(), 60000);
  } catch (err) {
    console.error('Init error:', err);
    logout();
  }
}

// ============================================
// BOOTSTRAP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupLogin();
  setupSidebar();
  setupSearch();
  setupBusinessModal();
  setupWorkTypeToggles();
  setupConfirmModal();
  setupKeyboard();

  if (state.token) {
    initApp();
  } else {
    showLogin();
  }
});