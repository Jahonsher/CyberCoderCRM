/**
 * CyberCoderCRM — SuperAdmin App (v2)
 * Admin panel bilan bir xil dizayn-til + komponentlar.
 */

const API_BASE = window.API_BASE || '';
const STORAGE = { token: 'cc_super_token', user: 'cc_super_user' };
const THEME_KEY = 'cc_theme';

const state = {
  token: localStorage.getItem(STORAGE.token) || null,
  user: null,
  businesses: [],
  allModules: [],
  editingId: null,
  deleteTargetId: null,
  logoFile: null,
  selectedModules: new Set(),
};

// ============================================
// UTILS
// ============================================
function apiUrl(p) { return (API_BASE || '').replace(/\/$/, '') + p; }
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  const headers = { Authorization: `Bearer ${state.token}`, ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(apiUrl(endpoint), { ...opts, headers });
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
  if (el) el.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
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
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return;

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
      if (!res.ok || !data.success) throw new Error(data.error || "Login yoki parol noto'g'ri");
      if (data.user.role !== 'superadmin') throw new Error("Faqat SuperAdmin uchun. Admin panelga o'ting.");

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(STORAGE.token, data.token);
      localStorage.setItem(STORAGE.user, JSON.stringify(data.user));

      btnText.textContent = 'Welcome!';
      setTimeout(() => initApp(), 300);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
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
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.remove('hidden');
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.add('hidden');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Chiqishni tasdiqlaysizmi?')) logout();
  });
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

// ============================================
// DATA LOADING
// ============================================
async function loadStats() {
  try {
    const stats = await api('/api/superadmin/stats');
    document.getElementById('statTotal').textContent = stats.totalBusinesses;
    document.getElementById('statActive').textContent = stats.activeBusinesses;
    document.getElementById('statSuspended').textContent = stats.suspendedBusinesses;
    document.getElementById('statEmployees').textContent = stats.totalEmployees;
  } catch (e) { console.error('Stats:', e); }
}

async function loadModules() {
  try { state.allModules = await api('/api/superadmin/modules'); }
  catch (e) { state.allModules = []; }
}

async function loadBusinesses() {
  const loadingEl = document.getElementById('loadingState');
  const emptyEl = document.getElementById('emptyState');
  const gridEl = document.getElementById('businessesGrid');
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  gridEl.classList.add('hidden');

  try {
    state.businesses = await api('/api/superadmin/businesses');
    loadingEl.classList.add('hidden');
    if (state.businesses.length === 0) { emptyEl.classList.remove('hidden'); return; }
    renderBusinesses(state.businesses);
    gridEl.classList.remove('hidden');
  } catch (e) {
    loadingEl.classList.add('hidden');
    toast('Yuklashda xato: ' + e.message, 'error');
  }
}

// ============================================
// RENDER BUSINESSES
// ============================================
function renderBusinesses(businesses) {
  const gridEl = document.getElementById('businessesGrid');
  if (businesses.length === 0) {
    gridEl.innerHTML = '<div class="col-span-full text-center py-12 text-zinc-500">Topilmadi</div>';
    return;
  }
  gridEl.innerHTML = businesses.map(b => renderCard(b)).join('');
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

function renderCard(b) {
  const firstLetter = (b.name || '?').charAt(0).toUpperCase();
  const logoHtml = b.logo
    ? `<img src="${escapeHtml(apiUrl(b.logo.charAt(0) === '/' ? b.logo : '/uploads/' + b.logo))}" alt="${escapeHtml(b.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'logo-placeholder w-full h-full\\'>${firstLetter}</div>'" />`
    : `<div class="logo-placeholder w-full h-full">${firstLetter}</div>`;
  const statusBadge = b.status === 'active'
    ? '<span class="badge badge-active"><span class="dot"></span>ACTIVE</span>'
    : '<span class="badge badge-suspended"><span class="dot"></span>SUSPENDED</span>';
  const suspendIcon = b.status === 'active'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const moduleCount = (b.enabledModules || []).length;

  return `
    <div class="biz-card ${b.status === 'suspended' ? 'suspended' : ''}">
      <div class="flex items-start gap-4 mb-4">
        <div class="w-16 h-16 rounded-2xl overflow-hidden shrink-0">${logoHtml}</div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-lg truncate">${escapeHtml(b.name)}</h3>
          <div class="mono text-xs text-zinc-500 truncate mb-2">Kod: ${escapeHtml(b.login)}</div>
          ${statusBadge}
        </div>
      </div>

      <div class="space-y-2 mb-3 pt-4 border-t border-purple-500/10">
        <div class="flex items-center gap-2 text-sm text-zinc-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-500"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
          <span class="mono text-xs truncate">${escapeHtml(b.phone)}</span>
        </div>
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span class="mono text-xs text-zinc-400">${b.stats?.employees || 0} xodim</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span class="mono text-xs text-zinc-400">${moduleCount} modul</span>
          </div>
        </div>
      </div>

      <div class="flex gap-2 pt-3 border-t border-purple-500/10">
        <button data-action="edit" data-id="${b._id}" class="btn-icon flex-1" title="Tahrirlash">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span class="ml-2 text-sm">Tahrirlash</span>
        </button>
        <button data-action="suspend" data-id="${b._id}" class="btn-icon" title="${b.status === 'active' ? "To'xtatish" : 'Yoqish'}">${suspendIcon}</button>
        <button data-action="delete" data-id="${b._id}" data-name="${escapeHtml(b.name)}" class="btn-icon danger" title="O'chirish">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>`;
}

// ============================================
// SEARCH
// ============================================
function setupSearch() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return renderBusinesses(state.businesses);
    const filtered = state.businesses.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.login || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q)
    );
    renderBusinesses(filtered);
  });
}

