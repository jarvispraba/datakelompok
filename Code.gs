/**
 * Code.gs — Google Apps Script Backend
 * Pendaftaran Kelompok KIK | Telkom School
 *
 * Semua request dikirim via GET (URLSearchParams) agar
 * kompatibel penuh dengan CORS Google Apps Script Web App.
 *
 * Cara deploy:
 *  1. Buka Google Spreadsheet → Extensions → Apps Script
 *  2. Hapus semua kode lama, tempel seluruh kode ini
 *  3. Ganti nilai SPREADSHEET_ID dan SHEET_NAME jika perlu
 *  4. Klik Deploy → New Deployment → Web App
 *       Execute as : Me
 *       Who has access : Anyone
 *  5. Copy URL deploy → tempel ke APPS_SCRIPT_URL di script.js
 *
 * Urutan kolom spreadsheet:
 *  A=Timestamp | B=Nama Tim | C=Anggota1 | D=Anggota2
 *  E=Nomor Telepon | F=Bidang | G=Kosen Produk
 */

// ── KONFIGURASI ──────────────────────────────────────────────
// Cara ambil ID: buka spreadsheet → lihat URL:
//   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
//                                          ^^^^^^^^^^^^^^^^
const SPREADSHEET_ID = '1bJRF9r6yKFPLmQcrHNld78JBwLSYU-ENv9ICLmwURw0';
const SHEET_NAME     = 'Sheet1'; // Sesuaikan dengan nama sheet Anda

// ── RESPONSE HELPER ──────────────────────────────────────────
/**
 * Buat response JSON (sudah otomatis CORS-safe di Apps Script)
 * @param {Object} data
 * @returns {ContentService.TextOutput}
 */
function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ROUTER UTAMA (semua request lewat doGet) ─────────────────
/**
 * Titik masuk semua request dari website.
 * Parameter 'action' menentukan operasi yang dijalankan:
 *   - action=load   → ambil semua data
 *   - action=submit → simpan data baru
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'load') {
      return loadData();
    }

    if (action === 'submit') {
      return submitData(e.parameter);
    }

    return makeResponse({ status: 'error', message: 'Action tidak dikenali.' });

  } catch (err) {
    return makeResponse({ status: 'error', message: err.message });
  }
}

// ── LOAD DATA ────────────────────────────────────────────────
/**
 * Baca semua baris spreadsheet dan kembalikan sebagai JSON array.
 * Baris 1 dianggap header, data mulai dari baris 2.
 */
function loadData() {
  const sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  // Kosong atau hanya header
  if (lastRow <= 1) {
    return makeResponse({ status: 'success', data: [] });
  }

  const range  = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();

  const data = values
    .filter(row => row[0] !== '')   // skip baris kosong
    .map(row => ({
      timestamp:    row[0] ? new Date(row[0]).toISOString() : '',
      namaTim:      row[1] ? row[1].toString() : '',
      anggota1:     row[2] ? row[2].toString() : '',
      anggota2:     row[3] ? row[3].toString() : '',
      nomorTelepon: row[4] ? row[4].toString() : '',
      bidang:       row[5] ? row[5].toString() : '',
      kosenProduk:  row[6] ? row[6].toString() : '',
    }));

  return makeResponse({ status: 'success', data: data });
}

// ── SUBMIT DATA ──────────────────────────────────────────────
/**
 * Validasi input lalu simpan satu baris baru ke spreadsheet.
 * @param {Object} params - e.parameter dari doGet
 */
function submitData(params) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  // Ambil dan sanitasi nilai
  const namaTim      = sanitizeInput(params.namaTim      || '');
  const anggota1     = sanitizeInput(params.anggota1     || '');
  const anggota2     = sanitizeInput(params.anggota2     || '');
  const nomorTelepon = (params.nomorTelepon || '').toString().trim();
  const bidang       = sanitizeInput(params.bidang       || '');
  const kosenProduk  = sanitizeInput(params.kosenProduk  || '');

  // ── Validasi wajib isi ──
  if (!namaTim || !anggota1 || !anggota2 || !nomorTelepon || !bidang || !kosenProduk) {
    return makeResponse({ status: 'error', message: 'Semua field wajib diisi.' });
  }

  // ── Validasi panjang ──
  if (namaTim.length > 40) {
    return makeResponse({ status: 'error', message: 'Nama tim terlalu panjang (maks 40 karakter).' });
  }
  if (anggota1.length > 50 || anggota2.length > 50) {
    return makeResponse({ status: 'error', message: 'Nama anggota terlalu panjang (maks 50 karakter).' });
  }
  if (kosenProduk.length > 150) {
    return makeResponse({ status: 'error', message: 'Kosen produk terlalu panjang (maks 150 karakter).' });
  }

  // ── Validasi format nomor telepon ──
  if (!/^08[0-9]{8,11}$/.test(nomorTelepon)) {
    return makeResponse({ status: 'error', message: 'Format nomor telepon tidak valid.' });
  }

  // ── Validasi bidang ──
  if (!['Produk', 'Jasa'].includes(bidang)) {
    return makeResponse({ status: 'error', message: 'Bidang tidak valid.' });
  }

  // ── Cek duplikasi ──
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    for (let i = 0; i < existingData.length; i++) {
      const row = existingData[i];
      if (!row[0]) continue; // skip baris kosong

      // Duplikasi nama tim
      if (row[1].toString().toLowerCase() === namaTim.toLowerCase()) {
        return makeResponse({ status: 'error', message: 'Nama tim sudah terdaftar. Pilih nama lain.' });
      }

      // Duplikasi nomor telepon
      if (row[4].toString() === nomorTelepon) {
        return makeResponse({ status: 'error', message: 'Nomor telepon sudah terdaftar.' });
      }
    }
  }

  // ── Simpan ke spreadsheet ──
  // Urutan SESUAI kolom: A=Timestamp, B=NamaTim, C=Anggota1, D=Anggota2,
  //                      E=NomorTelepon, F=Bidang, G=KosenProduk
  sheet.appendRow([
    new Date(),    // A — Timestamp otomatis
    namaTim,       // B — Nama Tim
    anggota1,      // C — Anggota 1
    anggota2,      // D — Anggota 2
    nomorTelepon,  // E — Nomor Telepon
    bidang,        // F — Bidang
    kosenProduk,   // G — Kosen Produk
  ]);

  return makeResponse({ status: 'success', message: 'Data berhasil disimpan.' });
}

// ── HELPER: SANITASI INPUT ───────────────────────────────────
/**
 * Hapus tag HTML dan normalkan spasi berlebih.
 * @param {string} str
 * @returns {string}
 */
function sanitizeInput(str) {
  return str
    .replace(/<[^>]*>/g, '')   // hapus tag HTML
    .replace(/\s+/g, ' ')      // spasi berlebih → satu spasi
    .trim();
}
