/**
 * script.js — Pendaftaran Kelompok KIK
 * Telkom School | Google Apps Script Backend
 *
 * Struktur:
 *  1. CONFIG
 *  2. STATE
 *  3. DOM HELPERS
 *  4. TOAST
 *  5. SKELETON LOADER
 *  6. DATA RENDERING
 *  7. VALIDASI FORM
 *  8. SUBMIT HANDLER
 *  9. SEARCH
 * 10. INIT
 */

/* ============================================================
   1. CONFIG — Ganti APPS_SCRIPT_URL dengan URL deploy Anda
   ============================================================ */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_8_EiSXHIJIZCb9ZJ6RaVh0NP1qpRKg8ep7DFroA9vRe9_GYz3tPCCX0ZAajBBCbh/exec';

/* ============================================================
   2. STATE — Data kelompok yang sudah diambil dari spreadsheet
   ============================================================ */
let allGroups = [];   // semua data mentah dari API
let filteredGroups = []; // hasil filter pencarian

/* ============================================================
   3. DOM HELPERS
   ============================================================ */

/** Ambil elemen DOM berdasarkan ID */
const el = (id) => document.getElementById(id);

/** Tambah / hapus class */
const addClass = (elem, ...cls) => elem.classList.add(...cls);
const removeClass = (elem, ...cls) => elem.classList.remove(...cls);

/** Sanitasi string: hilangkan tag HTML dan spasi berlebih */
const sanitize = (str) => str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Format tanggal dari timestamp string */
const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  if (isNaN(d)) return timestamp;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ============================================================
   4. TOAST NOTIFICATION
   ============================================================ */

let toastTimer = null;

/**
 * Tampilkan toast notification
 * @param {string} message  - Pesan
 * @param {'success'|'error'} type - Jenis toast
 */
const showToast = (message, type = 'success') => {
  const toast = el('toast');
  const icon  = el('toast-icon');
  const msg   = el('toast-message');

  // Reset kelas sebelumnya
  removeClass(toast, 'hidden', 'toast-success', 'toast-error');
  toast.classList.add(type === 'success' ? 'toast-success' : 'toast-error');

  icon.textContent = type === 'success' ? '✓' : '✕';
  msg.textContent  = message;

  // Hapus animasi lama agar bisa re-trigger
  toast.style.animation = 'none';
  void toast.offsetWidth; // reflow
  toast.style.animation = '';

  addClass(toast, 'toast'); // pastikan class toast ada
  removeClass(toast, 'hidden');

  // Auto hide setelah 4 detik
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    addClass(toast, 'hidden');
  }, 4000);
};

/* ============================================================
   5. SKELETON LOADER
   ============================================================ */

/** Render skeleton cards sebagai placeholder saat loading */
const showSkeleton = () => {
  const container = el('skeleton-loader');
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    container.innerHTML += `
      <div class="skeleton-card">
        <div class="flex items-center gap-2 mb-4">
          <div class="skeleton w-7 h-7 rounded-full"></div>
          <div class="skeleton h-4 w-32 rounded"></div>
          <div class="skeleton h-5 w-12 rounded-full ml-auto"></div>
        </div>
        <div class="skeleton h-3 w-full rounded mb-2"></div>
        <div class="skeleton h-3 w-4/5 rounded mb-2"></div>
        <div class="skeleton h-3 w-3/5 rounded mb-4"></div>
        <div class="skeleton h-3 w-2/5 rounded"></div>
      </div>`;
  }
  removeClass(container, 'hidden');
};

/** Sembunyikan skeleton loader */
const hideSkeleton = () => {
  el('skeleton-loader').innerHTML = '';
};

/* ============================================================
   6. DATA RENDERING
   ============================================================ */

/**
 * Render semua card kelompok ke DOM
 * @param {Array} groups - Array of group objects
 */
const renderCards = (groups) => {
  const grid       = el('card-grid');
  const emptyCard  = el('empty-card');
  const noResults  = el('no-results-card');
  const totalCount = el('total-count');

  // Update total counter (selalu total semua data)
  totalCount.textContent = allGroups.length;

  // Sembunyikan semua state dulu
  addClass(emptyCard,  'hidden');
  addClass(noResults,  'hidden');
  grid.innerHTML = '';

  const searchQuery = el('search-input').value.trim();

  if (allGroups.length === 0) {
    // Tidak ada data sama sekali
    removeClass(emptyCard, 'hidden');
    return;
  }

  if (groups.length === 0 && searchQuery.length > 0) {
    // Ada data tapi tidak cocok dengan pencarian
    removeClass(noResults, 'hidden');
    return;
  }

  // Render cards dengan delay stagger animasi
  groups.forEach((group, index) => {
    const card = createGroupCard(group, index + 1);
    card.style.animationDelay = `${index * 0.05}s`;
    grid.appendChild(card);
  });
};

