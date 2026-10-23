/**
 * KSB Dashboard – cầu nối dữ liệu real-time từ Google Sheet "Kế hoạch truyền thông 2027".
 *
 * Cách dùng (làm 1 lần, khoảng 5 phút) – xem README.md mục 2:
 *   1. Mở Sheet → Tiện ích mở rộng → Apps Script → dán toàn bộ file này vào Code.gs.
 *   2. Đặt TOKEN bên dưới thành một chuỗi bất kỳ (ví dụ: ksb-2027-x7Qp).
 *   3. Đặt mật khẩu mục Ngân sách: chọn hàm datMatKhauNganSach → Chạy (sửa mật khẩu trong hàm trước khi chạy).
 *      Mật khẩu được lưu trong Script Properties, KHÔNG nằm trong code hay trên GitHub.
 *   4. Triển khai → Tùy chọn triển khai mới → Ứng dụng web
 *        Thực thi dưới dạng: Tôi | Người có quyền truy cập: Bất kỳ ai
 *   5. Sao chép URL /exec, dán vào assets/js/config.js (APPS_SCRIPT_URL) cùng TOKEN.
 *
 * Dữ liệu trả ra trang chia hai lớp:
 *   - Công khai: mọi tab, trừ tab NS… và CP…; cột/mục ngân sách trong các tab khác bị xóa trắng.
 *   - Ngân sách: chỉ trả khi gửi đúng mật khẩu (tham số pw). Sai quá 10 lần/giờ thì tạm khóa.
 */

const SPREADSHEET_ID = '1qX3GrI2wOGJoLNst-PwfANLG6QQKoHtFkR08Sf9uc4U';
const TOKEN = 'DOI-CHUOI-NAY';   // đổi thành chuỗi của anh, giống trong config.js

// Các tab KHÔNG gửi ra trang trong bất kỳ trường hợp nào.
const SKIP_SHEETS = [];
// Cột bị xóa trắng kể cả khi đã mở khóa (số điện thoại người liên hệ). Cột tính từ 0.
const MASK_COLUMNS = { 'CP 2026 · Dữ liệu gốc': [13] };

// Quy tắc nhận diện ngân sách (khớp với công cụ tạo bản chụp)
const PRIVATE_SHEET = /^(NS|CP)(\s|$)/;
const MONEY_HEAD = /ngân sách|thành tiền|đơn giá|vnđ|chi phí \(|số tiền/i;
const MONEY_SECTION = /^\d+\.\s*NGÂN SÁCH/i;
const LOCK = 'Nội dung thuộc mục Ngân sách (cần mật khẩu)';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (TOKEN && p.token !== TOKEN) return json_({ error: 'unauthorized', message: 'Sai hoặc thiếu token.' });

  let wantBudget = false;
  if (p.pw) {
    const chk = checkPassword_(p.pw);
    if (!chk.ok) return json_({ error: 'bad_password', message: chk.message });
    wantBudget = true;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = {}, priv = {};
  ss.getSheets().forEach(function (sh) {
    const name = sh.getName();
    if (SKIP_SHEETS.indexOf(name) !== -1) return;
    const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    let values = (!lastRow || !lastCol) ? [] : sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    (MASK_COLUMNS[name] || []).forEach(function (c) {
      values.forEach(function (r, i) { if (i >= 4 && c < r.length) r[c] = ''; });
    });
    values = trim_(values);
    if (PRIVATE_SHEET.test(name)) { if (wantBudget) priv[name] = values; return; }
    const pub = publicCopy_(values);
    sheets[name] = pub.rows;
    if (wantBudget && pub.changed) priv[name] = values;
  });

  const out = { source: 'live', title: ss.getName(), updated: new Date().toISOString(), sheets: sheets };
  if (wantBudget) out.private = priv;
  return json_(out);
}

/** Bản công khai của một tab: xóa trắng cột tiền, mục NGÂN SÁCH, dòng rà soát nhóm Ngân sách. */
function publicCopy_(values) {
  const rows = values.map(function (r) { return r.slice(); });
  let changed = false;
  rows.forEach(function (r, i) {
    r.forEach(function (c, j) {
      const t = String(c);
      if (t.length < 40 && MONEY_HEAD.test(t)) {
        for (let k = i + 1; k < rows.length; k++) if (j < rows[k].length && String(rows[k][j]).trim()) { rows[k][j] = ''; changed = true; }
      }
    });
  });
  rows.forEach(function (r, i) {
    if (r.length && MONEY_SECTION.test(String(r[0]).trim())) {
      for (let k = i + 1; k < rows.length && rows[k].some(function (c) { return String(c).trim(); }); k++) { rows[k] = [rows[k][0], LOCK]; changed = true; }
    }
  });
  rows.forEach(function (r) {
    if (r.length > 2 && String(r[1]).trim() === 'Ngân sách') { r[2] = LOCK; if (r.length > 3) r[3] = ''; if (r.length > 4) r[4] = ''; changed = true; }
  });
  return { rows: rows, changed: changed };
}

function checkPassword_(pw) {
  const cache = CacheService.getScriptCache();
  const fails = +(cache.get('pw_fails') || 0);
  if (fails >= 10) return { ok: false, message: 'Nhập sai quá nhiều lần, thử lại sau 1 giờ.' };
  const real = PropertiesService.getScriptProperties().getProperty('BUDGET_PASSWORD');
  if (!real) return { ok: false, message: 'Chưa đặt mật khẩu Ngân sách (chạy hàm datMatKhauNganSach).' };
  if (pw === real) return { ok: true };
  cache.put('pw_fails', String(fails + 1), 3600);
  return { ok: false, message: 'Sai mật khẩu.' };
}

/** Chạy 1 lần để đặt (hoặc đổi) mật khẩu mục Ngân sách. Sửa chuỗi bên dưới trước khi chạy, chạy xong có thể xóa chuỗi đi. */
function datMatKhauNganSach() {
  const MAT_KHAU = 'NHAP-MAT-KHAU-O-DAY';
  PropertiesService.getScriptProperties().setProperty('BUDGET_PASSWORD', MAT_KHAU);
  Logger.log('Đã lưu mật khẩu mục Ngân sách.');
}

/** Bỏ ô trống ở cuối mỗi dòng và các dòng trống ở cuối bảng. */
function trim_(rows) {
  const out = rows.map(function (r) {
    let n = r.length;
    while (n > 0 && String(r[n - 1]).trim() === '') n--;
    return r.slice(0, n);
  });
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy hàm này trong trình soạn thảo để kiểm tra trước khi triển khai. */
function testDoGet() {
  const pub = JSON.parse(doGet({ parameter: { token: TOKEN } }).getContent());
  Logger.log('Công khai: ' + Object.keys(pub.sheets || {}).length + ' tab');
  const pw = PropertiesService.getScriptProperties().getProperty('BUDGET_PASSWORD');
  if (pw) {
    const all = JSON.parse(doGet({ parameter: { token: TOKEN, pw: pw } }).getContent());
    Logger.log('Ngân sách: ' + Object.keys(all.private || {}).length + ' tab');
  }
}
