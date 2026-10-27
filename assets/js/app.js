/* =========================================================
   KSB · TRUYỀN THÔNG — LANDING PAGE
   Đọc dữ liệu từ Google Sheet (qua Apps Script) → bóc tách → dựng trang.
   Mọi con số đều tính từ Sheet; không gõ tay trong mã.
   ========================================================= */
(() => {
'use strict';
const CFG = Object.assign({ REFRESH_SECONDS: 60, MILESTONES: {} }, window.KSB_CONFIG || {});
const CACHE_KEY = 'ksb-landing-cache-v3';
const PW_KEY = 'ksb-budget-pw';
const LOCK = { pw: null };
try { LOCK.pw = sessionStorage.getItem(PW_KEY); } catch (_) { }

/* ---------- Tiện ích ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = s => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();
const num = s => { if (s == null) return 0; let t = String(s).trim(); if (!t) return 0; const neg = /^[-−(]/.test(t); t = t.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(t); return isNaN(n) ? 0 : (neg ? -n : n); };
const dmy = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '').trim()); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
/** Ngày dự kiến: dd/mm/yyyy, mm/yyyy hoặc Qn/yyyy → {d, exact} */
function when(s) {
  const t = String(s || '').trim(); let m;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) return { d: new Date(+m[3], +m[2] - 1, +m[1]), exact: true };
  if ((m = /^(\d{1,2})\/(\d{4})$/.exec(t))) return { d: new Date(+m[2], +m[1] - 1, 1), exact: false };
  if ((m = /^Q([1-4])\/(\d{4})$/i.exec(t))) return { d: new Date(+m[2], (+m[1] - 1) * 3 + 1, 1), exact: false, q: true };
  return null;
}
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const days = (a, b) => Math.round((b - a) / 86400000);
const pad = n => String(n).padStart(2, '0');
const fDate = d => d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
const fDM = d => d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : '';
const fInt = n => Math.round(n).toLocaleString('vi-VN');
const fVND = n => { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ'; if (a >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: a >= 1e8 ? 0 : 1 }) + ' tr'; return fInt(n); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const MON = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
const C = ['#0d4f9b', '#e3242b', '#5b8fd1', '#c98a00', '#1a7f4b', '#6a4fb3', '#8a94a6', '#a9c4e8'];
const countBy = (arr, f) => arr.reduce((o, x) => { const k = f(x); if (k) o[k] = (o[k] || 0) + 1; return o; }, {});
const isDone = s => /^(đã làm|đã đăng|đã duyệt|đã chốt|đã có|done|hoàn thành|đã xử lý)/i.test(String(s || '').trim());

/* ---------- Đọc lưới Sheet ---------- */
let S = {}, SP = {};
const G = name => SP[name] || S[name] || [];
const cell = (r, i) => (r && r[i] != null ? String(r[i]).trim() : '');
const blank = r => !r || !r.some(c => String(c ?? '').trim());
const rowIdx = (g, test, from = 0) => { for (let i = from; i < g.length; i++) if (test(g[i] || [], i)) return i; return -1; };
const rowBy = (g, label) => (g.find(r => (r || []).some(c => String(c).trim().toUpperCase().startsWith(label.toUpperCase()))) || []);
const lastNum = r => { for (let i = (r || []).length - 1; i >= 0; i--) if (/\d/.test(cell(r, i))) return num(r[i]); return 0; };
function table(g, test, from = 0, stopAtBlank = true) {
  const h = rowIdx(g, test, from); if (h < 0) return [];
  const head = (g[h] || []).map(x => String(x).trim()); const out = [];
  for (let i = h + 1; i < g.length; i++) {
    const r = g[i] || []; if (blank(r)) { if (stopAtBlank) break; else continue; }
    const o = { _r: r }; head.forEach((k, j) => { if (k && !(k in o)) o[k] = clean(cell(r, j)); }); out.push(o);
  }
  return out;
}
function section(g, title) {
  const i = rowIdx(g, r => cell(r, 0).toUpperCase().startsWith(title.toUpperCase())); if (i < 0) return [];
  const out = []; for (let k = i + 1; k < g.length; k++) { const r = g[k] || []; if (blank(r)) break; out.push(r.map(c => String(c ?? '').trim())); }
  return out;
}
const splitDot = s => String(s || '').split('·').map(x => x.trim()).filter(Boolean);

/* ---------- Mô hình dữ liệu ---------- */
let M = {};
function build() {
  const m = {};
  const tq = G('Tổng quan');
  m.version = cell(tq[1], 0);
  m.goals = section(tq, '2. MỤC TIÊU');
  m.lang = section(tq, '4. NGÔN NGỮ').slice(1).map(r => ({ no: r[0], yes: r[1], note: r[2] || '' }));
  m.audience = section(tq, '5. ĐỐI TƯỢNG').slice(1).map(r => ({ who: r[0], feel: r[1] }));
  m.kpis = section(tq, '7. KPI').slice(1).map(r => ({ name: r[0], target: r[1] || '', note: r[2] || '' }));
  m.review = table(G('Rà soát 2027'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Nhóm').filter(x => x.STT).map(x => ({ ...x, due: dmy(x['Hạn']) }));
  m.posts = table(G('Lịch nội dung 2027'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Ngày đăng').filter(p => p['Ngày đăng']).map(p => ({ ...p, date: dmy(p['Ngày đăng']) }));
  m.holidays = table(G('Ngày lễ 2027'), r => cell(r, 0) === 'Ngày' && cell(r, 1) === 'Thứ').filter(h => dmy(h['Ngày'])).map(h => ({ ...h, date: dmy(h['Ngày']) }));
  m.series = table(G('Series hàng tháng'), r => cell(r, 0) === 'Số' && cell(r, 1) === 'Tháng').filter(x => x['Số']);
  const pf = G('Phim 35 năm');
  m.film = section(pf, '1. ĐỊNH HƯỚNG').map(r => ({ k: r[0], v: r[1], n: r[2] || '' }));
  m.filmMs = table(pf, r => cell(r, 0) === 'Mốc' && cell(r, 1) === 'Thời gian');
  m.dcNumbers = table(G('Lịch bài Đất Cuốc T11–12/2026'), r => cell(r, 0) === '#' && cell(r, 4) === 'Hạng mục').filter(x => x['Hạng mục']);
  const nt = G('NS Tổng');
  m.nsAct = table(nt, r => cell(r, 0) === 'STT' && cell(r, 1) === 'Hoạt động').filter(x => x.STT);
  const pt = G('NS 2027 · Phòng TT');
  m.regular = table(pt, r => cell(r, 0) === 'STT' && cell(r, 1) === 'Đầu mục').filter(x => /^\d+$/.test(x.STT));
  m.grand = lastNum(rowBy(pt, 'TỔNG NGÂN SÁCH PHÒNG')); m.regTotal = lastNum(rowBy(pt, 'Cộng chi thường xuyên')); m.campTotal = lastNum(rowBy(pt, 'Cộng chiến dịch'));
  const cmp = rowBy(pt, 'So với chi 2026'); m.growth = (cmp.find(c => /%/.test(String(c))) || '').trim();
  const cp = G('CP 2026 · Tổng hợp');
  m.cp26 = table(cp, r => cell(r, 0) === 'STT' && cell(r, 1) === 'Đầu mục').filter(x => /^\d+$/.test(x.STT));
  m.cpLatest = cell(rowBy(cp, 'Ngày chứng từ mới nhất'), 1);
  m.cpHist = table(G('CP 2024–2025'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Đầu mục').filter(x => /^\d+$/.test(x.STT));
  const raw = G('CP 2026 · Dữ liệu gốc'); const rh = rowIdx(raw, r => cell(r, 0) === 'STT' && cell(r, 1) === 'ĐƠN VỊ');
  m.raw = rh < 0 ? [] : raw.slice(rh + 1).filter(r => cell(r, 15) === '1').map(r => ({ unit: clean(r[1]), q: cell(r, 16), amt: num(r[17]), paid: num(r[18]), cat: cell(r, 19) }));
  m.ppPress = table(G('NS Phân phối'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Đợt', 0, false).filter(x => /bài pr/i.test(x['Hạng mục']) && x.STT);
  m.nsNoiBo = table(G('NS Nội bộ & lưu trữ'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Đợt', 0, false).filter(x => x.STT);
  // tab bổ sung cho landing page
  const tc = G('Thương hiệu công ty');
  m.arch = table(tc, r => cell(r, 0) === 'Thứ tự' && cell(r, 1) === 'Thành tố').filter(x => x['Thành tố']);
  m.assets = table(tc, r => cell(r, 0) === 'Hạng mục' && cell(r, 1) === 'Trạng thái').filter(x => x['Hạng mục']);
  m.people = table(G('Thương hiệu cá nhân'), r => cell(r, 0) === 'STT' && cell(r, 2) === 'Đối tượng').filter(x => x['Đối tượng']);
  m.events = table(G('Sự kiện 2027'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Sự kiện').filter(x => x['Sự kiện']).map(x => ({ ...x, w: when(x['Ngày dự kiến']), budget: num(x['Ngân sách dự kiến (VNĐ)']) }));
  m.press = table(G('Theo dõi báo chí'), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Ngày đăng', 0, false).filter(x => x['Báo / tạp chí'] || x['Tiêu đề']).map(x => ({ ...x, date: dmy(x['Ngày đăng']) }));
  m.risks = table(G('Rủi ro truyền thông'), r => cell(r, 0) === 'STT' && cell(r, 2) === 'Rủi ro').filter(x => x['Rủi ro']).map(x => { const k = num(x['Khả năng (1–5)']), s = num(x['Mức độ (1–5)']); return { ...x, k, s, score: num(x['Điểm']) || k * s }; });
  m.acts = table(G('Hoạt động dự kiến'), r => cell(r, 0) === 'STT' && cell(r, 3) === 'Hoạt động').filter(x => x['Hoạt động']).map(x => ({ ...x, w: when(x['Thời gian dự kiến']), budget: num(x['Ngân sách dự kiến (VNĐ)']) }));
  m.unlocked = !!LOCK.pw && Object.keys(SP).length > 0;
  M = m;
}
const msgOf = k => (M.arch.find(a => a['Thành tố'] === k) || {})['Nội dung'] || '';

/* ---------- Tải dữ liệu ---------- */
const state = { source: 'snapshot', updated: null, error: null, sig: '' };
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function apply(payload, source) {
  if (payload.private) SP = payload.private;
  const sig = String(hashStr(JSON.stringify(payload.sheets) + Object.keys(SP).length)); const changed = sig !== state.sig;
  S = payload.sheets || {}; state.sig = sig; state.source = source; state.updated = payload.updated ? new Date(payload.updated) : new Date();
  if (changed) build(); return changed;
}
async function fetchLive(pw) {
  if (!CFG.APPS_SCRIPT_URL) throw new Error('Chưa cấu hình APPS_SCRIPT_URL');
  const u = CFG.APPS_SCRIPT_URL + (CFG.APPS_SCRIPT_URL.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(CFG.TOKEN || '') + (pw ? '&pw=' + encodeURIComponent(pw) : '') + '&t=' + Date.now();
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try { const res = await fetch(u, { signal: ctl.signal, redirect: 'follow' }); if (!res.ok) throw new Error('HTTP ' + res.status); const data = await res.json(); if (data.error) { const er = new Error(data.message || data.error); er.code = data.error; throw er; } if (!data.sheets) throw new Error('Dữ liệu trả về không đúng định dạng'); return data; }
  finally { clearTimeout(to); }
}
async function load(first) {
  try { const data = await fetchLive(LOCK.pw); const ch = apply(data, 'live'); state.error = null; try { localStorage.setItem(CACHE_KEY, JSON.stringify({ source: data.source, updated: data.updated, sheets: data.sheets })); } catch (_) { } return ch || first; }
  catch (e) {
    state.error = CFG.APPS_SCRIPT_URL ? e.message : null;
    if (first || state.source !== 'live') {
      let cached = null; try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { }
      if (cached && cached.sheets && CFG.APPS_SCRIPT_URL) { apply(cached, 'cache'); return true; }
      if (window.KSB_SNAPSHOT) { apply(window.KSB_SNAPSHOT, 'snapshot'); return true; }
    }
    return false;
  } finally { paintStatus(); }
}
/* ---------- Mục Ngân sách: mở khóa bằng mật khẩu ---------- */
function loadEnc() {
  if (window.KSB_BUDGET_ENC) return Promise.resolve(window.KSB_BUDGET_ENC);
  return new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'data/budget.enc.js?v=' + Date.now(); sc.onload = () => window.KSB_BUDGET_ENC ? ok(window.KSB_BUDGET_ENC) : no(new Error('File ngân sách không hợp lệ')); sc.onerror = () => no(new Error('Không tải được file ngân sách')); document.head.appendChild(sc); });
}
async function decryptBudget(pw) {
  const E = await loadEnc(); const b = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
  if (!(window.crypto && crypto.subtle)) throw new Error('Trình duyệt không hỗ trợ giải mã (cần mở bằng https hoặc localhost)');
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(E.salt), iterations: E.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let pt; try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(E.iv) }, key, b(E.data)); } catch (_) { const er = new Error('Sai mật khẩu.'); er.code = 'bad_password'; throw er; }
  return JSON.parse(new TextDecoder().decode(pt));
}
async function unlock(pw) {
  if (CFG.APPS_SCRIPT_URL) {
    try { const data = await fetchLive(pw); if (!data.private) throw new Error('Apps Script chưa có bản hỗ trợ mục Ngân sách'); LOCK.pw = pw; apply(data, 'live'); build(); state.error = null; }
    catch (e) { if (e.code === 'bad_password') throw e; const d = await decryptBudget(pw); LOCK.pw = pw; SP = d.sheets || {}; build(); }
  } else { const d = await decryptBudget(pw); LOCK.pw = pw; SP = d.sheets || {}; build(); }
  try { sessionStorage.setItem(PW_KEY, pw); } catch (_) { }
}
function relock() { LOCK.pw = null; SP = {}; try { sessionStorage.removeItem(PW_KEY); } catch (_) { } build(); }
function paintStatus() {
  const p = $('#status'), t = $('#status-text'); p.className = 'status'; const u = state.updated;
  const hm = u ? `${pad(u.getHours())}:${pad(u.getMinutes())}` : '';
  if (state.source === 'live') { p.classList.add('live'); t.textContent = `Trực tiếp · ${hm}`; p.title = 'Đang đọc dữ liệu mới nhất từ Sheet'; }
  else if (state.source === 'cache') { p.classList.add('err'); t.textContent = `Mất kết nối · bản ${hm}`; p.title = state.error || ''; }
  else { p.classList.add(state.error ? 'err' : 'snap'); t.textContent = state.error ? 'Lỗi kết nối' : `Bản chụp ${fDM(u)}`; p.title = state.error || 'Chưa nối real-time: điền APPS_SCRIPT_URL trong assets/js/config.js'; }
}

/* ---------- Biểu đồ ---------- */
let charts = [];
function setupChart() {
  if (!window.Chart) return; const D = Chart.defaults;
  D.font.family = '"Be Vietnam Pro", system-ui, sans-serif'; D.font.size = 11.5; D.color = '#4a5568';
  D.maintainAspectRatio = false; D.animation.duration = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0 : 450;
  Object.assign(D.plugins.legend.labels, { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, padding: 14 }); D.plugins.legend.position = 'bottom';
  Object.assign(D.plugins.tooltip, { backgroundColor: '#0a2246', padding: 10, cornerRadius: 4, titleFont: { weight: '600' }, boxPadding: 4 });
  D.elements.bar.borderRadius = 3; D.elements.bar.borderSkipped = false;
  D.scale.grid.color = '#f0f2f5'; D.scale.border = { display: false };
}
function chart(id, cfg) { const el = document.getElementById(id); if (el && window.Chart) charts.push(new Chart(el, cfg)); }
const moneyAxis = { ticks: { callback: v => fVND(v) } };
const tipMoney = axis => ({ callbacks: { label: c => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fVND(axis === 'x' ? c.parsed.x : c.parsed.y)}` } });
function barChart(id, labels, datasets, o = {}) {
  const h = !!o.horizontal, ix = h ? 'x' : 'y', cx = h ? 'y' : 'x';
  const sc = { [cx]: { stacked: !!o.stacked, grid: { display: false } }, [ix]: { stacked: !!o.stacked, ...(o.money ? moneyAxis : { ticks: { precision: 0 } }) } };
  chart(id, { type: 'bar', data: { labels, datasets: datasets.map((d, i) => ({ backgroundColor: d.color || C[i % C.length], borderColor: '#fff', borderWidth: o.stacked ? 1 : 0, maxBarThickness: 34, ...d })) }, options: { indexAxis: h ? 'y' : 'x', plugins: { legend: { display: datasets.length > 1 }, tooltip: o.money ? tipMoney(ix) : {} }, scales: sc } });
}

/* ---------- Biểu tượng, màu theo mảng, ảnh ---------- */
const ICONS = {
  brand: '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"/><path d="M12 7.5l4.5 4.5-4.5 4.5L7.5 12z"/>',
  comm: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7"/><path d="M19 5.5a8.5 8.5 0 0 1 0 13"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  risk: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 9v4M12 16h.01"/>',
  act: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l7-7"/>',
  money: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M6 9.5h.01M18 15.5h.01"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7M7 16h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  channel: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 8h6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 18 3-18"/>',
  root: '<path d="M12 3v9"/><path d="M12 12c-3 0-5 2-6 5M12 12c3 0 5 2 6 5M12 12v9"/><path d="M8 6h8"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.8-1.2"/><path d="M12 14.5v2.5"/>',
  quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.layers}</svg>`;
const IMG = n => new URL(`assets/img/photos/${n}.jpg`, location.href).href;
const GMETA = {
  '': { c: '#0d4f9b', icon: 'brand', img: 'kcn-phoi-canh' },
  'thuong-hieu': { c: '#0d4f9b', icon: 'brand', img: 'kcn-cong', pos: 'center 30%' },
  'truyen-thong': { c: '#e3242b', icon: 'comm', img: 'gala-mc', pos: 'center 25%' },
  'su-kien': { c: '#c98a00', icon: 'event', img: 'gala-dong-tam', pos: 'center 40%' },
  'rui-ro': { c: '#6a4fb3', icon: 'risk', img: 'mo-xe-2', pos: 'center 55%' },
  'hoat-dong': { c: '#1a7f4b', icon: 'act', img: 'pn-hoa', pos: 'center 35%' },
  'ngan-sach': { c: '#0f766e', icon: 'lock', img: 'kcn-phoi-canh', pos: 'center 45%' }
};
const SUB = {
  'thuong-hieu/cong-ty': ['brand', 'kcn-cong'], 'thuong-hieu/ca-nhan': ['users', 'pn-lanh-dao'],
  'truyen-thong/bao-chi': ['news', 'gala-mc'], 'truyen-thong/tai-tro': ['money', 'gala-khach'], 'truyen-thong/su-kien-ben-ngoai': ['event', 'kcn-phoi-canh'], 'truyen-thong/doi-noi': ['users', 'pn-tap-the'], 'truyen-thong/kenh-so': ['channel', 'kcn-phoi-canh'],
  'su-kien/noi-bo': ['users', 'pn-nhom'], 'su-kien/doi-ngoai': ['comm', 'gala-mc'], 'su-kien/co-dong': ['chart', 'gala-khach'], 'su-kien/ky-niem': ['event', 'gala-ky-niem'], 'su-kien/le-tet': ['event', 'pn-hoa'],
  'rui-ro/thuong-hieu': ['brand', 'kcn-cong'], 'rui-ro/lanh-dao': ['users', 'pn-phat-bieu'], 'rui-ro/hdsx': ['layers', 'mo-xe-1'], 'rui-ro/tai-chinh': ['money', 'mo-xe-2'],
  'ngan-sach/doi-ngoai': ['news', 'gala-mc'], 'ngan-sach/noi-bo': ['users', 'pn-tap-the'],
  'hoat-dong/hoi': ['users', 'pn-tap-the-2'], 'hoat-dong/esg': ['act', 'kcn-phoi-canh'], 'hoat-dong/csr': ['heart', 'pn-tang-cay']
};
const gOf = id => String(id || '').split('/')[0];
const gColor = id => (GMETA[gOf(id)] || GMETA['']).c;
const gIcon = id => (SUB[id] || [])[0] || (GMETA[gOf(id)] || GMETA['']).icon;
const gImg = id => (SUB[id] || [])[1] || (GMETA[gOf(id)] || GMETA['']).img;
let CUR = '';
function autoIcon(l, cls) {
  if (cls === 'alert') return 'alert';
  if (/chi |ngân sách|thanh toán|tài trợ|dự toán|vnđ/i.test(l)) return 'money';
  if (/báo/i.test(l)) return 'news';
  if (/thời gian|ngày|mốc|hạn/i.test(l)) return 'clock';
  if (/vai trò|nhân vật|người/i.test(l)) return 'users';
  if (/sự kiện/i.test(l)) return 'event';
  if (/rủi ro|kịch bản/i.test(l)) return 'risk';
  if (/đã |đã$/i.test(l)) return 'check';
  return 'layers';
}
function makeDonut(id, labels, data, colors, o = {}) {
  chart(id, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fff', borderWidth: 3, hoverOffset: 6 }] }, options: { cutout: o.cutout || '70%', plugins: { legend: { position: 'bottom' }, tooltip: o.money ? { callbacks: { label: c => ` ${c.label}: ${fVND(c.parsed)}` } } : {} } } });
}
const donutBox = (id, val, lab, cls = '') => `<div class="donut chart ${cls}"><canvas id="${id}" role="img"></canvas><div class="mid"><b>${val}</b><span>${lab}</span></div></div>`;
function makeGauge(id, v, max, color) {
  chart(id, { type: 'doughnut', data: { datasets: [{ data: [v, Math.max(0, max - v)], backgroundColor: [color, '#edf1f6'], borderWidth: 0, borderRadius: 6 }] }, options: { rotation: -90, circumference: 180, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: Chart.defaults.animation.duration * 2 } } });
}
const gauge = (id, v, max, label, sub) => `<div class="gauge"><div class="gc"><canvas id="${id}"></canvas><div class="gv">${pct(v, max)}<small>%</small></div></div><div class="gl">${label}</div><div class="gs">${sub}</div></div>`;

/* ---------- Mảnh giao diện ---------- */
const canvas = (id, cls = '') => `<div class="chart ${cls}"><canvas id="${id}" role="img"></canvas></div>`;
const box = (title, cap, body, src = '', cls = '') => `<section class="box ${cls}">${title ? `<div class="bh"><div><h3>${title}</h3>${cap ? `<div class="cap">${cap}</div>` : ''}</div></div>` : ''}${body}${src ? `<div class="src">${esc(src)}</div>` : ''}</section>`;
const sec = (no, title, body, aside = '') => `<section class="sec"><div class="wrap"><div class="sh"><span class="no">${no}</span><h2>${title}</h2>${aside ? `<p>${aside}</p>` : ''}</div>${body}</div></section>`;
const say = t => `<p class="say">${t}</p>`;
const empty = (t, s = '') => `<div class="empty"><b>${t}</b>${s}</div>`;
const fig = (v, l, cls = '', icon) => { const c = /^0?$|^–$/.test(String(v).replace(/<.*$/, '').trim()) ? '' : cls; return `<div class="fig ${c}"><span class="fi">${ic(icon || autoIcon(l, c))}</span><b>${v}</b><span>${l}</span></div>`; };
function tag(s) {
  const t = String(s || '').trim(); if (!t) return ''; let c = '';
  if (isDone(t) || /^đang triển khai/i.test(t)) c = 'good'; else if (/^(đang|dự kiến|chờ)/i.test(t)) c = 'info'; else if (/^chưa bắt đầu/i.test(t)) c = ''; else if (/^(chưa|trễ|quá hạn)/i.test(t)) c = 'crit'; else if (/^đề xuất/i.test(t)) c = 'warn';
  return `<span class="tag ${c}">${esc(t)}</span>`;
}
function dbox(d, done, approx, q) {
  if (d && q) return `<div class="d"><b>Q${Math.floor(d.getMonth() / 3) + 1}</b><span>${d.getFullYear()}</span></div>`;
  if (!d) return `<div class="d"><b>–</b><span>chưa có</span></div>`;
  const n = days(today(), d); const cls = done || approx ? '' : n < 0 ? 'late' : n <= 7 ? 'soon' : '';
  return approx ? `<div class="d"><b>${MON[d.getMonth()]}</b><span>${d.getFullYear()}</span></div>` : `<div class="d ${cls}"><b>${pad(d.getDate())}</b><span>${MON[d.getMonth()]}${d.getFullYear() !== today().getFullYear() ? ' ' + String(d.getFullYear()).slice(2) : ''}</span></div>`;
}
const rel = d => { const n = days(today(), d); return n === 0 ? 'hôm nay' : n > 0 ? `còn ${n} ngày` : `trễ ${-n} ngày`; };
function segBar(parts) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  return `<div class="bar" style="height:8px">${parts.filter(p => p.v > 0).map(p => `<span title="${esc(p.l)}: ${esc(p.t || p.v)}" style="width:${p.v / tot * 100}%;background:${p.c}"></span>`).join('')}</div><div class="legend">${parts.map(p => `<span><i style="background:${p.c}"></i>${esc(p.l)} <b class="tnum">${esc(p.t || p.v)}</b></span>`).join('')}</div>`;
}
function head(o) {
  const crumbs = [`<a href="#/">Trang chủ</a>`].concat((o.crumb || []).map(c => c.id ? `<a href="#/${c.id}">${esc(c.t)}</a>` : esc(c.t))).join(' / ');
  const id = CUR, g = GMETA[gOf(id)] || GMETA[''];
  return `<section class="ph" style="--img:url('${IMG(gImg(id))}');--pos:${g.pos || 'center'}"><div class="wrap"><div class="crumb">${crumbs}</div><h1><span class="gi">${ic(gIcon(id))}</span><span>${o.title}</span></h1>${o.lead ? `<div class="lead">${o.lead}</div>` : ''}${o.figs ? `<div class="figs">${o.figs.join('')}</div>` : ''}${o.tabs ? `<nav class="tabs">${o.tabs}</nav>` : ''}</div></section>`;
}
const lockCard = what => `<a class="lockcard" href="#/ngan-sach"><span class="lc-i">${ic(M.unlocked ? 'unlock' : 'lock')}</span><div><b>Số liệu chi phí nằm ở mục 06 · Ngân sách</b><span>${esc(what)}${M.unlocked ? '' : ' · cần mật khẩu'}</span></div><em>Mở mục Ngân sách →</em></a>`;
const tabsOf = (items, cur) => items.map(it => `<a href="#/${it.id}" class="${it.id === cur ? 'on' : ''}">${esc(it.t)}</a>`).join('');
const reviewItems = re => M.review.filter(x => re.test(x['Nhóm'] + ' ' + x['Vấn đề còn thiếu']));
const reviewList = items => items.length ? `<div class="list">${items.map(x => `<div class="li">${dbox(x.due, isDone(x['Trạng thái']))}<div><div class="t">${esc(x['Vấn đề còn thiếu'])}</div><div class="s">${esc(x['Đề xuất xử lý'])} · ${esc(x['Phụ trách'])}</div></div>${tag(x['Trạng thái'])}</div>`).join('')}</div>` : empty('Không có việc tồn đọng', '');
function postList(posts, max = 8) {
  return posts.length ? `<div class="list">${posts.slice(0, max).map(p => `<div class="li">${dbox(p.date, true)}<div><div class="t">${esc(p['Tiêu đề / chủ đề'])}</div><div class="s">${esc(p['Kênh'])} · ${esc(p['Định dạng'])}${p['Cấp duyệt'] ? ' · ' + esc(p['Cấp duyệt']) : ''}</div></div>${tag(p['Trạng thái'])}</div>`).join('')}${posts.length > max ? `<div class="s" style="padding-top:10px;color:var(--muted)">và ${posts.length - max} đầu mục khác trong tab Lịch nội dung 2027</div>` : ''}</div>` : empty('Chưa có bài trong lịch', 'Thêm vào tab Lịch nội dung 2027');
}
function eventList(evs) {
  return evs.length ? `<div class="list">${evs.map(e => `<div class="li">${dbox(e.w && e.w.d, false, e.w && !e.w.exact)}<div><div class="t">${esc(e['Sự kiện'])}</div><div class="s">${esc(e['Loại'])} · ${esc(e['Đối tượng tham dự'])} · ${esc(e['Đầu mối'])}</div><div class="s" style="color:var(--muted)">${esc(e['Căn cứ'])}</div></div>${tag(e['Trạng thái'])}</div>`).join('')}</div>` : empty('Chưa có sự kiện', 'Thêm dòng vào tab Sự kiện 2027');
}
function monthsTimeline(items, from, n) {
  // gom theo quý để mỗi cột đủ rộng; tháng hiển thị trong từng thẻ
  const t = today(); const cols = [];
  for (let i = 0; i < n; i++) { const d = new Date(from.getFullYear(), from.getMonth() + i, 1); const k = d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); if (!cols.length || cols[cols.length - 1].k !== k) cols.push({ k, y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1, ms: [] }); cols[cols.length - 1].ms.push(d); }
  let h = `<div class="xs"><div class="tl" style="--n:${cols.length}">`;
  cols.forEach(c => {
    const now = c.y === t.getFullYear() && c.q === Math.floor(t.getMonth() / 3) + 1;
    const evs = items.filter(x => x.d && c.ms.some(d => x.d.getFullYear() === d.getFullYear() && x.d.getMonth() === d.getMonth())).sort((a, b) => a.d - b.d);
    h += `<div class="m ${now ? 'now' : ''}"><div class="lb">Q${c.q}/${c.y}${c.ms.length < 3 ? ' · ' + c.ms.map(d => MON[d.getMonth()]).join(', ') : ''}</div>${evs.map(e => `<div class="ev" style="--c:${e.c}" title="${esc(e.tip || '')}"><small>${MON[e.d.getMonth()]} · ${esc(e.k)}</small>${esc(e.t)}</div>`).join('')}</div>`;
  });
  return h + '</div></div>';
}

/* =========================================================
   ĐIỀU HƯỚNG
   ========================================================= */
const NAV = [
  { id: 'thuong-hieu', n: '01', t: 'Thương hiệu', d: 'Hệ thống thông điệp, tài sản thương hiệu và những gương mặt đại diện cho KSB.', groups: [
    { items: [{ id: 'thuong-hieu/cong-ty', t: 'Xây dựng thương hiệu công ty', s: 'Tầm nhìn, sứ mệnh, slogan, tài sản thương hiệu' }, { id: 'thuong-hieu/ca-nhan', t: 'Xây dựng thương hiệu cá nhân', s: 'Lãnh đạo, người phát ngôn, đại sứ Người KSB' }] }] },
  { id: 'truyen-thong', n: '02', t: 'Truyền thông', d: 'Quan hệ báo chí, tài trợ, sự kiện bên ngoài và truyền thông trong nội bộ.', groups: [
    { gt: 'Truyền thông đối ngoại', items: [{ id: 'truyen-thong/bao-chi', t: 'Báo chí', s: 'Hợp đồng, đối tác, bài đăng', sub: 1 }, { id: 'truyen-thong/tai-tro', t: 'Tài trợ', s: 'Lịch sử chi và tiêu chí chọn', sub: 1 }, { id: 'truyen-thong/su-kien-ben-ngoai', t: 'Chương trình sự kiện bên ngoài', s: 'Xúc tiến đầu tư, sự kiện đối tác', sub: 1 }] },
    { gt: 'Truyền thông đối nội', items: [{ id: 'truyen-thong/doi-noi', t: 'Truyền thông đối nội', s: 'Nội dung văn hóa, sự kiện, đề cử nhân vật' }] },
    { gt: 'Kênh truyền thông số', items: [{ id: 'truyen-thong/kenh-so', t: 'Kênh truyền thông số', s: 'Website, fanpage KSB và Đất Cuốc, YouTube' }] }] },
  { id: 'su-kien', n: '03', t: 'Sự kiện', d: 'Lịch sự kiện 2027 của KSB: kỷ niệm, cổ đông, báo chí và nội bộ.', groups: [
    { items: [{ id: 'su-kien/noi-bo', t: 'Sự kiện nội bộ', s: 'Gắn kết CBNV, đào tạo, vinh danh', types: ['Nội bộ'] }, { id: 'su-kien/doi-ngoai', t: 'Sự kiện đối ngoại', s: 'Báo chí, đối tác, xúc tiến đầu tư', types: ['Báo chí', 'Bên ngoài'] }, { id: 'su-kien/co-dong', t: 'Sự kiện cổ đông', s: 'ĐHĐCĐ, mốc công bố thông tin', types: ['Cổ đông'] }, { id: 'su-kien/ky-niem', t: 'Sự kiện kỷ niệm', s: 'Lễ kỷ niệm 35 năm, phim tài liệu 01/2028', types: ['Kỷ niệm'] }] }] },
  { id: 'rui-ro', n: '04', t: 'Quản trị rủi ro', d: 'Nhận diện rủi ro truyền thông, chấm điểm và kịch bản ứng phó theo bốn nhóm.', groups: [
    { items: [{ id: 'rui-ro/thuong-hieu', t: 'Thương hiệu KSB', s: 'Hình ảnh, ngôn ngữ, số liệu công bố', grp: 'Thương hiệu KSB' }, { id: 'rui-ro/lanh-dao', t: 'Lãnh đạo', s: 'Phát ngôn, nhân sự cấp cao', grp: 'Lãnh đạo' }, { id: 'rui-ro/hdsx', t: 'HĐSX Kinh doanh', s: 'Mỏ, KCN, an toàn, cộng đồng', grp: 'HĐSX Kinh doanh' }, { id: 'rui-ro/tai-chinh', t: 'Tình hình tài chính', s: 'Kết quả kinh doanh, công bố thông tin', grp: 'Tình hình tài chính' }] }] },
  { id: 'hoat-dong', n: '05', t: 'Hoạt động dự kiến', d: 'Những hoạt động đang đề xuất cho năm 2027 ngoài kế hoạch truyền thông chính.', groups: [
    { items: [{ id: 'hoat-dong/hoi', t: 'Hỗ trợ công tác hội', s: 'Công đoàn, đoàn thể, hiệp hội', grp: 'Hỗ trợ công tác hội' }, { id: 'hoat-dong/esg', t: 'ESG', s: 'Môi trường, xã hội, quản trị', grp: 'ESG' }, { id: 'hoat-dong/csr', t: 'CSR', s: 'Trách nhiệm với cộng đồng', grp: 'CSR' }] }] },
  { id: 'ngan-sach', n: '06', t: 'Ngân sách', d: 'Ngân sách 2027 và chi phí 2024–2026. Cần mật khẩu để xem.', lock: 1, groups: [
    { items: [{ id: 'ngan-sach/doi-ngoai', t: 'Chi đối ngoại', s: 'Hợp đồng báo chí, tri ân báo chí, tài trợ' }, { id: 'ngan-sach/noi-bo', t: 'Nội bộ, chiến dịch và hoạt động', s: 'Nội bộ, tri ân, phim 35 năm, sự kiện, hoạt động dự kiến' }] }] }
];
const ALL = NAV.flatMap(n => [{ id: n.id, t: n.t }].concat(n.groups.flatMap(g => g.items)));
const itemsOf = id => NAV.find(n => n.id === id).groups.flatMap(g => g.items);
const tileOf = (i, k) => `<a class="tile" href="#/${i.id}" style="--c:${gColor(i.id)}"><div class="ico">${ic(gIcon(i.id))}</div><div class="k">${k}</div><h3>${i.t}</h3><p>${i.s}</p><div class="go">Xem chi tiết →</div></a>`;
function renderMenu(curTop) {
  $('#menu').innerHTML = NAV.map(n => `<li class="${n.id === curTop ? 'on' : ''}"><a href="#/${n.id}"><span class="n">${n.n}</span>${n.lock ? `<span class="lk-ic ${M.unlocked ? 'open' : ''}">${ic(M.unlocked ? 'unlock' : 'lock')}</span>` : ''}${n.t}</a>
    <div class="mega"><div class="wrap"><div class="intro"><div class="k">${n.n} · ${n.t}</div><h4>${n.t}</h4><p>${n.d}</p><a href="#/${n.id}">Xem tổng quan →</a></div>
    <div class="cols">${n.groups.map(g => `<div class="grp">${g.gt ? `<div class="gt">${g.gt}</div>` : ''}${g.items.map(i => `<a class="lk ${i.sub ? 'sub' : ''} ${i.pending ? 'pending' : ''}" href="#/${i.id}"><b>${i.t}</b><span>${i.s}</span></a>`).join('')}</div>`).join('')}</div></div></div></li>`).join('');
}

/* =========================================================
   TRANG CHỦ
   ========================================================= */
function decisions() {
  const out = [];
  M.review.filter(x => /trình|lãnh đạo|chốt/i.test(x['Đề xuất xử lý']) && !isDone(x['Trạng thái'])).forEach(x => out.push({ t: x['Đề xuất xử lý'], s: x['Vấn đề còn thiếu'], d: x.due, src: `Rà soát #${x.STT}` }));
  M.regular.filter(x => /lãnh đạo/i.test(x['Ghi chú'])).forEach(x => out.push({ t: `${x['Đầu mục']}: có tiếp tục năm 2027?`, s: x['Ghi chú'], src: 'NS 2027 · Phòng TT' }));
  const k = M.kpis.filter(x => /cần chốt/i.test(x.target)).length; if (k) out.push({ t: `Chốt ${k}/${M.kpis.length} chỉ tiêu KPI năm 2027`, s: 'Cần số liệu nền trước khi đặt chỉ tiêu', src: 'Tổng quan · mục 7' });
  const rp = M.risks.filter(r => /đề xuất/i.test(r['Trạng thái'])).length; if (rp) out.push({ t: `Duyệt điểm và kịch bản cho ${rp} rủi ro truyền thông`, s: 'Chấm điểm sơ bộ, cần lãnh đạo xem lại', src: 'Rủi ro truyền thông' });
  const pp = M.people.filter(p => /cần xác nhận/i.test(p['Người đảm nhận'])).length; if (pp) out.push({ t: `Chốt người đảm nhận cho ${pp} vai trò phát ngôn, đại diện`, s: 'Khung thương hiệu cá nhân đang ở mức đề xuất', src: 'Thương hiệu cá nhân' });
  return out;
}
function upcoming(n = 7) {
  const t0 = today(), items = [];
  M.review.filter(x => !isDone(x['Trạng thái']) && x.due).forEach(x => items.push({ d: x.due, t: x['Vấn đề còn thiếu'], s: `Rà soát #${x.STT} · ${x['Phụ trách']}` }));
  M.events.filter(e => e.w && e.w.exact).forEach(e => items.push({ d: e.w.d, t: e['Sự kiện'], s: `Sự kiện · ${e['Loại']}` }));
  return items.filter(i => days(t0, i.d) >= -30).sort((a, b) => a.d - b.d).slice(0, n);
}
function costByYear() {
  const cats = M.cp26.map(c => c['Đầu mục']).filter(n => n && !/^khác/i.test(n));
  const hist = Object.fromEntries(M.cpHist.map(h => [h['Đầu mục'], h])); const c26 = Object.fromEntries(M.cp26.map(h => [h['Đầu mục'], h]));
  const yv = cat => [num((hist[cat] || {})['Tổng 2024']), num((hist[cat] || {})['Tổng 2025']), num((c26[cat] || {})['Tổng 2026'])];
  return { cats, yv, totals: [0, 1, 2].map(i => cats.reduce((a, c) => a + yv(c)[i], 0)) };
}
function pHome() {
  const open = M.review.filter(x => !isDone(x['Trạng thái']));
  const hi = M.risks.filter(r => r.score >= 15);
  const dec = decisions(), up = upcoming();
  const slogan = msgOf('Slogan') || 'KIẾN TẠO GIÁ TRỊ BỀN VỮNG';
  const camp = splitDot(msgOf('Chiến dịch 2027'));
  const chosen = M.series.filter(x => x['Nhân vật (tên thật)']).length;
  const stat = { 'thuong-hieu': [M.assets.filter(a => isDone(a['Trạng thái'])).length + '/' + M.assets.length, 'tài sản thương hiệu đã có'], 'truyen-thong': [M.posts.length, 'đầu mục nội dung năm 2027'], 'su-kien': [M.events.length, 'sự kiện trong kế hoạch 2027'], 'rui-ro': [M.risks.length, `rủi ro đã nhận diện, ${hi.length} mức cao`], 'hoat-dong': [M.acts.length, 'hoạt động đang đề xuất'], 'ngan-sach': [M.unlocked ? fVND(M.grand) : 'Khóa', M.unlocked ? 'ngân sách 2027' : 'cần mật khẩu để xem'] };
  const tiles = NAV.map(n => `<a class="tile pic" href="#/${n.id}" style="--c:${gColor(n.id)}"><div class="im" style="--img:url('${IMG(gImg(n.id) + '-sm')}')"><div class="ico">${ic(gIcon(n.id))}</div></div><div class="bd"><div class="k">${n.n}</div><h3>${n.t}</h3><p>${n.d}</p><div class="st"><b>${stat[n.id][0]}</b><span>${stat[n.id][1]}</span></div></div></a>`).join('');
  const assetsOk = M.assets.filter(a => isDone(a['Trạng thái'])).length, revDone = M.review.length - open.length, evDated = M.events.filter(e => e.w && e.w.exact).length;
  const html = `<section class="hero" style="--img:url('${IMG('kcn-phoi-canh')}')"><div class="wrap">
    <div class="ey">KSB · Bộ phận truyền thông</div>
    <h1><b>${esc(slogan.charAt(0) + slogan.slice(1).toLowerCase())}</b></h1>
    <div class="lead">Chiến dịch 2027 <b style="color:#fff;font-weight:600">${esc(camp[0] || '')}</b> · ${esc(camp[1] || '')} ${esc((M.goals.find(g => /tổng/i.test(g[0])) || [])[1] || '')}</div>
    <div class="figs">
      <div><b>${chosen}<small>/ ${M.series.length}</small></b><span>Nhân vật Người KSB đã chốt</span></div>
      <div><b>${M.posts.length}</b><span>Đầu mục nội dung 2027</span></div>
      <div><b>${M.events.length}</b><span>Sự kiện trong kế hoạch</span></div>
      <div><b>${hi.length}<small>/ ${M.risks.length}</small></b><span>Rủi ro mức cao (điểm ≥ 15)</span></div>
      <div><b>${open.length}<small>/ ${M.review.length}</small></b><span>Việc rà soát chưa xử lý</span></div>
    </div><div class="badge"><b>01/2028</b>Kỷ niệm 35 năm KSB · còn ${Math.max(0, days(today(), new Date(CFG.MILESTONES.anniversary || '2028-01-01')))} ngày</div></div></section>
  ${sec('01', 'Sáu mảng công việc', `<div class="tiles six">${tiles}</div>`)}
  ${sec('02', 'Tiến độ chính', `<div class="gauges">${gauge('g1', assetsOk, M.assets.length, 'Tài sản thương hiệu đã có', `${assetsOk}/${M.assets.length} hạng mục`)}${gauge('g2', revDone, M.review.length, 'Việc rà soát đã xử lý', `${revDone}/${M.review.length} việc`)}${gauge('g3', chosen, M.series.length, 'Nhân vật Người KSB đã chốt', `${chosen}/${M.series.length} số`)}${gauge('g4', evDated, M.events.length, 'Sự kiện 2027 đã có ngày', `${evDated}/${M.events.length} sự kiện`)}</div>`)}
  ${sec('03', 'Điều cần quyết và hạn sắp tới', `<div class="grid g2">
    ${box('Cần lãnh đạo quyết định', `${dec.length} mục, tự lọc từ Sheet`, dec.length ? `<div class="list">${dec.map((d, i) => `<div class="li">${d.d ? dbox(d.d) : `<div class="d"><b>${pad(i + 1)}</b><span>mục</span></div>`}<div><div class="t">${esc(d.t)}</div><div class="s">${esc(d.s)}</div></div><span class="chip">${esc(d.src)}</span></div>`).join('')}</div>` : empty('Không có mục chờ quyết định'))}
    ${box('Sắp tới', 'Hạn rà soát và sự kiện đã có ngày', up.length ? `<div class="list">${up.map(u => `<div class="li">${dbox(u.d)}<div><div class="t">${esc(u.t)}</div><div class="s">${esc(u.s)}</div></div><span class="tag ${u.d < today() ? 'crit' : days(today(), u.d) <= 7 ? 'warn' : ''}">${rel(u.d)}</span></div>`).join('')}</div>` : empty('Không có hạn nào'))}
  </div>`)}
  ${sec('04', 'Người KSB', `<div class="gallery"><figure><img src="${IMG('gala-dong-tam')}" alt="Gala Đồng tâm hợp lực tiến bước"><figcaption><b>Đồng tâm hợp lực tiến bước</b>Đêm gala của người KSB</figcaption></figure><figure><img src="${IMG('pn-hoa-sm')}" alt="Ngày Phụ nữ Việt Nam 20/10/2026 tại KSB"><figcaption><b>Trân quý từng nét riêng</b>20/10/2026</figcaption></figure><figure><img src="${IMG('gala-vinh-danh-sm')}" alt="Gala KSB"><figcaption><b>Gắn kết nội bộ</b></figcaption></figure><figure><img src="${IMG('pn-tap-the-sm')}" alt="Tập thể KSB ngày 20/10"><figcaption><b>Tập thể KSB</b></figcaption></figure><figure><img src="${IMG('kcn-cong-sm')}" alt="Cổng KCN Đất Cuốc"><figcaption><b>KCN Đất Cuốc</b></figcaption></figure></div><div class="src">Ảnh: thư viện ảnh của bộ phận truyền thông trên Google Drive</div>`)}
  ${sec('05', 'Kênh nội dung và rủi ro', `<div class="grid g2">${box('Lịch nội dung 2027 theo kênh', `${M.posts.length} đầu mục`, donutBox('c-chs', M.posts.length, 'đầu mục', 'lg'), 'Lịch nội dung 2027')}
    ${box('Bản đồ rủi ro truyền thông', 'Mỗi chấm là một rủi ro, số trong chấm là STT', riskMatrix(M.risks) + `<div style="margin-top:12px"><a href="#/rui-ro">Xem quản trị rủi ro →</a></div>`, 'Rủi ro truyền thông')}</div>${lockCard('Ngân sách 2027, chi phí 2024–2026, hợp đồng báo chí, tài trợ')}`)}`;
  const chc = countBy(M.posts, p => p['Kênh']); const chk = Object.keys(chc);
  const after = () => {
    makeDonut('c-chs', chk, chk.map(k => chc[k]), chk.map((k, i) => ({ Facebook: '#0d4f9b', YouTube: '#e3242b', Website: '#5b8fd1' }[k] || C[i])));
    makeGauge('g1', assetsOk, M.assets.length, '#0d4f9b'); makeGauge('g2', revDone, M.review.length, '#6a4fb3'); makeGauge('g3', chosen, M.series.length, '#e3242b'); makeGauge('g4', evDated, M.events.length, '#c98a00');
  };
  return { html, after };
}

/* =========================================================
   01 · THƯƠNG HIỆU
   ========================================================= */
const assetTable = () => `<div class="xs"><table class="tbl"><tr><th>Hạng mục</th><th>Trạng thái</th><th>Căn cứ</th><th>Việc tiếp theo</th></tr>${M.assets.map(a => `<tr><td><b>${esc(a['Hạng mục'])}</b></td><td>${tag(a['Trạng thái'])}</td><td>${esc(a['Căn cứ'])}</td><td>${esc(a['Việc tiếp theo'])}</td></tr>`).join('')}</table></div>`;
function pBrandHub() {
  const ok = M.assets.filter(a => isDone(a['Trạng thái'])).length, doing = M.assets.filter(a => /đang/i.test(a['Trạng thái'])).length;
  const html = `${head({ crumb: [{ t: 'Thương hiệu' }], title: '<b>Thương hiệu</b>, nền tảng cho mọi thông điệp', lead: 'Hai lớp thương hiệu: công ty (KSB nói gì) và cá nhân (ai nói thay KSB). Dữ liệu đọc từ tab Thương hiệu công ty và Thương hiệu cá nhân.', figs: [fig(M.arch.length, 'thành tố trong hệ thống thông điệp'), fig(`${ok}<small>/ ${M.assets.length}</small>`, 'tài sản thương hiệu đã có'), fig(doing, 'tài sản đang hoàn thiện'), fig(M.people.length, 'vai trò đại diện, phát ngôn')] })}
  ${sec('01', 'Các mục trong nhóm', `<div class="tiles">${itemsOf('thuong-hieu').map(i => tileOf(i, 'Thương hiệu')).join('')}</div>`)}
  ${sec('02', 'Tình trạng tài sản thương hiệu', `<div class="grid g46">${box('Mức độ hoàn thiện', `${pct(ok, M.assets.length)}% đã có`, donutBox('c-ast', `${ok}/${M.assets.length}`, 'đã có', 'lg'), 'Thương hiệu công ty · bảng 2')}<div class="photo-card" style="--img:url('${IMG('kcn-cong')}')"><div class="pc"><b>${esc((M.arch.find(a => a['Thành tố'] === 'Slogan') || {})['Nội dung'] || '')}</b><span>Slogan thương hiệu KSB</span></div></div></div><div style="height:20px"></div>${box('Danh mục tài sản thương hiệu', '', assetTable(), 'Thương hiệu công ty · bảng 2')}`)}`;
  const after = () => makeDonut('c-ast', ['Đã có', 'Đang làm', 'Chưa có'], [ok, doing, M.assets.length - ok - doing], ['#1a7f4b', '#5b8fd1', '#e3242b']);
  return { html, after };
}
function msgSystem(A, vals, letters) {
  const g = k => A.find(a => a['Thành tố'] === k) || {};
  const role = k => g(k)['Vai trò'] ? `<div class="mr">${esc(g(k)['Vai trò'])}</div>` : '';
  const card = (k, cls, icon, body) => `<div class="mc ${cls}"><div class="mh"><span class="mi">${ic(icon)}</span><span class="mn">${pad(g(k)['Thứ tự'])}</span></div><div class="mt">${esc(k)}</div>${body}${role(k)}</div>`;
  const vc = ['#1a7f4b', '#0d4f9b', '#e3242b'];
  const L = letters.length ? letters : [{ L: 'K', en: 'Knowledge' }, { L: 'S', en: 'Sustainability' }, { L: 'B', en: 'Building' }];
  const layer = (n, t, d, cards, cls) => `<div class="ml ${cls}"><div class="mlh"><b>${n}</b><span>${t}</span><small>${d}</small></div><div class="mlc">${cards}</div></div>`;
  return `<div class="msys">
    ${layer('1', 'Định hướng', 'KSB đi đâu, làm gì', card('Tầm nhìn', 'm-vis', 'eye', `<div class="mv">${esc(g('Tầm nhìn')['Nội dung'])}</div>`) + card('Sứ mệnh', 'm-mis', 'target', `<div class="mv">${esc(g('Sứ mệnh')['Nội dung'])}</div>`), 'l1')}
    ${layer('2', 'Bản sắc', 'KSB hành xử thế nào', card('Giá trị cốt lõi', 'm-val', 'gem', `<div class="mchips">${vals.map((v, i) => `<span style="--c:${vc[i % 3]}">${esc(v)}</span>`).join('')}</div>`) + card('Ý nghĩa thương hiệu', 'm-ksb', 'brand', `<div class="mletters">${L.map((l, i) => `<div style="--c:${vc[(i + 1) % 3]}"><b>${esc(l.L)}</b><span>${esc(l.en)}</span></div>`).join('')}</div>`) + card('Triết lý kinh doanh', 'm-phi', 'root', `<div class="mbig">${esc(g('Triết lý kinh doanh')['Nội dung'])}</div>`), 'l2')}
    ${layer('3', 'Cam kết', 'KSB nói gì ra bên ngoài', `<div class="mslogan"><span class="mi">${ic('quote')}</span><div><small>${pad(g('Slogan')['Thứ tự'])} · Slogan</small><b>${esc(g('Slogan')['Nội dung'])}</b>${g('Slogan')['Vai trò'] ? `<span>${esc(g('Slogan')['Vai trò'])}</span>` : ''}</div></div>`, 'l3')}
  </div><div class="src">Thương hiệu công ty · bảng 1</div>`;
}
function ksbStory(letters, ksbLine, vals, camp) {
  const L = letters.length ? letters : [{ L: 'K', en: 'Knowledge', vi: 'Tri thức' }, { L: 'S', en: 'Sustainability', vi: 'Sự bền vững' }, { L: 'B', en: 'Building', vi: 'Kiến tạo' }];
  const meta = { K: ['k', 'Nền tảng', 'news'], S: ['s', 'Giá trị hướng tới', 'act'], B: ['b', 'Cách làm', 'layers'] };
  const cards = L.map(l => { const m = meta[l.L] || ['k', '', 'brand']; return `<div class="kc kc-${m[0]}"><span class="kw">${esc(l.L)}</span><div class="kt">${ic(m[2])}<span>${esc(m[1])}</span></div><b class="kl">${esc(l.L)}</b><div class="ken">${esc(l.en)}</div><div class="kvi">${esc(l.vi)}</div></div>`; }).join('');
  let line = esc(ksbLine || '');
  [['tri thức', 'k'], ['bền vững', 's'], ['kiến tạo', 'b']].forEach(([w, c]) => { line = line.replace(new RegExp(`(${w})`, 'i'), `<mark class="hl-${c}">$1</mark>`); });
  const chosen = M.series.filter(x => x['Nhân vật (tên thật)']).length;
  const ann = new Date(CFG.MILESTONES.anniversary || '2028-01-01'), dleft = Math.max(0, days(today(), ann));
  return `<div class="kgrid">${cards}</div>
  ${line ? `<div class="kline"><small>Ghép ba chữ thành một câu</small><p>${line}</p></div>` : ''}
  <div class="kflow">
    <div class="kf kf-root"><small>Triết lý</small><b>${esc(msgOf('Triết lý kinh doanh') || 'Bền vững từ gốc')}</b><div class="kvals">${vals.map(v => `<span>${esc(v)}</span>`).join('')}</div><em>Giá trị cốt lõi</em></div>
    <div class="karr">${ic('arrow')}</div>
    <div class="kf kf-camp" style="--img:url('${IMG('pn-tap-the')}')"><small>Chiến dịch truyền thông 2027 · Big idea</small><b>${esc(camp[0] || 'NGƯỜI KSB')}</b><span>${esc(camp[1] || '')}</span></div>
    <div class="karr">${ic('arrow')}</div>
    <div class="kf kf-out"><small>Đầu ra</small>
      <div class="ko"><b>${chosen}<i>/ ${M.series.length || 12}</i></b><span>nhân vật series Người KSB đã chốt</span></div>
      <div class="ko"><b>${dleft}<i>ngày</i></b><span>đến kỷ niệm 35 năm, công chiếu phim tài liệu</span></div>
    </div>
  </div><div class="src">Thương hiệu công ty · bảng 1 · Series hàng tháng</div>`;
}
function logoRules() {
  const L = M.assets.find(a => /logo/i.test(a['Hạng mục'])) || {};
  const sents = String(L['Căn cứ'] || '').split(/\.\s*/).map(x => x.trim()).filter(Boolean);
  const first = (sents.shift() || '').split(/,\s*/).filter(Boolean);
  const dos = first.filter(x => !/^không/i.test(x)), donts = first.filter(x => /^không/i.test(x));
  const uses = sents.join('; ').split(/;\s*/).filter(Boolean).map(u => { const m = u.match(/^(.*?)\s+(ưu tiên cho|cho)\s+(.*)$/i); return m ? [m[1], m[3]] : [u, '']; });
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  return `<div class="lgrid">
    <div class="lshow"><div class="lstage"><img src="assets/img/logo-ksb.png" alt="Logo KSB"></div>
      <div class="lmeta"><div><b>${esc(L['Hạng mục'] || 'Logo KSB')}</b>${tag(L['Trạng thái'] || '')}</div>
      <div class="lsw"><span><i style="background:#0c509c"></i>Xanh KSB <code>#0C509C</code></span><span><i style="background:#ec1f28"></i>Đỏ KSB <code>#EC1F28</code></span></div></div></div>
    <div class="lrules">
      <div class="lcol ok"><h4>${ic('check')}Được làm</h4>${dos.map(d => `<p>${esc(cap(d))}</p>`).join('')}${uses.map(u => `<p><b>${esc(cap(u[0]))}</b>${u[1] ? ` → ${esc(u[1])}` : ''}</p>`).join('')}</div>
      <div class="lcol no"><h4>${ic('alert')}Không được</h4>${donts.map(d => `<p>${esc(cap(d))}</p>`).join('')}<p>Không dùng file logo chưa được Ban giám đốc duyệt</p></div>
      ${L['Việc tiếp theo'] ? `<div class="lnext">${ic('clock')}<div><small>Việc tiếp theo</small><b>${esc(L['Việc tiếp theo'])}</b></div></div>` : ''}
    </div></div><div class="src">Thương hiệu công ty · bảng 2 · mã màu lấy từ file logo đã duyệt</div>`;
}
function langAudience() {
  const AI = [[/báo chí|công chúng/i, 'news', '#0d4f9b'], [/cổ đông|đầu tư/i, 'chart', '#6a4fb3'], [/lao động|gia đình/i, 'users', '#e3242b'], [/chính quyền|cộng đồng/i, 'act', '#1a7f4b'], [/ứng viên/i, 'check', '#c98a00']];
  const aud = M.audience.map((a, i) => { const m = AI.find(x => x[0].test(a.who)) || [0, 'users', '#0d4f9b']; return `<div class="au" style="--c:${m[2]}"><span class="mi" style="--mc:${m[2]}">${ic(m[1])}</span><div class="aw">${esc(a.who)}</div><div class="af">“${esc(a.feel)}”</div></div>`; }).join('');
  const pairs = M.lang.map(l => `<div class="lp"><div class="lno"><small>Tránh</small><s>${esc(l.no)}</s></div><div class="lar">${ic('arrow')}</div><div class="lyes"><small>Dùng thay</small><b>${esc(l.yes)}</b></div>${l.note ? `<div class="lnt">ⓘ ${esc(l.note)}</div>` : ''}</div>`).join('');
  return `<h4 class="subh"><span>A</span>Điều mỗi nhóm đối tượng cần cảm nhận <em>${M.audience.length} nhóm</em></h4><div class="augrid">${aud}</div><div class="src">Tổng quan · mục 5</div>
  <h4 class="subh"><span>B</span>Từ hạn chế → từ dùng thay <em>${M.lang.length} cặp</em></h4><div class="lpgrid">${pairs}</div><div class="src">Tổng quan · mục 4</div>`;
}
function pBrandCompany() {
  const order = ['Tầm nhìn', 'Sứ mệnh', 'Giá trị cốt lõi', 'Ý nghĩa thương hiệu', 'Triết lý kinh doanh', 'Slogan'];
  const A = order.map(k => M.arch.find(a => a['Thành tố'] === k)).filter(Boolean);
  const vals = splitDot(msgOf('Giá trị cốt lõi'));
  const ksbTxt = msgOf('Ý nghĩa thương hiệu'); const letters = [...ksbTxt.matchAll(/([KSB]):\s*([A-Za-z]+)\s*\(([^)]+)\)/g)].map(m => ({ L: m[1], en: m[2], vi: m[3] }));
  const ksbLine = ksbTxt.replace(/^.*\)\.\s*/, '').trim();
  const camp = splitDot(msgOf('Chiến dịch 2027'));
  const html = `${head({ crumb: [{ id: 'thuong-hieu', t: 'Thương hiệu' }, { t: 'Thương hiệu công ty' }], title: 'Xây dựng <b>thương hiệu công ty</b>', lead: 'Từ tầm nhìn đến slogan: mỗi thành tố có một vai trò và nối thành một mạch thống nhất cho mọi tài liệu, phát biểu và kênh truyền thông.', tabs: tabsOf(itemsOf('thuong-hieu'), 'thuong-hieu/cong-ty') })}
  ${sec('01', 'Hệ thống thông điệp', msgSystem(A, vals, letters))}
  ${sec('02', 'Ý nghĩa ba chữ K · S · B', ksbStory(letters, ksbLine, vals, camp))}
  ${sec('03', 'Logo và quy định sử dụng', logoRules())}
  ${sec('04', 'Ngôn ngữ và đối tượng', langAudience())}`;
  return { html };
}
function pBrandPersonal() {
  const approved = M.people.filter(p => !/đề xuất/i.test(p['Trạng thái'])).length;
  const chosen = M.series.filter(s => s['Nhân vật (tên thật)']).length;
  const html = `${head({ crumb: [{ id: 'thuong-hieu', t: 'Thương hiệu' }, { t: 'Thương hiệu cá nhân' }], title: 'Xây dựng <b>thương hiệu cá nhân</b>', lead: 'Ai đại diện cho KSB trước cổ đông, báo chí, nhà đầu tư và người lao động; mỗi người gắn với một phần của hệ thống thông điệp.', tabs: tabsOf(itemsOf('thuong-hieu'), 'thuong-hieu/ca-nhan'), figs: [fig(M.people.length, 'vai trò trong khung'), fig(`${approved}<small>/ ${M.people.length}</small>`, 'vai trò đã duyệt hoặc đang chạy'), fig(M.people.filter(p => /cần xác nhận/i.test(p['Người đảm nhận'])).length, 'vai trò chưa có người', 'alert'), fig(`${chosen}<small>/ ${M.series.length}</small>`, 'nhân vật Người KSB đã chốt')] })}
  ${sec('01', 'Khung đại diện thương hiệu', `${say('Khung đang ở mức <b>đề xuất</b>. Cần Ban giám đốc chốt người đảm nhận từng vai trò, trước hết là người phát ngôn và người công bố thông tin, trước ĐHĐCĐ 2027.')}
   <div class="grid">${box('Vai trò, kênh và thông điệp', '', `<div class="xs"><table class="tbl"><tr><th>Đối tượng</th><th>Vai trò truyền thông</th><th>Kênh, tần suất</th><th>Thông điệp</th><th>Trạng thái</th></tr>${M.people.map(p => `<tr><td><b>${esc(p['Đối tượng'])}</b><span class="sub">${esc(p['Nhóm'])} · ${esc(p['Người đảm nhận'])}</span></td><td>${esc(p['Vai trò truyền thông'])}</td><td>${esc(p['Kênh, hình thức'])}<span class="sub">${esc(p['Tần suất'])}</span></td><td>${esc(p['Thông điệp gắn với'])}</td><td>${tag(p['Trạng thái'])}</td></tr>`).join('')}</table></div>`, 'Thương hiệu cá nhân')}
</div>`)}
  ${sec('02', 'Đại sứ Người KSB · 12 nhân vật', box('', '', `<div class="xs"><table class="tbl"><tr><th>Số</th><th>Câu chuyện</th><th>Khối, đơn vị</th><th>Phát hành</th><th>Nhân vật</th><th>Trạng thái</th></tr>${M.series.map(s => `<tr><td>${esc(s['Số'])}</td><td><b>${esc(s['Tên câu chuyện (tạm)'])}</b></td><td>${esc(s['Khối / đơn vị'])}</td><td class="tnum">${esc(s['Ngày phát hành dự kiến'])}</td><td>${esc(s['Nhân vật (tên thật)'] || 'chưa chọn')}</td><td>${tag(s['Trạng thái'])}</td></tr>`).join('')}</table></div>`, 'Series hàng tháng'))}`;
  return { html };
}

/* =========================================================
   02 · TRUYỀN THÔNG
   ========================================================= */
function catQuarters(cat) {
  const h = M.cpHist.find(x => x['Đầu mục'] === cat) || {}, c = M.cp26.find(x => x['Đầu mục'] === cat) || {};
  const labels = [], vals = [];
  ['2024', '2025'].forEach(y => [1, 2, 3, 4].forEach(q => { labels.push(`Q${q}/${y.slice(2)}`); vals.push(num(h[`${y} · Q${q}`])); }));
  [1, 2, 3, 4].forEach(q => { labels.push(`Q${q}/26`); vals.push(num(c['Q' + q])); });
  return { labels, vals, y24: num(h['Tổng 2024']), y25: num(h['Tổng 2025']), y26: num(c['Tổng 2026']) };
}
function pCommHub() {
  const internal = M.posts.filter(p => /nội bộ/i.test(p['Trụ cột']));
  const ext = M.events.filter(e => /bên ngoài|báo chí/i.test(e['Loại']));
  const html = `${head({ crumb: [{ t: 'Truyền thông' }], title: '<b>Truyền thông</b> đối ngoại và đối nội', lead: 'Đối ngoại gồm báo chí, tài trợ và chương trình sự kiện bên ngoài; đối nội gồm nội dung văn hóa, sự kiện và hoạt động gắn kết người KSB.', figs: [fig(M.press.length, 'bài báo về KSB đã ghi nhận'), fig(ext.length, 'sự kiện báo chí, bên ngoài 2027'), fig(internal.length, 'đầu mục nội dung nội bộ 2027'), fig(M.posts.length, 'đầu mục nội dung 2027')] })}
  ${sec('01', 'Các mục trong nhóm', `<div class="grid g64"><div><div class="sh" style="margin-bottom:12px"><h2 style="font-size:15px">Truyền thông đối ngoại</h2></div><div class="tiles">${NAV[1].groups[0].items.map(i => tileOf(i, 'Đối ngoại')).join('')}</div></div><div><div class="sh" style="margin-bottom:12px"><h2 style="font-size:15px">Đối nội và kênh số</h2></div><div class="tiles">${NAV[1].groups[1].items.map(i => tileOf(i, 'Đối nội')).join('')}${NAV[1].groups[2].items.map(i => tileOf(i, 'Kênh số')).join('')}</div></div></div>${lockCard('Chi đối ngoại theo quý 2024–2026, cơ cấu chi 2026')}`)}`;
  return { html };
}
function pPress() {
  const kpi = M.kpis.find(k => /báo/i.test(k.name));
  const pe = M.events.filter(e => /báo chí/i.test(e['Loại']));
  const cov = M.press; const sent = countBy(cov, p => p['Sắc thái']); const outlets = countBy(cov, p => p['Báo / tạp chí']);
  const prPosts = M.posts.filter(p => /báo|PR/i.test(p['Kênh'] + ' ' + p['Định dạng']));
  const html = `${head({ crumb: [{ id: 'truyen-thong', t: 'Truyền thông' }, { t: 'Đối ngoại' }, { t: 'Báo chí' }], title: 'Truyền thông đối ngoại · <b>Báo chí</b>', lead: 'Theo dõi bài đăng về KSB, sự kiện với báo chí và kế hoạch năm 2027. Hợp đồng và thanh toán xem ở mục Ngân sách.', tabs: tabsOf(NAV[1].groups[0].items, 'truyen-thong/bao-chi'), figs: [fig(cov.length, 'bài báo đã ghi nhận'), fig(Object.keys(outlets).length, 'cơ quan báo chí có bài'), fig(pe.length, 'sự kiện với báo chí 2027'), fig(kpi ? (kpi.target || 'chưa có') : '–', 'chỉ tiêu báo chí 2027', kpi && /cần chốt|chưa/i.test(kpi.target) ? 'alert' : '')] })}
  ${sec('01', 'Theo dõi bài báo về KSB', cov.length ? `<div class="grid g3">${box('Theo sắc thái', '', canvas('c-sent', 'sm'))}${box('Theo cơ quan báo chí', '', canvas('c-outlet', 'sm'))}${box('Bài mới nhất', '', `<div class="list">${cov.slice().sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 6).map(p => `<div class="li">${dbox(p.date, true)}<div><div class="t">${p['Link'] ? `<a href="${esc(p['Link'])}" target="_blank" rel="noopener">${esc(p['Tiêu đề'])}</a>` : esc(p['Tiêu đề'])}</div><div class="s">${esc(p['Báo / tạp chí'])} · ${esc(p['Loại'])}</div></div>${tag(p['Sắc thái'])}</div>`).join('')}</div>`)}</div>` : empty('Chưa ghi nhận bài báo nào', 'Mỗi bài báo nhắc đến KSB, Đất Cuốc, Hoa Lư ghi một dòng vào tab Theo dõi báo chí. Trang sẽ tự vẽ biểu đồ theo báo và theo sắc thái.') + `<div class="note" style="margin-top:14px">Hiện chưa đo được kết quả của các hợp đồng báo chí năm 2026${kpi ? `; chỉ tiêu “${esc(kpi.name)}” đang ở trạng thái “${esc(kpi.target || 'chưa có')}”` : ''}.</div>`)}
  ${sec('02', 'Kế hoạch 2027', `<div class="grid g2">${box('Sự kiện với báo chí', '', eventList(pe), 'Sự kiện 2027')}${box('Việc còn thiếu', '', reviewList(reviewItems(/theo dõi|báo chí/i)), 'Rà soát 2027')}</div>${lockCard('Giá trị hợp đồng theo đơn vị, tình trạng thanh toán, chi báo chí theo quý, bài PR 2027')}`)}`;
  const after = () => { if (cov.length) { const s = Object.keys(sent); chart('c-sent', { type: 'doughnut', data: { labels: s, datasets: [{ data: s.map(k => sent[k]), backgroundColor: s.map(k => /tích/i.test(k) ? '#1a7f4b' : /tiêu/i.test(k) ? '#e3242b' : '#a9c4e8'), borderColor: '#fff', borderWidth: 2 }] }, options: { cutout: '68%' } }); const o = Object.entries(outlets).sort((a, b) => b[1] - a[1]).slice(0, 8); barChart('c-outlet', o.map(x => x[0]), [{ label: 'Bài', data: o.map(x => x[1]) }], { horizontal: true }); } };
  return { html, after };
}
function pSponsor() {
  const ext = M.events.filter(e => /tài trợ/i.test(e['Sự kiện']));
  const crit = [['Phù hợp thông điệp', 'Gắn với Bền vững, Đổi mới, Đồng hành hoặc con người KSB'], ['Đối tượng', 'Tiếp cận cổ đông, nhà đầu tư KCN, cộng đồng quanh mỏ và KCN'], ['Quyền lợi truyền thông', 'Logo, phát biểu, bài báo, hình ảnh dùng lại được'], ['Rủi ro', 'Không gắn với đơn vị hoặc sự kiện đang có tranh cãi'], ['Đo lường', 'Có số liệu sau tài trợ: lượt tiếp cận, bài báo, khách hàng tiềm năng']];
  const html = `${head({ crumb: [{ id: 'truyen-thong', t: 'Truyền thông' }, { t: 'Đối ngoại' }, { t: 'Tài trợ' }], title: 'Truyền thông đối ngoại · <b>Tài trợ</b>', lead: 'Bộ tiêu chí đề xuất để chọn chương trình tài trợ và các chương trình đang cân nhắc. Lịch sử chi và dự toán xem ở mục Ngân sách.', tabs: tabsOf(NAV[1].groups[0].items, 'truyen-thong/tai-tro'), figs: [fig(crit.length, 'tiêu chí chấm đề nghị tài trợ'), fig(ext.length, 'chương trình đang cân nhắc'), fig(ext.filter(e => !e.w).length, 'chưa có thời gian', 'alert')] })}
  ${sec('01', 'Bộ tiêu chí chọn chương trình tài trợ', `${say('Đề xuất của bộ phận truyền thông: chấm từng đề nghị tài trợ theo năm tiêu chí trước khi trình duyệt. Cần lãnh đạo góp ý trước khi áp dụng.')}<div class="steps" style="--n:${crit.length}">${crit.map(c => `<div><b>${esc(c[0])}</b>${esc(c[1])}</div>`).join('')}</div>`)}
  ${sec('02', 'Chương trình đang cân nhắc', box('', '', eventList(ext), 'Sự kiện 2027') + lockCard('Chi tài trợ theo quý 2024–2026 và dự toán 2027'))}`;
  return { html };
}
function pExternalEvents() {
  const evs = M.events.filter(e => /bên ngoài/i.test(e['Loại']));
  const kcnPosts = M.posts.filter(p => /KCN|Industrial/i.test(p['Trụ cột']));
  const html = `${head({ crumb: [{ id: 'truyen-thong', t: 'Truyền thông' }, { t: 'Đối ngoại' }, { t: 'Chương trình sự kiện bên ngoài' }], title: 'Đối ngoại · <b>Chương trình sự kiện bên ngoài</b>', lead: 'Sự kiện KSB tham dự hoặc đồng hành ngoài công ty: xúc tiến đầu tư KCN, sự kiện của đối tác và chính quyền địa phương.', tabs: tabsOf(NAV[1].groups[0].items, 'truyen-thong/su-kien-ben-ngoai'), figs: [fig(evs.length, 'chương trình đang đề xuất'), fig(evs.filter(e => !e.w).length, 'chưa có thời gian', 'alert'), fig(kcnPosts.length, 'bài về KSB Industrial và KCN năm 2027'), fig(reviewItems(/KCN/i).length, 'việc rà soát liên quan KCN')] })}
  ${sec('01', 'Danh sách chương trình', `${say('Mục này mới ở mức <b>khung</b>: chưa có lịch hội nghị xúc tiến đầu tư hay sự kiện đối tác cụ thể. Cần phòng kinh doanh KCN cung cấp danh sách sự kiện năm 2027.')}<div class="grid g64">${box('Chương trình bên ngoài', 'Loại: Bên ngoài', eventList(evs), 'Sự kiện 2027')}${box('Việc chuẩn bị', '', reviewList(reviewItems(/KCN/i)), 'Rà soát 2027')}</div>`)}
  ${sec('02', 'Nội dung hỗ trợ cho KCN', box('Bài về KSB Industrial và KCN trong lịch 2027', `${kcnPosts.length} đầu mục`, postList(kcnPosts, 8), 'Lịch nội dung 2027'))}`;
  return { html };
}
function pInternal() {
  const ip = M.posts.filter(p => /nội bộ/i.test(p['Trụ cột']));
  const chs = ['Facebook', 'YouTube', 'Website'];
  const evs = M.events.filter(e => /nội bộ/i.test(e['Loại']));
  const html = `${head({ crumb: [{ id: 'truyen-thong', t: 'Truyền thông' }, { t: 'Truyền thông đối nội' }], title: 'Truyền thông <b>đối nội</b>', lead: 'Người KSB trước hết là câu chuyện cho chính người KSB: nội dung văn hóa, đề cử nhân vật, chiếu clip quý tại văn phòng, mỏ và KCN.', figs: [fig(ip.length, 'đầu mục nội dung nội bộ 2027'), fig(evs.length, 'sự kiện nội bộ'), fig(reviewItems(/nội bộ|nhân vật/i).filter(x => !isDone(x['Trạng thái'])).length, 'việc rà soát chưa xử lý', 'alert')] })}
  ${sec('Ảnh', 'Khoảnh khắc nội bộ gần đây', `<div class="gallery"><figure><img src="${IMG('pn-tap-the')}" alt="Tập thể KSB ngày 20/10/2026"><figcaption><b>Trân quý từng nét riêng</b>Ngày Phụ nữ Việt Nam 20/10/2026</figcaption></figure><figure><img src="${IMG('pn-chuc-mung-sm')}" alt="Chúc mừng 20/10"><figcaption><b>Chúc mừng 20/10</b></figcaption></figure><figure><img src="${IMG('pn-tang-cay-sm')}" alt="Tặng quà 20/10"><figcaption><b>Quà tặng chị em</b></figcaption></figure><figure><img src="${IMG('gala-dong-tam-sm')}" alt="Gala"><figcaption><b>Gala Đồng tâm hợp lực</b></figcaption></figure><figure><img src="${IMG('pn-nhom-sm')}" alt="20/10"><figcaption><b>Người KSB</b></figcaption></figure></div><div class="src">Ảnh: thư mục HÌNH ẢNH và 02. GALA trên Google Drive</div>`)}
  ${sec('01', 'Nhịp nội dung nội bộ trong năm', `<div class="grid g64">${box('Số đầu mục theo tháng và kênh', 'Trụ cột Nội bộ & văn hóa', canvas('c-in', 'lg'), 'Lịch nội dung 2027')}${box('Việc còn thiếu', '', reviewList(reviewItems(/nội bộ|nhân vật|đào tạo/i)), 'Rà soát 2027')}</div>`)}
  ${sec('02', 'Sự kiện nội bộ', `<div class="grid g2">${box('Sự kiện nội bộ 2027', '', eventList(evs), 'Sự kiện 2027')}${lockCard('Ngân sách nội bộ và tri ân theo quý')}</div>`)}`;
  const after = () => barChart('c-in', MON, chs.map(c => ({ label: c, data: MON.map((_, i) => ip.filter(p => p.date && p.date.getMonth() === i && p['Kênh'] === c).length) })), { stacked: true });
  return { html, after };
}

/* =========================================================
   03 · SỰ KIỆN
   ========================================================= */
const EV_COLOR = { 'Kỷ niệm': C[1], 'Cổ đông': C[0], 'Báo chí': C[2], 'Nội bộ': '#1a7f4b', 'Bên ngoài': C[3] };
function pEventsHub() {
  const evs = M.events; const byType = countBy(evs, e => e['Loại']);
  const items = evs.filter(e => e.w).map(e => ({ d: e.w.d, t: e['Sự kiện'], k: e['Loại'] + (e.w.exact ? ' · ngày ' + e.w.d.getDate() : ''), c: EV_COLOR[e['Loại']] || C[6], tip: e['Căn cứ'] }));
  const sorted = evs.slice().sort((a, b) => ((a.w && a.w.d) || 9e15) - ((b.w && b.w.d) || 9e15));
  const html = `${head({ crumb: [{ t: 'Sự kiện' }], title: '<b>Sự kiện</b> 2027', lead: 'Toàn bộ sự kiện trong năm theo loại: kỷ niệm, cổ đông, báo chí, nội bộ và bên ngoài. Sửa ở tab Sự kiện 2027.', figs: [fig(evs.length, 'sự kiện trong kế hoạch'), fig(evs.filter(e => e.w && e.w.exact).length, 'đã có ngày cụ thể'), fig(evs.filter(e => !e.w).length, 'chưa xác định thời gian', 'alert'), fig(evs.filter(e => /đề xuất/i.test(e['Trạng thái'])).length, 'đang ở mức đề xuất')] })}
  ${sec('01', 'Sự kiện theo loại', `<div class="tiles">${itemsOf('su-kien').map(i => { const n = evs.filter(e => i.types.includes(e['Loại'])).length; return `<a class="tile" href="#/${i.id}" style="--c:${gColor(i.id)}"><div class="ico">${ic(gIcon(i.id))}</div><div class="k">Sự kiện</div><h3>${i.t}</h3><p>${i.s}</p><div class="st"><b>${n}</b><span>sự kiện</span></div></a>`; }).join('')}</div><div style="margin-top:14px;font-size:13px">Lịch lễ, Tết và ngày kỷ niệm trong năm: <a href="#/su-kien/le-tet">xem ${M.holidays.length} mốc →</a></div>`)}
  ${sec('02', 'Dòng thời gian T11/2026 – T1/2028', box('', '', monthsTimeline(items, new Date(2026, 10, 1), 15) + `<div class="legend">${Object.entries(EV_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}</div>`, 'Sự kiện 2027'))}
  ${sec('03', 'Danh sách đầy đủ', `<div class="grid g64">${box('', '', eventList(sorted), 'Sự kiện 2027')}<div class="grid">${box('Sự kiện theo loại', '', donutBox('c-evt', evs.length, 'sự kiện', 'lg'), 'Sự kiện 2027')}<div class="photo-card" style="--img:url('${IMG('gala-mc-sm')}')"><div class="pc"><b>Sự kiện của người KSB</b><span>Ảnh: thư viện bộ phận truyền thông</span></div></div></div></div>`)}`;
  const after = () => { const k = Object.keys(byType); makeDonut('c-evt', k, k.map(x => byType[x]), k.map(x => EV_COLOR[x] || C[6])); };
  return { html, after };
}
function pAnniversary() {
  const ann = new Date(CFG.MILESTONES.anniversary || '2028-01-01'); const d = Math.max(0, days(today(), ann));
  const chosen = M.series.filter(s => s['Nhân vật (tên thật)']).length;
  const evs = M.events.filter(e => /kỷ niệm|35|vinh danh/i.test(e['Loại'] + ' ' + e['Sự kiện']));
  const html = `${head({ crumb: [{ id: 'su-kien', t: 'Sự kiện' }, { t: 'Sự kiện kỷ niệm' }], title: 'Sự kiện kỷ niệm · <b>35 năm KSB</b>', lead: 'Lễ kỷ niệm và công chiếu phim tài liệu Người KSB, tháng 01/2028. Tư liệu của 12 số series năm 2027 là chất liệu cho bộ phim.', tabs: tabsOf(itemsOf('su-kien'), 'su-kien/ky-niem'), figs: [fig(`${d}<small>ngày</small>`, `đến tháng ${pad(ann.getMonth() + 1)}/${ann.getFullYear()}`), fig(evs.length, 'sự kiện gắn với dịp 35 năm'), fig(`${chosen}<small>/ ${M.series.length}</small>`, 'nhân vật đã chốt', chosen ? '' : 'alert'), fig(M.filmMs.length, 'mốc sản xuất phim')] })}
  ${sec('01', 'Lộ trình đến lễ kỷ niệm', `${say('Kế hoạch <b>sự kiện</b> 35 năm và ngày công chiếu chưa có; tháng 01/2028 trùng Tết Mậu Thân (26/1/2028), cần chốt ngày sớm.')}<div class="steps" style="--n:${M.filmMs.length}">${M.filmMs.map(x => `<div><b>${esc(x['Thời gian'])}</b><span style="color:var(--ink);font-weight:600">${esc(x['Mốc'])}</span><br>${esc(x['Việc cần làm'])}<div style="margin-top:8px">${tag(x['Trạng thái'])}</div></div>`).join('')}</div><div class="src">Phim 35 năm</div>`)}
  ${sec('02', 'Định hướng phim và sự kiện', `<div class="grid g2">${box('Phim tài liệu', '', `<table class="tbl">${M.film.map(f => `<tr><td style="width:140px"><b>${esc(f.k)}</b></td><td>${esc(f.v)}${f.n ? `<span class="sub" style="color:var(--warn)">${esc(f.n)}</span>` : ''}</td></tr>`).join('')}</table>`, 'Phim 35 năm')}${box('Sự kiện gắn với dịp 35 năm', '', eventList(evs), 'Sự kiện 2027')}</div>`)}
  ${sec('03', 'Việc còn thiếu', box('', '', reviewList(reviewItems(/sự kiện|dữ liệu|nhân vật/i)), 'Rà soát 2027'))}`;
  return { html };
}
function pAGM() {
  const ir = M.posts.filter(p => /IR|minh bạch/i.test(p['Trụ cột']));
  const evs = M.events.filter(e => /cổ đông/i.test(e['Loại']));
  const hol = M.holidays.filter(h => /ĐHĐCĐ|thường niên|cổ đông|BCTN/i.test(h['Sự kiện']));
  const fin = M.risks.filter(r => /tài chính/i.test(r['Nhóm'])).sort((a, b) => b.score - a.score);
  const html = `${head({ crumb: [{ id: 'su-kien', t: 'Sự kiện' }, { t: 'Sự kiện cổ đông' }], title: 'Sự kiện cổ đông · <b>ĐHĐCĐ và công bố thông tin</b>', lead: 'ĐHĐCĐ thường niên 2027 và các mốc công bố thông tin trong năm. Ngày chính xác chờ IR xác nhận.', tabs: tabsOf(itemsOf('su-kien'), 'su-kien/co-dong'), figs: [fig(ir.length, 'đầu mục IR trong lịch 2027'), fig(ir.filter(p => /công bố/i.test(p['Định dạng'])).length, 'lần đăng công bố thông tin'), fig(ir.filter(p => p['Cấp duyệt'] === 'Cấp 4').length, 'bài cần duyệt Cấp 4'), fig(fin.filter(r => r.score >= 12).length, 'rủi ro tài chính điểm ≥ 12', 'alert')] })}
  ${sec('01', 'Mốc cổ đông năm 2027', `<div class="grid g64">${box('Dòng thời gian IR', 'Ngày tham khảo', postList(ir, 12), 'Lịch nội dung 2027')}<div class="grid">${box('ĐHĐCĐ 2027', '', eventList(evs), 'Sự kiện 2027')}${box('Mốc trong lịch ngày lễ', '', hol.length ? `<div class="list">${hol.map(h => `<div class="li">${dbox(h.date, true)}<div><div class="t">${esc(h['Sự kiện'])}</div><div class="s">${esc(h['Cách làm / lưu ý'])}</div></div></div>`).join('')}</div>` : empty('Chưa có mốc'), 'Ngày lễ 2027')}</div></div>`)}
  ${sec('02', 'Chuẩn bị trước đại hội', `<div class="grid g2">${box('Việc còn thiếu', '', reviewList(reviewItems(/IR|rủi ro/i)), 'Rà soát 2027')}${box('Rủi ro cần lưu ý', 'Nhóm Tình hình tài chính', fin.slice(0, 3).map(riskRow).join(''), 'Rủi ro truyền thông')}</div>`)}`;
  return { html };
}
function pHolidays() {
  const H = M.holidays; const byLvl = countBy(H, h => h['Mức độ làm nội dung']);
  const must = H.filter(h => /bắt buộc/i.test(h['Mức độ làm nội dung']));
  const html = `${head({ crumb: [{ id: 'su-kien', t: 'Sự kiện' }, { t: 'Lễ, Tết và ngày kỷ niệm' }], title: 'Lễ, Tết và <b>ngày kỷ niệm</b> 2027', lead: 'Các dịp trong năm và mức độ làm nội dung; ngày nghỉ Tết theo thông báo của Bộ Nội vụ.', tabs: tabsOf(itemsOf('su-kien'), ''), figs: [fig(H.length, 'mốc trong năm'), fig(must.length, 'mốc bắt buộc làm nội dung'), fig(H.filter(h => /^có/i.test(h['Nghỉ chính thức'])).length, 'ngày nghỉ chính thức'), fig(H.filter(h => /rủi ro/i.test(h['Loại'])).length, 'mốc nhạy cảm', 'alert')] })}
  ${sec('01', 'Phân bố trong năm', `<div class="grid g64">${box('Số mốc theo tháng', '', canvas('c-hm', 'sm'), 'Ngày lễ 2027')}${box('Mức độ làm nội dung', '', segBar(Object.entries(byLvl).map(([k, v]) => ({ l: k, v, c: /bắt buộc/i.test(k) ? C[1] : /nên/i.test(k) ? C[0] : /tùy/i.test(k) ? C[2] : '#cbd5e1' }))), 'Ngày lễ 2027')}</div>`)}
  ${sec('02', 'Mốc bắt buộc', box('', '', `<div class="list">${must.map(h => `<div class="li">${dbox(h.date, true)}<div><div class="t">${esc(h['Sự kiện'])}</div><div class="s">${esc(h['Kênh'])} · ${esc(h['Cách làm / lưu ý'])}</div></div><span class="chip">${esc(h['Loại'])}</span></div>`).join('')}</div>`, 'Ngày lễ 2027'))}`;
  const after = () => barChart('c-hm', MON, [{ label: 'Mốc', data: MON.map((_, i) => H.filter(h => h.date.getMonth() === i).length) }]);
  return { html, after };
}


function pEventType(item) {
  const evs = M.events.filter(e => item.types.includes(e['Loại'])).sort((a, b) => ((a.w && a.w.d) || 9e15) - ((b.w && b.w.d) || 9e15));
  const items = evs.filter(e => e.w).map(e => ({ d: e.w.d, t: e['Sự kiện'], k: e['Loại'], c: EV_COLOR[e['Loại']] || C[6], tip: e['Căn cứ'] }));
  const rel = item.id === 'su-kien/noi-bo' ? reviewItems(/nội bộ|đào tạo|nhân vật/i) : reviewItems(/KCN|theo dõi|báo chí/i);
  const link = item.id === 'su-kien/noi-bo' ? `<a href="#/truyen-thong/doi-noi">Truyền thông đối nội →</a>` : `<a href="#/truyen-thong/bao-chi">Báo chí →</a> · <a href="#/truyen-thong/su-kien-ben-ngoai">Chương trình sự kiện bên ngoài →</a>`;
  const html = `${head({ crumb: [{ id: 'su-kien', t: 'Sự kiện' }, { t: item.t }], title: `Sự kiện · <b>${esc(item.t.replace(/^Sự kiện /, ''))}</b>`, lead: esc(item.s) + '. Lọc từ tab Sự kiện 2027 theo cột Loại: ' + esc(item.types.join(', ')) + '.', tabs: tabsOf(itemsOf('su-kien'), item.id), figs: [fig(evs.length, 'sự kiện'), fig(evs.filter(e => e.w && e.w.exact).length, 'đã có ngày cụ thể'), fig(evs.filter(e => !e.w).length, 'chưa xác định thời gian', 'alert'), fig(evs.filter(e => /đề xuất/i.test(e['Trạng thái'])).length, 'đang ở mức đề xuất')] })}
  ${sec('01', 'Dòng thời gian', box('', '', monthsTimeline(items, new Date(2026, 10, 1), 15), 'Sự kiện 2027'))}
  ${sec('02', 'Danh sách và việc chuẩn bị', `<div class="grid g64">${box('', '', eventList(evs), 'Sự kiện 2027')}${box('Việc còn thiếu', '', reviewList(rel) + `<div style="margin-top:14px;font-size:13px">Xem thêm: ${link}</div>`, 'Rà soát 2027')}</div>`)}`;
  return { html };
}
function heatmap(posts, holidays, year) {
  const cnt = {}; posts.forEach(p => { if (p.date && p.date.getFullYear() === year) (cnt[+p.date] = cnt[+p.date] || []).push(p); });
  const hol = {}; holidays.forEach(h => { if (/^có/i.test(h['Nghỉ chính thức'] || '')) hol[+h.date] = h['Sự kiện']; });
  const SQ = ['#eef2f6', '#c9daf0', '#8fb3e2', '#3f78c4', '#0d4f9b'];
  const start = new Date(year, 0, 1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(year, 11, 31); let cells = '', months = '', col = 0, lastM = -1;
  for (let d = new Date(start); ; d.setDate(d.getDate() + 1)) {
    const dow = (d.getDay() + 6) % 7; if (dow === 0) col++;
    if (d > end && dow === 0) break;
    const inY = d.getFullYear() === year;
    if (inY && d.getMonth() !== lastM && d.getDate() <= 7 && dow === 0) { months += `<span style="left:${(col - 1) * 16}px">${MON[d.getMonth()]}</span>`; lastM = d.getMonth(); }
    const list = cnt[+d] || [];
    const tip = inY ? `${fDate(d)}${hol[+d] ? ' · ' + hol[+d] : ''}${list.length ? '\n' + list.map(p => `• ${p['Kênh']}: ${p['Tiêu đề / chủ đề']}`).join('\n') : ''}` : '';
    cells += `<i style="background:${inY ? SQ[Math.min(list.length, 4)] : 'transparent'};${hol[+d] ? 'outline:2px solid #e3242b;outline-offset:-2px' : ''}" title="${esc(tip)}"></i>`;
  }
  return `<div class="xs"><div style="width:max-content"><div class="heat-months">${months}</div><div class="heat-wrap"><div class="heat-days">${['T2', '', 'T4', '', 'T6', '', 'CN'].map(x => `<span>${x}</span>`).join('')}</div><div class="heat">${cells}</div></div></div></div><div class="legend"><span>Ít</span>${SQ.slice(1).map(c => `<span><i style="background:${c}"></i></span>`).join('')}<span>Nhiều bài trong ngày</span><span style="margin-left:12px"><i style="background:#fff;outline:2px solid #e3242b;outline-offset:-2px"></i>Ngày nghỉ chính thức</span></div>`;
}
function pChannels() {
  const chs = ['Facebook', 'YouTube', 'Website']; const CH = { Facebook: C[0], YouTube: C[1], Website: C[2] };
  const channels = table(G('Khung kênh 2027'), r => cell(r, 0) === 'Kênh' && cell(r, 1) === 'Vai trò');
  const P = M.posts; const year = (P[0] && P[0].date) ? P[0].date.getFullYear() : 2027;
  const pillars = Object.entries(countBy(P, p => p['Trụ cột'])).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const fp = [['KSB', 'Lịch bài KSB T11–12/2026'], ['KCN Đất Cuốc', 'Lịch bài Đất Cuốc T11–12/2026']].map(([n, tab]) => ({ n, rows: table(G(tab), r => cell(r, 0) === 'STT' && cell(r, 1) === 'Ngày đăng').filter(p => p['Ngày đăng']) }));
  const top = pillars[0], topN = P.filter(p => p['Trụ cột'] === top).length;
  const html = `${head({ crumb: [{ id: 'truyen-thong', t: 'Truyền thông' }, { t: 'Kênh truyền thông số' }], title: 'Kênh <b>truyền thông số</b>', lead: 'Vai trò, nhịp đăng và lịch nội dung năm 2027 của Facebook, YouTube và website ksb.vn; hai fanpage KSB và KCN Đất Cuốc chạy từ 11/2026.', figs: [fig(P.length, `đầu mục nội dung năm ${year}`), fig(fp.reduce((a, f) => a + f.rows.length, 0), 'bài fanpage T11–12/2026'), fig(pct(topN, P.length) + '<small>%</small>', `trụ cột “${esc(top || '')}”`), fig(P.filter(p => p['Cấp duyệt'] === 'Cấp 4').length, 'bài cần duyệt Cấp 4')] })}
  ${sec('01', 'Ba kênh chính', `<div class="grid g3">${channels.map(c => { const k = /web/i.test(c['Kênh']) ? 'Website' : c['Kênh']; return `<section class="box" style="border-top:3px solid ${CH[k] || C[6]}"><div class="bh"><div><h3>${esc(c['Kênh'])}</h3><div class="cap">${esc(c['Nhịp đăng'])}</div></div><div class="count" style="font-size:40px">${esc(c['Số bài cả năm'])}<small>bài</small></div></div><div style="font-weight:500">${esc(c['Vai trò'])}</div><div class="cap" style="margin-top:8px">Đối tượng: ${esc(c['Đối tượng chính'])}</div><div class="cap">Định dạng: ${esc(c['Định dạng chính'])}</div></section>`; }).join('')}</div><div class="src">Khung kênh 2027</div>`)}
  ${sec('02', 'Nhịp đăng và trụ cột nội dung', `${say(`Trụ cột <b>${esc(top || '')}</b> chiếm <b>${pct(topN, P.length)}%</b> số đầu mục năm ${year}; Facebook gánh phần lớn số bài.`)}<div class="grid g64">${box('Số đầu mục theo tháng và kênh', `Năm ${year}`, canvas('c-month', 'lg'), 'Lịch nội dung 2027')}${box('Theo trụ cột nội dung', 'Chia theo kênh', canvas('c-pillar', 'lg'), 'Lịch nội dung 2027')}</div>`)}
  ${sec('03', `Bản đồ nhiệt lịch đăng ${year}`, box('', 'Di chuột vào ô để xem bài trong ngày', heatmap(P, M.holidays, year), 'Lịch nội dung 2027 · Ngày lễ 2027'))}
  ${sec('04', 'Hai fanpage T11–12/2026', `<div class="grid g2">${fp.map(f => box(`Fanpage ${f.n}`, `${f.rows.length} bài`, segBar(Object.entries(countBy(f.rows, r => r['Trụ cột'])).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ l: k, v, c: C[i % C.length] }))), `Lịch bài ${f.n === 'KSB' ? 'KSB' : 'Đất Cuốc'} T11–12/2026`)).join('')}</div>`)}`;
  const after = () => {
    barChart('c-month', MON, chs.map(c => ({ label: c, data: MON.map((_, i) => P.filter(p => p['Kênh'] === c && p.date && p.date.getMonth() === i).length), color: CH[c] })), { stacked: true });
    barChart('c-pillar', pillars, chs.map(c => ({ label: c, data: pillars.map(pl => P.filter(p => p['Kênh'] === c && p['Trụ cột'] === pl).length), color: CH[c] })), { stacked: true, horizontal: true });
  };
  return { html, after };
}

/* =========================================================
   04 · QUẢN TRỊ RỦI RO
   ========================================================= */
const scoreCls = s => s >= 15 ? 'hi' : s >= 8 ? 'md' : '';
const cellBg = s => s >= 15 ? '#fbe3e1' : s >= 8 ? '#fbf0d9' : '#eef3f8';
function riskMatrix(risks, focus) {
  let h = `<div class="mx-wrap"><div class="mx-y">Mức độ ảnh hưởng →</div><div><div class="mx">`;
  for (let s = 5; s >= 1; s--) {
    h += `<div class="ax">${s}</div>`;
    for (let k = 1; k <= 5; k++) {
      const rs = risks.filter(r => r.k === k && r.s === s);
      h += `<div class="c" style="background:${cellBg(k * s)}">${rs.map(r => `<span class="dot ${focus && r['Nhóm'] !== focus ? 'dim' : ''}" title="${esc('#' + r.STT + ' ' + r['Rủi ro'] + ' (' + r['Nhóm'] + ', điểm ' + r.score + ')')}">${esc(r.STT)}</span>`).join('')}<span class="sc">${k * s}</span></div>`;
    }
  }
  h += `<div></div>${[1, 2, 3, 4, 5].map(k => `<div class="ax">${k}</div>`).join('')}</div><div class="mx-x">Khả năng xảy ra →</div></div></div>`;
  return h + `<div class="legend"><span><i style="background:#fbe3e1"></i>Cao (≥ 15)</span><span><i style="background:#fbf0d9"></i>Trung bình (8–14)</span><span><i style="background:#eef3f8"></i>Thấp (≤ 7)</span></div>`;
}
const riskRow = r => `<div class="risk"><div class="score ${scoreCls(r.score)}"><b>${r.score}</b><span>điểm</span></div><div><div class="t">#${esc(r.STT)} · ${esc(r['Rủi ro'])}</div><div class="m"><span>${esc(r['Nhóm'])}</span><span>Khả năng ${r.k}/5</span><span>Mức độ ${r.s}/5</span><span>Phát ngôn: ${esc(r['Người phát ngôn'])}</span>${tag(r['Trạng thái'])}</div><div class="p"><em>Dấu hiệu</em>${esc(r['Dấu hiệu sớm'])}</div><div class="p"><em>Ứng phó</em>${esc(r['Kịch bản ứng phó'])}</div><div class="s" style="font-size:11.5px;color:var(--faint);margin-top:6px">Căn cứ: ${esc(r['Căn cứ'])}</div></div></div>`;
function pRiskHub() {
  const R = M.risks; const groups = itemsOf('rui-ro').map(i => i.grp);
  const avg = groups.map(g => { const rs = R.filter(r => r['Nhóm'] === g); return rs.length ? Math.round(rs.reduce((a, r) => a + r.score, 0) / rs.length * 10) / 10 : 0; });
  const mx = groups.map(g => Math.max(0, ...R.filter(r => r['Nhóm'] === g).map(r => r.score)));
  const top = R.slice().sort((a, b) => b.score - a.score).slice(0, 5);
  const sens = M.holidays.filter(h => /rủi ro/i.test(h['Loại']) && h.date >= today());
  const html = `${head({ crumb: [{ t: 'Quản trị rủi ro' }], title: 'Quản trị <b>rủi ro truyền thông</b>', lead: 'Mỗi rủi ro được chấm theo khả năng xảy ra và mức độ ảnh hưởng (thang 1–5). Điểm hiện là chấm sơ bộ của bộ phận truyền thông, cần lãnh đạo xem lại.', figs: [fig(R.length, 'rủi ro đã nhận diện'), fig(R.filter(r => r.score >= 15).length, 'rủi ro mức cao', 'alert'), fig(R.filter(r => /đề xuất/i.test(r['Trạng thái'])).length, 'kịch bản chưa duyệt'), fig(sens.length ? fDate(sens[0].date) : '–', 'mốc nhạy cảm gần nhất')] })}
  ${sec('01', 'Bản đồ rủi ro', `${top[0] ? say(`Rủi ro cao nhất: <b>${esc(top[0]['Rủi ro'])}</b> (điểm ${top[0].score}). Nhóm <b>${esc(groups[mx.indexOf(Math.max(...mx))])}</b> có điểm cao nhất.`) : ''}<div class="grid g46">${box('Ma trận khả năng × mức độ', 'Di chuột vào chấm để xem rủi ro', riskMatrix(R), 'Rủi ro truyền thông')}<div class="grid">${box('Điểm theo nhóm', 'Trung bình và cao nhất, thang 0–25', canvas('c-rg', 'lg'), 'Rủi ro truyền thông')}${box('Rủi ro theo mức', '', donutBox('c-lv', R.length, 'rủi ro', 'sm'), 'Rủi ro truyền thông')}</div></div>`)}
  ${sec('02', 'Bốn nhóm rủi ro', `<div class="tiles">${itemsOf('rui-ro').map(i => { const rs = R.filter(r => r['Nhóm'] === i.grp); return `<a class="tile" href="#/${i.id}" style="--c:${gColor(i.id)}"><div class="ico">${ic(gIcon(i.id))}</div><div class="k">Nhóm rủi ro</div><h3>${i.t}</h3><p>${i.s}</p><div class="st"><b>${rs.length}</b><span>rủi ro · cao nhất ${Math.max(0, ...rs.map(r => r.score))} điểm</span></div></a>`; }).join('')}</div>`)}
  ${sec('03', 'Năm rủi ro điểm cao nhất', box('', '', top.map(riskRow).join(''), 'Rủi ro truyền thông'))}`;
  const lv = [R.filter(r => r.score >= 15).length, R.filter(r => r.score >= 8 && r.score < 15).length, R.filter(r => r.score < 8).length];
  const after = () => {
    chart('c-rg', { type: 'radar', data: { labels: groups, datasets: [{ label: 'Điểm cao nhất', data: mx, borderColor: '#6a4fb3', backgroundColor: 'rgba(106,79,179,.18)', pointBackgroundColor: '#6a4fb3' }, { label: 'Điểm trung bình', data: avg, borderColor: '#5b8fd1', backgroundColor: 'rgba(91,143,209,.15)', pointBackgroundColor: '#5b8fd1' }] }, options: { scales: { r: { min: 0, max: 25, ticks: { stepSize: 5, backdropColor: 'transparent' }, grid: { color: '#e6e9ef' }, angleLines: { color: '#e6e9ef' }, pointLabels: { font: { size: 12, weight: '600' } } } } } });
    makeDonut('c-lv', ['Cao (≥ 15)', 'Trung bình (8–14)', 'Thấp (≤ 7)'], lv, ['#e3242b', '#c98a00', '#a9c4e8']);
  };
  return { html, after };
}
function pRiskGroup(item) {
  const g = item.grp; const R = M.risks.filter(r => r['Nhóm'] === g).sort((a, b) => b.score - a.score);
  let extra = '';
  if (g === 'Thương hiệu KSB') {
    const open = M.dcNumbers.filter(x => !/đã chốt/i.test(x['Trạng thái']));
    extra = `<div class="grid g2">${box('Ngôn ngữ cần tránh', 'Áp dụng cho mọi nội dung chủ động', M.lang.map(l => `<div class="pair"><div class="no">${esc(l.no)}</div><div class="ar">→</div><div class="yes">${esc(l.yes)}</div></div>`).join(''), 'Tổng quan · mục 4')}${box('Số liệu KCN Đất Cuốc chưa thống nhất', `${open.length}/${M.dcNumbers.length} hạng mục`, open.length ? `<div class="list">${open.map(x => `<div class="li" style="grid-template-columns:1fr auto"><div><div class="t">${esc(x['Hạng mục'])}</div><div class="s">Ai chốt: ${esc(x['Ai chốt'])}</div></div>${tag(x['Trạng thái'])}</div>`).join('')}</div>` : empty('Đã thống nhất toàn bộ'), 'Lịch bài Đất Cuốc T11–12/2026')}</div>`;
  } else if (g === 'Lãnh đạo') {
    const ld = M.people.filter(p => /lãnh đạo/i.test(p['Nhóm']));
    extra = `<div class="grid g2">${box('Người phát ngôn và đại diện', 'Từ khung thương hiệu cá nhân', `<table class="tbl"><tr><th>Vai trò</th><th>Người đảm nhận</th><th>Trạng thái</th></tr>${ld.map(p => `<tr><td><b>${esc(p['Đối tượng'])}</b><span class="sub">${esc(p['Vai trò truyền thông'])}</span></td><td>${esc(p['Người đảm nhận'])}</td><td>${tag(p['Trạng thái'])}</td></tr>`).join('')}</table>`, 'Thương hiệu cá nhân')}${box('Việc chuẩn bị', '', reviewList(reviewItems(/duyệt|đào tạo/i)), 'Rà soát 2027')}</div>`;
  } else if (g === 'HĐSX Kinh doanh') {
    const sens = M.holidays.filter(h => /rủi ro/i.test(h['Loại']));
    extra = `<div class="grid g2">${box('Mốc nhạy cảm trong năm', '', sens.length ? `<div class="list">${sens.map(h => `<div class="li">${dbox(h.date)}<div><div class="t">${esc(h['Sự kiện'])}</div><div class="s">${esc(h['Cách làm / lưu ý'])}</div></div><span class="tag crit">${rel(h.date)}</span></div>`).join('')}</div>` : empty('Không có mốc'), 'Ngày lễ 2027')}${box('Việc chuẩn bị', '', reviewList(reviewItems(/rủi ro|pháp lý/i)), 'Rà soát 2027')}</div>`;
  } else {
    const ir = M.posts.filter(p => /công bố thông tin/i.test(p['Định dạng']));
    extra = `<div class="grid g2">${box('Lịch công bố thông tin', 'Ngày tham khảo, chờ IR xác nhận', postList(ir, 8), 'Lịch nội dung 2027')}${box('Việc chuẩn bị', '', reviewList(reviewItems(/IR|theo dõi/i)), 'Rà soát 2027')}</div>`;
  }
  const html = `${head({ crumb: [{ id: 'rui-ro', t: 'Quản trị rủi ro' }, { t: item.t }], title: `Rủi ro · <b>${esc(item.t)}</b>`, lead: esc(item.s) + '. Điểm = khả năng × mức độ; sửa trực tiếp ở tab Rủi ro truyền thông.', tabs: tabsOf(itemsOf('rui-ro'), item.id), figs: [fig(R.length, 'rủi ro trong nhóm'), fig(R.length ? R[0].score : 0, 'điểm cao nhất', R.length && R[0].score >= 15 ? 'alert' : ''), fig(R.filter(r => r.score >= 8).length, 'rủi ro từ mức trung bình'), fig(R.filter(r => /đề xuất/i.test(r['Trạng thái'])).length, 'kịch bản chưa duyệt')] })}
  ${sec('01', 'Rủi ro và kịch bản ứng phó', `<div class="grid g46">${box('Vị trí trên ma trận', 'Chấm đậm là rủi ro thuộc nhóm này', riskMatrix(M.risks, g), 'Rủi ro truyền thông')}${box('', '', R.map(riskRow).join('') || empty('Chưa có rủi ro'), 'Rủi ro truyền thông')}</div>`)}
  ${sec('02', 'Bằng chứng và việc liên quan', extra)}`;
  return { html };
}

/* =========================================================
   05 · HOẠT ĐỘNG DỰ KIẾN
   ========================================================= */
const ESG_C = { E: '#1a7f4b', S: C[0], G: C[5] };
function actList(acts) {
  return acts.length ? `<div class="list">${acts.map(a => `<div class="li">${dbox(a.w && a.w.d, false, a.w && !a.w.exact, a.w && a.w.q)}<div><div class="t">${a['Trụ ESG'] ? `<span class="tag" style="background:${ESG_C[a['Trụ ESG']] || C[6]};color:#fff;margin-right:6px">${esc(a['Trụ ESG'])}</span>` : ''}${esc(a['Hoạt động'])}</div><div class="s">${esc(a['Mục tiêu'])}</div><div class="s" style="color:var(--muted)">Phối hợp: ${esc(a['Phối hợp'])} · Căn cứ: ${esc(a['Căn cứ'])}</div></div>${tag(a['Trạng thái'])}</div>`).join('')}</div>` : empty('Chưa có hoạt động', 'Thêm dòng vào tab Hoạt động dự kiến');
}
function pActHub() {
  const A = M.acts; const groups = itemsOf('hoat-dong').map(i => i.grp);
  const st = ['Đề xuất', 'Đã duyệt', 'Đang làm', 'Hoàn thành'];
  const html = `${head({ crumb: [{ t: 'Hoạt động dự kiến' }], title: '<b>Hoạt động dự kiến</b> 2027', lead: 'Hỗ trợ công tác hội, ESG và CSR: những hoạt động bổ trợ cho thương hiệu, hiện đang ở mức đề xuất.', figs: [fig(A.length, 'hoạt động đề xuất'), fig(A.filter(a => !/đề xuất/i.test(a['Trạng thái'])).length, 'đã duyệt hoặc đang làm'), fig(A.filter(a => !a.w).length, 'chưa có thời gian', 'alert'), fig(groups.length, 'nhóm hoạt động')] })}
  ${sec('01', 'Ba nhóm hoạt động', `<div class="tiles">${itemsOf('hoat-dong').map(i => { const n = A.filter(a => a['Nhóm'] === i.grp).length; return `<a class="tile" href="#/${i.id}" style="--c:${gColor(i.id)}"><div class="ico">${ic(gIcon(i.id))}</div><div class="k">Hoạt động dự kiến</div><h3>${i.t}</h3><p>${i.s}</p><div class="st"><b>${n}</b><span>hoạt động</span></div></a>`; }).join('')}</div>`)}
  ${sec('02', 'Tiến độ theo nhóm', `<div class="grid g46"><div class="grid">${box('Theo nhóm', '', donutBox('c-actg', A.length, 'hoạt động', 'sm'), 'Hoạt động dự kiến')}${box('Trạng thái', '', canvas('c-act', 'sm'), 'Hoạt động dự kiến')}</div>${box('Sắp tới', 'Theo thời gian dự kiến', actList(A.filter(a => a.w).sort((a, b) => a.w.d - b.w.d).slice(0, 5)), 'Hoạt động dự kiến')}</div>`)}`;
  const after = () => { makeDonut('c-actg', groups, groups.map(g => A.filter(a => a['Nhóm'] === g).length), ['#5b8fd1', '#1a7f4b', '#e3242b']); barChart('c-act', groups, st.map((s, i) => ({ label: s, data: groups.map(g => A.filter(a => a['Nhóm'] === g && a['Trạng thái'] === s).length), color: [C[3], C[2], C[0], '#1a7f4b'][i] })), { horizontal: true, stacked: true }); };
  return { html, after };
}
function pActGroup(item) {
  const A = M.acts.filter(a => a['Nhóm'] === item.grp);
  let extra = '', after;
  if (item.grp === 'ESG') {
    const pp = M.posts.filter(p => /bền vững/i.test(p['Trụ cột']));
    const byP = countBy(A, a => a['Trụ ESG']);
    extra = sec('02', 'ESG trong nội dung 2027', `<div class="grid g64">${box('Bài Phát triển bền vững theo tháng', `${pp.length} đầu mục`, canvas('c-esgp', 'sm'), 'Lịch nội dung 2027')}${box('Hoạt động theo trụ', '', segBar(['E', 'S', 'G'].map(k => ({ l: { E: 'Môi trường', S: 'Xã hội', G: 'Quản trị' }[k], v: byP[k] || 0, c: ESG_C[k] }))), 'Hoạt động dự kiến')}</div>`);
    after = () => barChart('c-esgp', MON, [{ label: 'Bài', data: MON.map((_, i) => pp.filter(p => p.date && p.date.getMonth() === i).length), color: '#1a7f4b' }]);
  } else if (item.grp === 'CSR') {
    const pp = M.posts.filter(p => /cộng đồng/i.test(p['Trụ cột']));
    extra = sec('02', 'Nội dung Đồng hành cộng đồng 2027', box('', `${pp.length} đầu mục`, postList(pp, 10), 'Lịch nội dung 2027'));
  } else {
    extra = sec('02', 'Cần xác định', `<div class="note">Phạm vi “công tác hội” chưa được xác định: Công đoàn, Đoàn Thanh niên hay hiệp hội doanh nghiệp, hiệp hội ngành mà KSB là thành viên. Các dòng ở trên là khung đề xuất.</div>`);
  }
  const html = `${head({ crumb: [{ id: 'hoat-dong', t: 'Hoạt động dự kiến' }, { t: item.t }], title: `Hoạt động dự kiến · <b>${esc(item.t)}</b>`, lead: esc(item.s) + '. Đọc từ tab Hoạt động dự kiến.', tabs: tabsOf(itemsOf('hoat-dong'), item.id), figs: [fig(A.length, 'hoạt động'), fig(A.filter(a => !/đề xuất/i.test(a['Trạng thái'])).length, 'đã duyệt hoặc đang làm'), fig(A.filter(a => !a.w).length, 'chưa có thời gian', 'alert'), fig(A.filter(a => a.w && a.w.exact).length, 'đã có ngày cụ thể')] })}
  ${sec('01', 'Danh sách hoạt động', box('', '', actList(A), 'Hoạt động dự kiến'))}${extra}`;
  return { html, after };
}

/* =========================================================
   06 · NGÂN SÁCH (cần mật khẩu)
   ========================================================= */
function pLock() {
  const it = ALL.find(a => a.id === CUR) || { t: 'Ngân sách' };
  const html = `${head({ crumb: [{ t: 'Ngân sách' }], title: '<b>Ngân sách</b> truyền thông', lead: 'Mục này chứa ngân sách 2027, chi phí 2024–2026, hợp đồng báo chí và tài trợ. Nhập mật khẩu để xem.' })}
  <section class="sec"><div class="wrap"><form class="lockbox" id="lockform" autocomplete="off">
    <span class="lb-i">${ic('lock')}</span>
    <h3>${esc(it.t)} · cần mật khẩu</h3>
    <p>Mật khẩu do bộ phận truyền thông cấp. Đã nhập đúng thì không phải nhập lại cho đến khi đóng trình duyệt.</p>
    <div class="lb-row"><input type="password" id="lockpw" placeholder="Nhập mật khẩu" aria-label="Mật khẩu mục Ngân sách" autofocus><button type="submit" class="ib dark" id="lockgo">Mở khóa</button></div>
    <div class="lb-err" id="lockerr"></div>
  </form></div></section>`;
  const after = () => {
    const f = $('#lockform'), inp = $('#lockpw'), err = $('#lockerr'), btn = $('#lockgo');
    f.addEventListener('submit', async ev => {
      ev.preventDefault(); const pw = inp.value.trim(); if (!pw) return;
      btn.disabled = true; btn.textContent = 'Đang kiểm tra…'; err.textContent = '';
      try { await unlock(pw); render(false); }
      catch (e) { err.textContent = e.message || 'Không mở được'; btn.disabled = false; btn.textContent = 'Mở khóa'; inp.select(); }
    });
    setTimeout(() => inp.focus(), 50);
  };
  return { html, after };
}
const relockBtn = `<button type="button" class="relock" id="btn-relock">${ic('lock')}Khóa lại</button>`;
const bindRelock = () => { const b = $('#btn-relock'); if (b) b.onclick = () => { relock(); render(false); }; };
const guard = f => () => M.unlocked ? f() : pLock();
function pBudgetHub() {
  const cy = costByYear();
  const regAmt = M.regular.map(r => num(r['Dự toán 2027']));
  const act = M.nsAct.filter(a => a['Hoạt động']);
  const html = `${head({ crumb: [{ t: 'Ngân sách' }], title: '<b>Ngân sách</b> truyền thông 2027', lead: `Chi thường xuyên dựa trên chi thực tế 2026, cộng chiến dịch Người KSB. Đơn giá chiến dịch đang tạm tính. ${relockBtn}`, figs: [fig(fVND(M.grand), 'tổng ngân sách 2027', '', 'money'), fig(esc(M.growth || '–'), 'so với chi 2026 cả năm', '', 'chart'), fig(fVND(M.regTotal), 'chi thường xuyên', '', 'layers'), fig(fVND(M.campTotal), 'chiến dịch Người KSB', '', 'users')], tabs: tabsOf([{ id: 'ngan-sach', t: 'Tổng quan' }].concat(itemsOf('ngan-sach')), 'ngan-sach') })}
  ${sec('01', 'Cơ cấu ngân sách 2027', `<div class="grid g46">${box('Hai phần ngân sách', 'Chi thường xuyên và chiến dịch', donutBox('c-bud', fVND(M.grand), 'tổng 2027', 'lg'), 'NS 2027 · Phòng TT')}${box('Chi thường xuyên theo đầu mục', 'Dự toán 2027 (đã gồm VAT)', canvas('c-reg', 'lg'), 'NS 2027 · Phòng TT')}</div>`)}
  ${sec('02', 'Chiến dịch Người KSB theo hoạt động', `<div class="grid g64">${box('Theo quý', 'Chưa dự phòng, chưa VAT', canvas('c-act', 'lg'), 'NS Tổng')}${box('Bảng chi tiết', '', `<table class="tbl"><tr><th>Hoạt động</th><th class="r">Tổng</th></tr>${act.map(a => `<tr><td>${esc(a['Hoạt động'])}<span class="sub">${esc(a['Tab chi tiết'])}</span></td><td class="r tnum">${fVND(num(a['Tổng']))}</td></tr>`).join('')}</table>`, 'NS Tổng')}</div>`)}
  ${sec('03', 'Chi phí truyền thông 2024–2026', `${say(`Tổng chi giảm từ <b>${fVND(cy.totals[0])}</b> năm 2024 xuống <b>${fVND(cy.totals[1])}</b> năm 2025; năm 2026 tính đến ${esc(M.cpLatest)} là <b>${fVND(cy.totals[2])}</b>.`)}${box('Chi phí theo đầu mục', 'Đã gồm VAT; 2026 tính đến ' + esc(M.cpLatest), canvas('c-years', 'lg'), 'CP 2024–2025 · CP 2026 · Tổng hợp')}`)}
  ${sec('04', 'Chi tiết', `<div class="tiles">${itemsOf('ngan-sach').map(i => tileOf(i, 'Ngân sách')).join('')}</div>`)}`;
  const after = () => {
    bindRelock();
    makeDonut('c-bud', ['Chi thường xuyên', 'Chiến dịch Người KSB'], [M.regTotal, M.campTotal], ['#0d4f9b', '#e3242b'], { money: true });
    const rg = M.regular.map((r, i) => [r['Đầu mục'], regAmt[i]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    barChart('c-reg', rg.map(x => x[0]), [{ label: 'Dự toán 2027', data: rg.map(x => x[1]), color: '#0f766e' }], { horizontal: true, money: true });
    const qs = ['Q1', 'Q2', 'Q3', 'Q4', 'T1/2028'];
    barChart('c-act', qs, act.map((a, i) => ({ label: a['Hoạt động'], data: qs.map(q => num(a[q])), color: C[i % C.length] })), { stacked: true, money: true });
    barChart('c-years', ['2024', '2025', '2026'], cy.cats.map((c, i) => ({ label: c, data: cy.yv(c), color: C[i % C.length] })), { stacked: true, money: true });
  };
  return { html, after };
}
function pBudgetExt() {
  const press = catQuarters('Hợp đồng truyền thông báo chí'), ev = catQuarters('Sự kiện & quà tri ân báo chí'), sp = catQuarters('Tài trợ & sự kiện đối tác');
  const rows = M.raw.filter(r => /hợp đồng truyền thông báo chí/i.test(r.cat));
  const byUnit = {}; rows.forEach(r => { const k = r.unit.replace(/^(Cty|Công ty)\s+(CP|TNHH MTV|TNHH)\s*/i, '').trim(); byUnit[k] = byUnit[k] || { amt: 0, paid: 0 }; byUnit[k].amt += r.amt; byUnit[k].paid += r.paid; });
  const units = Object.entries(byUnit).sort((a, b) => b[1].amt - a[1].amt);
  const total = rows.reduce((a, r) => a + r.amt, 0), owed = rows.reduce((a, r) => a + r.amt - r.paid, 0);
  const pr27 = M.ppPress.reduce((a, x) => a + num(x['Thành tiền']), 0);
  const reg = M.regular.find(r => /tài trợ/i.test(r['Đầu mục'])) || {};
  const c26 = M.cp26.filter(c => num(c['Tổng 2026']) > 0);
  const html = `${head({ crumb: [{ id: 'ngan-sach', t: 'Ngân sách' }, { t: 'Chi đối ngoại' }], title: 'Ngân sách · <b>Chi đối ngoại</b>', lead: `Hợp đồng báo chí, sự kiện và quà tri ân báo chí, tài trợ: chi thực tế 2024–2026 và kế hoạch 2027. ${relockBtn}`, tabs: tabsOf([{ id: 'ngan-sach', t: 'Tổng quan' }].concat(itemsOf('ngan-sach')), 'ngan-sach/doi-ngoai'), figs: [fig(fVND(total), `${rows.length} hợp đồng báo chí 2026`), fig(fVND(owed), 'còn phải thanh toán', owed ? 'alert' : ''), fig(fVND(pr27), 'bài PR chiến dịch 2027 (chưa VAT)'), fig(fVND(num(reg['Dự toán 2027'])), 'dự toán tài trợ 2027')] })}
  ${sec('01', 'Chi đối ngoại theo quý, 2024–2026', `${say(`Chi hợp đồng báo chí là <b>${fVND(press.y24)}</b> năm 2024 và <b>${fVND(press.y25)}</b> năm 2025; tài trợ giảm từ <b>${fVND(sp.y24)}</b> xuống <b>${fVND(sp.y25)}</b> và chưa phát sinh năm 2026.`)}<div class="grid g64">${box('Chi theo quý', '', canvas('c-ext', 'lg'), 'CP 2024–2025 · CP 2026 · Tổng hợp (2026 tính đến ' + M.cpLatest + ')')}${box('Cơ cấu chi năm 2026', 'Theo đầu mục', donutBox('c-c26', fVND(M.cp26.reduce((a, c) => a + num(c['Tổng 2026']), 0)), 'tổng 2026', 'lg'), 'CP 2026 · Tổng hợp')}</div>`)}
  ${sec('02', 'Hợp đồng báo chí năm 2026', `${say(`Năm 2026 có <b>${rows.length}</b> hợp đồng với <b>${units.length}</b> đơn vị, tổng <b>${fVND(total)}</b>; mới thanh toán <b>${pct(total - owed, total)}%</b>. Ba đơn vị lớn nhất chiếm <b>${pct(units.slice(0, 3).reduce((a, u) => a + u[1].amt, 0), total)}%</b> giá trị.`)}
    <div class="grid g64">${box('Giá trị hợp đồng theo đơn vị', 'Đã gồm VAT; tách phần đã và chưa thanh toán', canvas('c-units', 'xl'), 'CP 2026 · Dữ liệu gốc')}${box('Tình trạng thanh toán', '', donutBox('c-paid', pct(total - owed, total) + '%', 'đã thanh toán', 'xl'), 'CP 2026 · Dữ liệu gốc')}</div>`)}
  ${sec('03', 'Kế hoạch 2027 và tài trợ', `<div class="grid g2">${box('Bài PR cho chiến dịch Người KSB', `${M.ppPress.length} hạng mục · ${fVND(pr27)} chưa VAT`, `<div class="list">${M.ppPress.map(x => `<div class="li"><div class="d"><b style="font-size:14px">${esc(x['Đợt'])}</b></div><div><div class="t">${esc(x['Hạng mục'])}</div><div class="s">${esc(x['Mô tả'])}</div></div><span class="tnum">${fVND(num(x['Thành tiền']))}</span></div>`).join('')}</div>`, 'NS Phân phối')}${box('Tài trợ qua các quý', esc(reg['Ghi chú'] || ''), canvas('c-sp', 'lg'), 'CP 2024–2025 · CP 2026 · Tổng hợp')}</div>`)}`;
  const after = () => {
    bindRelock();
    makeDonut('c-c26', c26.map(c => c['Đầu mục']), c26.map(c => num(c['Tổng 2026'])), c26.map((_, i) => C[i % C.length]), { money: true });
    barChart('c-ext', press.labels, [{ label: 'Hợp đồng báo chí', data: press.vals, color: C[0] }, { label: 'Sự kiện, quà tri ân báo chí', data: ev.vals, color: C[2] }, { label: 'Tài trợ, sự kiện đối tác', data: sp.vals, color: C[1] }], { stacked: true, money: true });
    barChart('c-units', units.map(u => u[0]), [{ label: 'Đã thanh toán', data: units.map(u => u[1].paid), color: '#1a7f4b' }, { label: 'Còn phải trả', data: units.map(u => u[1].amt - u[1].paid), color: C[3] }], { horizontal: true, stacked: true, money: true });
    makeDonut('c-paid', ['Đã thanh toán', 'Còn phải trả'], [total - owed, owed], ['#1a7f4b', '#c98a00'], { money: true });
    barChart('c-sp', sp.labels, [{ label: 'Tài trợ, sự kiện đối tác', data: sp.vals, color: C[1] }], { money: true });
  };
  return { html, after };
}
function pBudgetInt() {
  const nb = M.nsNoiBo; const nbT = nb.reduce((a, x) => a + num(x['Thành tiền']), 0);
  const film = M.nsAct.find(a => /phim/i.test(a['Hoạt động'])) || {};
  const evB = M.events.filter(e => e.budget > 0), acB = M.acts.filter(a => a.budget > 0);
  const html = `${head({ crumb: [{ id: 'ngan-sach', t: 'Ngân sách' }, { t: 'Nội bộ, chiến dịch và hoạt động' }], title: 'Ngân sách · <b>Nội bộ, chiến dịch và hoạt động</b>', lead: `Ngân sách nội bộ và tri ân, phim tài liệu 35 năm, sự kiện và hoạt động dự kiến đã có ước tính. ${relockBtn}`, tabs: tabsOf([{ id: 'ngan-sach', t: 'Tổng quan' }].concat(itemsOf('ngan-sach')), 'ngan-sach/noi-bo'), figs: [fig(fVND(nbT), 'nội bộ, tri ân và lưu trữ (chưa VAT)'), fig(fVND(num(film['Tổng'])), 'phim tài liệu 35 năm (chưa dự phòng, VAT)'), fig(fVND(evB.reduce((a, e) => a + e.budget, 0)), `${evB.length} sự kiện đã ước tính`), fig(fVND(acB.reduce((a, x) => a + x.budget, 0)), `${acB.length} hoạt động dự kiến đã ước tính`)] })}
  ${sec('01', 'Nội bộ, tri ân và lưu trữ', box('', 'Chưa VAT, đơn giá tạm tính', `<div class="xs"><table class="tbl"><tr><th>Đợt</th><th>Hạng mục</th><th>Quý</th><th class="r">Thành tiền</th></tr>${nb.map(x => `<tr><td>${esc(x['Đợt'])}</td><td>${esc(x['Hạng mục'])}<span class="sub">${esc(x['Mô tả'])}</span></td><td>${esc(x['Quý'])}</td><td class="r tnum">${fVND(num(x['Thành tiền']))}</td></tr>`).join('')}</table></div>`, 'NS Nội bộ & lưu trữ'))}
  ${sec('02', 'Sự kiện và hoạt động dự kiến có ngân sách', `<div class="grid g2">${box('Sự kiện 2027', `${evB.length} sự kiện có ước tính`, evB.length ? `<table class="tbl"><tr><th>Sự kiện</th><th class="r">Ngân sách</th></tr>${evB.map(e => `<tr><td>${esc(e['Sự kiện'])}<span class="sub">${esc(e['Loại'])}</span></td><td class="r tnum">${fVND(e.budget)}</td></tr>`).join('')}</table>` : empty('Chưa có sự kiện nào được ước tính ngân sách', 'Điền cột Ngân sách dự kiến trong tab Sự kiện 2027'), 'Sự kiện 2027')}${box('Hoạt động dự kiến', `${acB.length} hoạt động có ước tính`, acB.length ? `<table class="tbl"><tr><th>Hoạt động</th><th class="r">Ngân sách</th></tr>${acB.map(a => `<tr><td>${esc(a['Hoạt động'])}<span class="sub">${esc(a['Nhóm'])}</span></td><td class="r tnum">${fVND(a.budget)}</td></tr>`).join('')}</table>` : empty('Chưa có hoạt động nào được ước tính'), 'Hoạt động dự kiến')}</div>`)}`;
  return { html, after: bindRelock };
}

/* =========================================================
   BỘ ĐỊNH TUYẾN
   ========================================================= */
const ROUTES = {
  '': pHome,
  'thuong-hieu': pBrandHub, 'thuong-hieu/cong-ty': pBrandCompany, 'thuong-hieu/ca-nhan': pBrandPersonal,
  'truyen-thong': pCommHub, 'truyen-thong/bao-chi': pPress, 'truyen-thong/tai-tro': pSponsor, 'truyen-thong/su-kien-ben-ngoai': pExternalEvents, 'truyen-thong/doi-noi': pInternal,
  'su-kien': pEventsHub, 'su-kien/ky-niem': pAnniversary, 'su-kien/co-dong': pAGM, 'su-kien/noi-bo': () => pEventType(itemsOf('su-kien')[0]), 'su-kien/doi-ngoai': () => pEventType(itemsOf('su-kien')[1]), 'su-kien/le-tet': pHolidays, 'truyen-thong/kenh-so': pChannels,
  'rui-ro': pRiskHub, 'hoat-dong': pActHub,
  'ngan-sach': guard(pBudgetHub), 'ngan-sach/doi-ngoai': guard(pBudgetExt), 'ngan-sach/noi-bo': guard(pBudgetInt)
};
itemsOf('rui-ro').forEach(i => ROUTES[i.id] = () => pRiskGroup(i));
itemsOf('hoat-dong').forEach(i => ROUTES[i.id] = () => pActGroup(i));
const ORDER = [''].concat(NAV.flatMap(n => [n.id].concat(n.groups.flatMap(g => g.items.map(i => i.id)))));
const curId = () => { const h = location.hash.replace(/^#\/?/, ''); return h in ROUTES ? h : ''; };

function render(keep) {
  const id = curId(), y = window.scrollY; CUR = id; document.body.dataset.g = gOf(id);
  charts.forEach(c => c.destroy()); charts = [];
  renderMenu(id.split('/')[0]);
  let out;
  try { out = ROUTES[id](); } catch (e) { console.error(e); out = { html: `<div class="wrap" style="padding-top:40px">${empty('Không đọc được dữ liệu cho trang này', 'Có thể tên cột hoặc tên tab trong Sheet vừa thay đổi. Chi tiết: ' + esc(e.message))}</div>` }; }
  $('#page').innerHTML = out.html;
  if (out.after) try { out.after(); } catch (e) { console.error(e); }
  const it = ALL.find(a => a.id === id); document.title = (it ? it.t + ' · ' : '') + 'KSB Truyền thông';
  $('#hdr').classList.remove('nav-open');
  window.scrollTo(0, keep ? y : 0);
}
function go(step) { const i = ORDER.indexOf(curId()); location.hash = '#/' + ORDER[(i + step + ORDER.length) % ORDER.length]; }
function present(on) {
  document.body.classList.toggle('present', on);
  if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
  if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => { });
  setTimeout(() => charts.forEach(c => c.resize()), 200);
}
async function init() {
  setupChart();
  $('#sheet-link').href = CFG.SHEET_URL || '#';
  window.addEventListener('hashchange', () => render(false));
  $('#btn-refresh').onclick = async () => { await load(false); render(true); };
  $('#btn-present').onclick = () => present(!document.body.classList.contains('present'));
  $('#btn-menu').onclick = () => $('#hdr').classList.toggle('nav-open');
  $('#menu').addEventListener('click', e => { const a = e.target.closest('.menu>li>a'); if (a && window.innerWidth <= 960) { e.preventDefault(); a.parentElement.classList.toggle('open'); } });
  $('#pg-prev').onclick = () => go(-1); $('#pg-next').onclick = () => go(1); $('#pg-exit').onclick = () => present(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) present(false); });
  document.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    const pr = document.body.classList.contains('present');
    if (e.key === 'ArrowRight' && pr) go(1); else if (e.key === 'ArrowLeft' && pr) go(-1);
    else if (e.key === 'p' || e.key === 'P') present(!pr); else if (e.key === 'r' || e.key === 'R') $('#btn-refresh').click(); else if (e.key === 'Escape') present(false);
  });
  await load(true);
  if (LOCK.pw && !Object.keys(SP).length) { try { const d = await decryptBudget(LOCK.pw); SP = d.sheets || {}; build(); } catch (_) { relock(); } }
  render(false);
  if (CFG.APPS_SCRIPT_URL) setInterval(async () => { if (document.hidden) return; if (await load(false)) render(true); }, Math.max(30, +CFG.REFRESH_SECONDS || 60) * 1000);
}
init();
})();