/**
 * Buat elemen card kelompok
 * @param {Object} group  - Data satu kelompok
 * @param {number} number - Nomor urut
 * @returns {HTMLElement}
 */
const createGroupCard = (group, number) => {
  const card = document.createElement('div');
  card.className = 'group-card';

  // Badge bidang
  const badgeClass = group.bidang === 'Produk' ? 'badge-produk' : 'badge-jasa';

  card.innerHTML = `
    <!-- Card Header -->
    <div class="flex items-center gap-2 mb-3">
      <div class="card-number">${number}</div>
      <h3 class="font-bold text-gray-800 text-sm flex-1 leading-tight">${escapeHtml(group.namaTim)}</h3>
      <span class="${badgeClass}">${escapeHtml(group.bidang)}</span>
    </div>

    <!-- Divider -->
    <div class="border-t border-gray-100 mb-3"></div>

    <!-- Info Rows -->
    <div class="space-y-1.5">
      <div class="card-info-row">
        <span class="card-info-label">Anggota 1</span>
        <span class="card-info-value">${escapeHtml(group.anggota1)}</span>
      </div>
      <div class="card-info-row">
        <span class="card-info-label">Anggota 2</span>
        <span class="card-info-value">${escapeHtml(group.anggota2)}</span>
      </div>
      <div class="card-info-row">
        <span class="card-info-label">Kosen</span>
        <span class="card-info-value text-gray-500">${escapeHtml(group.kosenProduk)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
      <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-xs text-gray-400">${formatDate(group.timestamp)}</span>
    </div>
  `;

  return card;
};

/**
 * Escape karakter HTML untuk mencegah XSS
 * @param {string} str
 * @returns {string}
 */