// ============================================
// MODULES (toza ro'yxat — guruhsiz)
// ============================================
function renderModulesInForm() {
  const container = document.getElementById('modulesContainer');
  container.innerHTML = state.allModules.map(m => {
    const enabled = state.selectedModules.has(m.key);
    return `
      <div class="module-toggle ${enabled ? 'enabled' : ''}" data-module="${m.key}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm">${escapeHtml(m.name)}</div>
          <div class="mono text-[10px] text-zinc-500 mt-0.5 truncate">${escapeHtml(m.description || m.key)}</div>
        </div>
        <div class="switch ${enabled ? 'on' : ''}"></div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-module]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.module;
      if (state.selectedModules.has(key)) state.selectedModules.delete(key);
      else state.selectedModules.add(key);
      renderModulesInForm();
    });
  });
}

// ============================================
// BUSINESS MODAL
// ============================================
function openCreateModal() {
  state.editingId = null;
  state.logoFile = null;
  state.selectedModules = new Set(state.allModules.filter(m => m.default).map(m => m.key));

  document.getElementById('businessForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('modalTitle').textContent = 'Yangi biznes';
  document.getElementById('passwordLabel').textContent = 'Parol *';
  document.getElementById('passwordHint').classList.add('hidden');
  document.getElementById('f_password').required = true;
  document.getElementById('submitModalText').textContent = 'Yaratish';

  resetLogoPreview();
  renderModulesInForm();
  openModal('businessModal');
  setTimeout(() => document.getElementById('f_name').focus(), 100);
}

function openEditModal(id) {
  const biz = state.businesses.find(b => b._id === id);
  if (!biz) return;

  state.editingId = id;
  state.logoFile = null;
  state.selectedModules = new Set(biz.enabledModules || []);

  document.getElementById('editingId').value = id;
  document.getElementById('modalTitle').textContent = 'Biznesni tahrirlash';
  document.getElementById('passwordLabel').textContent = 'Yangi parol';
  document.getElementById('passwordHint').classList.remove('hidden');
  document.getElementById('f_password').required = false;
  document.getElementById('submitModalText').textContent = 'Saqlash';

  document.getElementById('f_name').value = biz.name || '';
  document.getElementById('f_phone').value = biz.phone || '';
  document.getElementById('f_password').value = '';
  document.getElementById('f_language').value = biz.defaultLanguage || 'uz-lat';
  document.getElementById('f_note').value = biz.note || '';

  const preview = document.getElementById('logoPreview');
  if (biz.logo) {
    const src = apiUrl(biz.logo.charAt(0) === '/' ? biz.logo : '/uploads/' + biz.logo);
    preview.innerHTML = `<img src="${escapeHtml(src)}" alt="logo" class="w-full h-full object-cover" />`;
  } else {
    resetLogoPreview();
  }

  renderModulesInForm();
  openModal('businessModal');
}

function resetLogoPreview() {
  document.getElementById('logoPreview').innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-400">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`;
}

function setupBusinessModal() {
  document.getElementById('createBtn').addEventListener('click', openCreateModal);
  document.getElementById('emptyCreateBtn').addEventListener('click', openCreateModal);
  document.getElementById('closeModalBtn').addEventListener('click', () => closeModal('businessModal'));
  document.getElementById('cancelModalBtn').addEventListener('click', () => closeModal('businessModal'));

  document.getElementById('logoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Fayl 2MB dan oshmasligi kerak', 'error'); e.target.value = ''; return; }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast('Faqat PNG, JPG yoki WEBP', 'error'); e.target.value = ''; return;
    }
    state.logoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('logoPreview').innerHTML = `<img src="${ev.target.result}" alt="logo" class="w-full h-full object-cover" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('businessForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitModalBtn');
    const text = document.getElementById('submitModalText');
    const spinner = document.getElementById('submitModalSpinner');

    const pw = document.getElementById('f_password').value.trim();
    if (pw && !/^\d+$/.test(pw)) {
      toast('Parol faqat raqamlardan iborat bo\'lishi kerak', 'error');
      return;
    }
    if (!state.editingId && (!pw || pw.length < 4)) {
      toast('Parol kamida 4 raqam bo\'lishi kerak', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('name', document.getElementById('f_name').value.trim());
    fd.append('phone', document.getElementById('f_phone').value.trim());
    if (pw) fd.append('password', pw);
    fd.append('defaultLanguage', document.getElementById('f_language').value);
    fd.append('note', document.getElementById('f_note').value.trim());
    fd.append('enabledModules', JSON.stringify(Array.from(state.selectedModules)));
    if (state.logoFile) fd.append('logo', state.logoFile);

    btn.disabled = true;
    text.textContent = state.editingId ? 'Saqlanmoqda...' : 'Yaratilmoqda...';
    spinner.classList.remove('hidden');

    try {
      const endpoint = state.editingId
        ? `/api/superadmin/businesses/${state.editingId}`
        : '/api/superadmin/businesses';
      const method = state.editingId ? 'PUT' : 'POST';
      await api(endpoint, { method, body: fd });
      toast(state.editingId ? 'Yangilandi ✓' : 'Yaratildi ✓');
      closeModal('businessModal');
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
// SUSPEND
// ============================================
async function toggleSuspend(id) {
  const biz = state.businesses.find(b => b._id === id);
  if (!biz) return;
  const action = biz.status === 'active' ? "to'xtatish" : 'faollashtirish';
  if (!confirm(`"${biz.name}" ni ${action}ni tasdiqlaysizmi?`)) return;

  try {
    const result = await api(`/api/superadmin/businesses/${id}/suspend`, { method: 'POST' });
    toast(result.message || 'Holat o\'zgartirildi');
    await loadBusinesses();
    await loadStats();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// DELETE
// ============================================
function confirmDelete(id, name) {
  state.deleteTargetId = id;
  document.getElementById('confirmText').textContent =
    `"${name}" biznes va BARCHA ma'lumotlari (xodimlar, yo'nalishlar, hisobotlar, to'lovlar) butunlay o'chiriladi. Bu amal qaytarilmaydi!`;
  openModal('confirmModal');
}

function setupConfirmModal() {
  document.getElementById('cancelConfirmBtn').addEventListener('click', () => { closeModal('confirmModal'); state.deleteTargetId = null; });
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
      toast("Biznes o'chirildi");
      closeModal('confirmModal');
      state.deleteTargetId = null;
      await loadBusinesses();
      await loadStats();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      text.textContent = "O'chirish";
      spinner.classList.add('hidden');
    }
  });
}

// ============================================
// MODALS
// ============================================
function openModal(id) {
  document.getElementById(id).classList.add('flex');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('flex');
  document.body.style.overflow = '';
}
function setupModalCloses() {
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.flex').forEach(m => closeModal(m.id));
  });
}

// ============================================
// INIT
// ============================================
async function initApp() {
  try {
    const me = await api('/api/auth/me');
    if (!me || me.role !== 'superadmin') { logout(); return; }
    state.user = me;
    document.getElementById('userName').textContent = me.username;
    showApp();
    await loadModules();
    await loadBusinesses();
    await loadStats();
    setInterval(loadStats, 60000);
  } catch (err) {
    console.error('Init:', err);
    logout();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme());
  setupLogin();
  setupSidebar();
  setupSearch();
  setupBusinessModal();
  setupConfirmModal();
  setupModalCloses();
  if (state.token) initApp();
  else showLogin();
});