const escapeHtml = (str) => {
  if (!str) return '-';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/* ============================================================
   7. VALIDASI FORM
   ============================================================ */

/**
 * Tampilkan pesan error pada field tertentu
 * @param {string} fieldId  - ID error span
 * @param {string} inputId  - ID input elemen
 * @param {string} message  - Pesan error
 */
const showFieldError = (fieldId, inputId, message) => {
  const errorEl = el(fieldId);
  const inputEl = el(inputId);
  errorEl.textContent = message;
  removeClass(errorEl, 'hidden');
  addClass(inputEl, 'input-error');
};

/**
 * Hapus error pada field tertentu
 * @param {string} fieldId
 * @param {string} inputId
 */
const clearFieldError = (fieldId, inputId) => {
  const errorEl = el(fieldId);
  const inputEl = el(inputId);
  errorEl.textContent = '';
  addClass(errorEl, 'hidden');
  removeClass(inputEl, 'input-error');
};

/** Hapus semua pesan error */
const clearAllErrors = () => {
  const fields = ['nama-tim', 'anggota1', 'anggota2', 'nomor-telepon', 'bidang', 'kosen-produk'];
  fields.forEach(f => clearFieldError(`error-${f}`, f));
};

/**
 * Validasi seluruh form
 * @returns {{ valid: boolean, data: Object|null }}
 */
const validateForm = () => {
  clearAllErrors();
  let valid = true;

  const rawNamaTim     = el('nama-tim').value;
  const rawAnggota1    = el('anggota1').value;
  const rawAnggota2    = el('anggota2').value;
  const rawTelepon     = el('nomor-telepon').value;
  const rawBidang      = el('bidang').value;
  const rawKosen       = el('kosen-produk').value;

  const namaTim     = sanitize(rawNamaTim);
  const anggota1    = sanitize(rawAnggota1);
  const anggota2    = sanitize(rawAnggota2);
  const telepon     = rawTelepon.trim().replace(/\s/g, '');
  const bidang      = rawBidang.trim();
  const kosenProduk = sanitize(rawKosen);

  // ── Nama Tim ──
  if (!namaTim) {
    showFieldError('error-nama-tim', 'nama-tim', 'Nama tim tidak boleh kosong.');
    valid = false;
  } else if (namaTim.length > 40) {
    showFieldError('error-nama-tim', 'nama-tim', 'Nama tim maksimal 40 karakter.');
    valid = false;
  } else {
    // Cek duplikasi nama tim (case-insensitive)
    const isDuplicate = allGroups.some(
      g => g.namaTim && g.namaTim.toLowerCase() === namaTim.toLowerCase()
    );
    if (isDuplicate) {
      showFieldError('error-nama-tim', 'nama-tim', 'Nama tim sudah terdaftar. Pilih nama lain.');
      valid = false;
    }
  }

  // ── Anggota 1 ──
  if (!anggota1) {
    showFieldError('error-anggota1', 'anggota1', 'Nama anggota 1 tidak boleh kosong.');
    valid = false;
  } else if (anggota1.length > 50) {
    showFieldError('error-anggota1', 'anggota1', 'Nama maksimal 50 karakter.');
    valid = false;
  }

  // ── Anggota 2 ──
  if (!anggota2) {
    showFieldError('error-anggota2', 'anggota2', 'Nama anggota 2 tidak boleh kosong.');
    valid = false;
  } else if (anggota2.length > 50) {
    showFieldError('error-anggota2', 'anggota2', 'Nama maksimal 50 karakter.');
    valid = false;
  }

  // ── Nomor Telepon ──
  if (!telepon) {
    showFieldError('error-nomor-telepon', 'nomor-telepon', 'Nomor telepon tidak boleh kosong.');
    valid = false;
  } else if (!/^[0-9]+$/.test(telepon)) {
    showFieldError('error-nomor-telepon', 'nomor-telepon', 'Nomor telepon hanya boleh berisi angka.');
    valid = false;
  } else if (!telepon.startsWith('08')) {
    showFieldError('error-nomor-telepon', 'nomor-telepon', 'Nomor telepon harus diawali 08.');
    valid = false;
  } else if (telepon.length < 10 || telepon.length > 13) {
    showFieldError('error-nomor-telepon', 'nomor-telepon', 'Nomor telepon 10–13 digit.');
    valid = false;
  } else {
    // Cek duplikasi nomor telepon
    const isDupPhone = allGroups.some(g => g.nomorTelepon === telepon);
    if (isDupPhone) {
      showFieldError('error-nomor-telepon', 'nomor-telepon', 'Nomor telepon sudah terdaftar.');
      valid = false;
    }
  }

  // ── Bidang ──
  if (!bidang) {
    showFieldError('error-bidang', 'bidang', 'Pilih bidang terlebih dahulu.');
    valid = false;
  }

  // ── Kosen Produk ──
  if (!kosenProduk) {
    showFieldError('error-kosen-produk', 'kosen-produk', 'Kosen produk/jasa tidak boleh kosong.');
    valid = false;
  } else if (kosenProduk.length > 150) {
    showFieldError('error-kosen-produk', 'kosen-produk', 'Kosen produk maksimal 150 karakter.');
    valid = false;
  }

  if (!valid) return { valid: false, data: null };

  return {
    valid: true,
    data: { namaTim, anggota1, anggota2, nomorTelepon: telepon, bidang, kosenProduk }
  };
};

/* ============================================================
   8. SUBMIT HANDLER & API CALLS
   ============================================================ */

/**
 * Ubah state tombol submit
 * @param {boolean} loading - true = loading, false = normal
 */
const setSubmitLoading = (loading) => {
  const btn     = el('submit-btn');
  const spinner = el('submit-spinner');
  const text    = el('submit-text');

  if (loading) {
    btn.disabled = true;
    removeClass(spinner, 'hidden');
    text.textContent = 'Menyimpan...';
  } else {
    btn.disabled = false;
    addClass(spinner, 'hidden');
    text.textContent = 'Daftarkan Kelompok';
  }
};

/**
 * Kirim data ke Google Apps Script via GET + URLSearchParams.
 * Google Apps Script Web App lebih andal dengan metode GET
 * karena tidak ada preflight CORS yang bisa memblokir request.
 *
 * Urutan parameter SESUAI kolom spreadsheet:
 * A=Timestamp (otomatis), B=namaTim, C=anggota1, D=anggota2,
 * E=nomorTelepon, F=bidang, G=kosenProduk
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const submitData = async (data) => {
  const params = new URLSearchParams({
    action:       'submit',
    namaTim:      data.namaTim,
    anggota1:     data.anggota1,
    anggota2:     data.anggota2,
    nomorTelepon: data.nomorTelepon,
    bidang:       data.bidang,
    kosenProduk:  data.kosenProduk,
  });

  const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return await response.json();
};

/**
 * Ambil semua data dari Google Spreadsheet via Apps Script
 * @returns {Promise<Array>}
 */
const loadData = async () => {
  const errorCard = el('error-card');
  const cardGrid  = el('card-grid');

  addClass(errorCard, 'hidden');
  cardGrid.innerHTML = '';
  showSkeleton();

  try {
    const url = `${APPS_SCRIPT_URL}?action=load`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const result = await response.json();

    if (result.status === 'success') {
      // Urutkan dari terbaru ke terlama
      allGroups = (result.data || []).sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else {
      throw new Error(result.message || 'Gagal memuat data');
    }

  } catch (err) {
    console.error('[loadData] Error:', err);
    hideSkeleton();
    removeClass(errorCard, 'hidden');
    return;
  }

  hideSkeleton();
  filteredGroups = [...allGroups];
  renderCards(filteredGroups);
};

/** Handler submit form */
const handleSubmit = async (e) => {
  e.preventDefault();

  const { valid, data } = validateForm();
  if (!valid) return;

  setSubmitLoading(true);

  try {
    const result = await submitData(data);

    if (result.status === 'success') {
      // Sukses
      showToast('Data kelompok berhasil disimpan.', 'success');
      el('registration-form').reset();
      resetCharCounters();
      clearAllErrors();

      // Reload data dan scroll ke daftar
      await loadData();
      setTimeout(() => {
        el('list-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

    } else {
      throw new Error(result.message || 'Terjadi kesalahan dari server.');
    }

  } catch (err) {
    console.error('[handleSubmit] Error:', err);
    showToast('Terjadi kesalahan. Periksa koneksi dan coba lagi.', 'error');
  } finally {
    setSubmitLoading(false);
  }
};

/* ============================================================
   9. SEARCH — Realtime filter berdasarkan nama tim
   ============================================================ */

const handleSearch = () => {
  const query = el('search-input').value.toLowerCase().trim();

  if (!query) {
    filteredGroups = [...allGroups];
  } else {
    filteredGroups = allGroups.filter(g =>
      g.namaTim && g.namaTim.toLowerCase().includes(query)
    );
  }

  renderCards(filteredGroups);
};

/* ============================================================
   CHARACTER COUNTERS
   ============================================================ */

/** Pasang event listener karakter counter pada field tertentu */
const attachCharCounter = (inputId, countId, max) => {
  const input = el(inputId);
  const count = el(countId);

  const update = () => {
    const len = input.value.length;
    count.textContent = `${len}/${max}`;
    count.style.color = len >= max ? '#EF4444' : '#9CA3AF';
  };

  input.addEventListener('input', update);
  update();
};

/** Reset semua char counter ke 0 */
const resetCharCounters = () => {
  ['nama-tim', 'anggota1', 'anggota2', 'kosen-produk'].forEach(id => {
    const countEl = el(`count-${id}`);
    if (countEl) {
      const max = el(id).getAttribute('maxlength');
      countEl.textContent = `0/${max}`;
      countEl.style.color = '#9CA3AF';
    }
  });
};

/* ============================================================
   NOMOR TELEPON — Sanitasi input otomatis
   ============================================================ */

const attachPhoneFormatter = () => {
  const input = el('nomor-telepon');

  input.addEventListener('input', () => {
    // Hanya boleh angka
    let val = input.value.replace(/[^0-9]/g, '');

    // Paksa diawali 08
    if (val.length >= 1 && val[0] !== '0') {
      val = '0' + val;
    }
    if (val.length >= 2 && val[1] !== '8') {
      val = '08' + val.slice(2);
    }

    // Limit 13 digit
    if (val.length > 13) val = val.slice(0, 13);

    input.value = val;
  });
};

/* ============================================================
   10. INIT — Inisialisasi semua event & load data pertama kali
   ============================================================ */

const init = () => {
  // Char counters
  attachCharCounter('nama-tim',    'count-nama-tim',    40);
  attachCharCounter('anggota1',    'count-anggota1',    50);
  attachCharCounter('anggota2',    'count-anggota2',    50);
  attachCharCounter('kosen-produk','count-kosen-produk',150);

  // Phone formatter
  attachPhoneFormatter();

  // Clear error on input
  const inputIds = ['nama-tim', 'anggota1', 'anggota2', 'nomor-telepon', 'kosen-produk'];
  inputIds.forEach(id => {
    el(id).addEventListener('input', () => clearFieldError(`error-${id}`, id));
  });
  el('bidang').addEventListener('change', () => clearFieldError('error-bidang', 'bidang'));

  // Form submit
  el('registration-form').addEventListener('submit', handleSubmit);

  // Search realtime
  el('search-input').addEventListener('input', handleSearch);

  // Load data pertama kali
  loadData();
};

// Jalankan setelah DOM siap
document.addEventListener('DOMContentLoaded', init);
