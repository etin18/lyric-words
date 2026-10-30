/* ==========================================================================
   學詞吧 — 前端
   資料先存在手機（localStorage），每次改動排進「待送出」佇列，有網路再送到後端。
   沒設定後端網址也能用，只是資料只存在這支手機。
   斷字與比對在 lyrics.js，這裡只負責畫面。
   ========================================================================== */
(function () {
'use strict';

const L = window.Lyrics;
const FRONT_VERSION = 'v2';
const ENTITIES = ['works', 'songs', 'words', 'meanings'];
const KK_KEYS = ['[', ']', 'ˋ', 'ˏ', 'æ', 'ɑ', 'ɛ', 'ə', 'ɚ', 'ɝ', 'ɪ', 'ɔ', 'ʊ', 'ʌ', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ'];
const FONT_MIN = 14, FONT_MAX = 28;

/* ---------- 小工具 ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const now = () => new Date().toISOString();
const lsGet = (k, d) => { try { const v = localStorage.getItem('xc.' + k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('xc.' + k, v); } catch (e) { /* 私密瀏覽等情況存不了，不影響使用 */ } };
const jsonGet = (k, d) => { try { return JSON.parse(lsGet(k, '')) || d; } catch (e) { return d; } };
const learning = (w) => w.status !== 'known';
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const svg = (body, sw) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  book: svg('<path d="M2 5.5c3.2-1.6 6.4-1.6 10 .8 3.6-2.4 6.8-2.4 10-.8v13c-3.2-1.6-6.4-1.6-10 .8-3.6-2.4-6.8-2.4-10-.8z"/><path d="M12 6.3v13"/>'),
  words: svg('<path d="M4 7V5h11v2"/><path d="M9.5 5v14"/><path d="M7 19h5"/><path d="M15 12h6"/><path d="M15 16h6"/><path d="M15 20h4"/>'),
  cards: svg('<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>', 2.4),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  up: svg('<path d="M18 15l-6-6-6 6"/>', 2.4),
  down: svg('<path d="M6 9l6 6 6-6"/>', 2.4)
};

/* ==========================================================================
   狀態與儲存
   ========================================================================== */
const nav = jsonGet('nav', {});
const state = {
  data: {},
  outbox: jsonGet('outbox', []),
  apiUrl: lsGet('api', ''),
  secret: lsGet('secret', ''),
  theme: lsGet('theme', 'light'),
  tab: ['lib', 'words', 'review'].includes(nav.tab) ? nav.tab : 'lib',
  lib: { workId: nav.workId || '', songId: nav.songId || '' },
  font: Math.min(FONT_MAX, Math.max(FONT_MIN, Number(lsGet('font', 18)) || 18)),
  hideZh: lsGet('hideZh', '') === '1',
  splitView: 'en',          // 翻譯對不上時：看英文還是中文
  sorting: '',              // 排序模式：'works' 或某個作品 id
  pick: null,               // 選片語中：{ songId, l, t }
  wf: { status: 'learning', kind: '', workId: '', q: '', sort: 'new' },   // 單字表篩選
  rs: { kind: 'all', workId: '', songId: '' },                              // 複習範圍
  review: null,             // 複習進行中：{ ids, i, flipped, ok, no }
  recent: jsonGet('recent', []),
  sync: { status: 'idle', backend: '', error: '' }
};
ENTITIES.forEach((e) => { state.data[e] = []; });
Object.assign(state.data, jsonGet('data', {}));
ENTITIES.forEach((e) => { if (!Array.isArray(state.data[e])) state.data[e] = []; });

/* ---------- 查表：資料一改就重算 ---------- */
let IDX = null;
function idx() {
  if (IDX) return IDX;
  const d = state.data;
  const map = (list) => { const o = {}; list.forEach((r) => { o[r.id] = r; }); return o; };
  const works = d.works.slice().sort(byOrder);
  const songsOf = {};
  works.forEach((w) => { songsOf[w.id] = []; });
  d.songs.slice().sort(byOrder).forEach((s) => { if (songsOf[s.workId]) songsOf[s.workId].push(s); });
  IDX = { works, songsOf, work: map(d.works), song: map(d.songs), word: map(d.words), meaning: map(d.meanings), lex: L.buildIndex(d.songs, d.words) };
  return IDX;
}
/** 這幾首歌裡出現的字（id 的集合） */
function wordIdsIn(songIds) {
  const set = new Set();
  songIds.forEach((id) => (idx().lex.songWords.get(id) || []).forEach((wid) => set.add(wid)));
  return set;
}
const learningCount = (songIds) => [...wordIdsIn(songIds)].filter((id) => idx().word[id] && learning(idx().word[id])).length;
const songsOfWork = (workId) => idx().songsOf[workId] || [];
const occOf = (wordId) => idx().lex.occ.get(wordId) || [];
const songCount = (wordId) => new Set(occOf(wordId).map((o) => o.songId)).size;
const meaningId = (wordId, songId) => `${wordId}__${songId}`;

function saveLocal() {
  IDX = null;
  lsSet('data', JSON.stringify(state.data));
  lsSet('outbox', JSON.stringify(state.outbox));
}
function saveNav() { lsSet('nav', JSON.stringify({ tab: state.tab, workId: state.lib.workId, songId: state.lib.songId })); }

/* ---------- 寫入：先改本機，再排進佇列 ---------- */
function put(entity, rec) {
  if (!rec.id) rec.id = uid();
  if (!rec.createdAt) rec.createdAt = now();
  const list = state.data[entity];
  const i = list.findIndex((r) => r.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  state.outbox.push({ action: 'save', entity, record: rec });
  saveLocal(); flush();
  return rec;
}
function del(entity, id) {
  state.data[entity] = state.data[entity].filter((r) => r.id !== id);
  state.outbox.push({ action: 'remove', entity, id });
  saveLocal(); flush();
}

/* ---------- 同步 ---------- */
let flushing = false;
async function call(payload) {
  const res = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // 簡單請求，免 CORS 預檢
    body: JSON.stringify(Object.assign({ secret: state.secret }, payload))
  });
  const json = await res.json();
  if (json.apiVersion) state.sync.backend = json.apiVersion;
  if (!json.ok) {
    const err = new Error(json.error || '後端回應失敗');
    err.auth = !!json.authError;
    throw err;
  }
  return json;
}

async function flush() {
  renderSync();
  if (!state.apiUrl || flushing || !state.outbox.length) return;
  if (!navigator.onLine) return void setSync('offline');
  flushing = true;
  setSync('syncing');
  try {
    while (state.outbox.length) {
      const batch = state.outbox.slice(0, 20);
      const json = await call({ action: 'batch', ops: batch });
      // 單筆失敗不能卡住後面的：丟掉並提醒，不然會永遠送不完
      const failed = json.results.filter((r) => !r.ok);
      state.outbox.splice(0, batch.length);
      saveLocal();
      if (failed.length) toast(`有 ${failed.length} 筆沒存進試算表：${failed[0].error}`);
    }
    setSync('ok');
  } catch (e) {
    setSync(e.auth ? 'auth' : 'error', e.message);
  } finally {
    flushing = false;
  }
}

async function pull() {
  if (!state.apiUrl) return;
  await flush();
  if (state.outbox.length) return;           // 還有沒送出的，別拿舊資料蓋掉
  setSync('syncing');
  try {
    const json = await call({ action: 'list' });
    ENTITIES.forEach((e) => { state.data[e] = json[e] || []; });
    saveLocal();
    setSync('ok');
    if (!pop && !state.pick) render();       // 正在看小框或選片語時不重畫，免得被打斷
  } catch (e) {
    setSync(e.auth ? 'auth' : navigator.onLine ? 'error' : 'offline', e.message);
  }
}

function setSync(status, error) { state.sync.status = status; state.sync.error = error || ''; renderSync(); }
function renderSync() {
  const el = $('#sync');
  const n = state.outbox.length;
  let text = '', bad = false;
  if (!state.apiUrl) text = '只存在這支手機';
  else if (state.sync.status === 'syncing') text = '同步中…';
  else if (state.sync.status === 'auth') { text = '密語錯誤'; bad = true; }
  else if (state.sync.status === 'error') { text = n ? `待同步 ${n} 筆` : '同步失敗'; bad = true; }
  else if (state.sync.status === 'offline' || !navigator.onLine) { text = n ? `離線 · 待同步 ${n} 筆` : '離線'; bad = true; }
  else text = n ? `待同步 ${n} 筆` : '已同步';
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ==========================================================================
   外觀：主題、自訂背景（沿用追星記帳本）
   ========================================================================== */
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('xc-bg', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function bgGet() {
  try {
    const db = await idb();
    return await new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get('bg'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch (e) { return null; }
}
async function bgSet(value) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    if (value) tx.objectStore('kv').put(value, 'bg'); else tx.objectStore('kv').delete('bg');
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

const GLOW = 'radial-gradient(circle at 20% 15%, #ff8fd0 0, transparent 38%), radial-gradient(circle at 85% 30%, #7c8cff 0, transparent 42%), radial-gradient(circle at 40% 85%, #ffb36b 0, transparent 40%), #3a2457';
let bgData = null;   // { url, lum }
function sliderVal(k, d) { const v = parseFloat(lsGet(k, '')); return Number.isFinite(v) ? v : d; }

function applyTheme() {
  const root = document.documentElement;
  const pref = state.theme;
  const meta = $('#theme-color');
  if (pref === 'glow' || (pref === 'custom' && bgData)) {
    // 壓暗至少 20%：太亮的照片就算白字配深色玻璃也會刺眼
    const dim = Math.max(sliderVal('dim', 0.3), 0.2);
    root.dataset.theme = 'photo';
    root.dataset.tone = 'dark';
    if (pref === 'custom') root.dataset.glass = 'deep'; else delete root.dataset.glass;
    root.style.setProperty('--bg-img', pref === 'custom' ? `url(${bgData.url})` : GLOW);
    root.style.setProperty('--dim', dim);
    root.style.setProperty('--blur', sliderVal('blur', 2) + 'px');
    root.style.setProperty('--bg-pos', sliderVal('pos', 50) + '%');
    meta.setAttribute('content', '#2b1d3f');
  } else {
    const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    delete root.dataset.tone;
    delete root.dataset.glass;
    meta.setAttribute('content', dark ? '#16141b' : '#faf7f5');
  }
}

/** 照片縮到長邊 1600、取平均亮度，再存進 IndexedDB（不上傳） */
async function importBackground(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.82);
    const s = document.createElement('canvas'); s.width = s.height = 24;
    const sx = s.getContext('2d'); sx.drawImage(c, 0, 0, 24, 24);
    const px = sx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    bgData = { url: dataUrl, lum: sum / (px.length / 4) };
    await bgSet(bgData);
    state.theme = 'custom'; lsSet('theme', 'custom');
    applyTheme();
  } finally { URL.revokeObjectURL(url); }
}

/* ==========================================================================
   骨架
   ========================================================================== */
const TABS = [['lib', '歌詞本', 'book'], ['words', '單字表', 'words'], ['review', '複習', 'cards']];

/** 導覽到不存在的作品或歌曲（例如在別支手機刪掉了）就退回上一層 */
function fixNav() {
  if (state.lib.songId && !idx().song[state.lib.songId]) state.lib.songId = '';
  if (state.lib.workId && !idx().work[state.lib.workId]) state.lib.workId = '';
  if (state.pick && state.pick.songId !== state.lib.songId) state.pick = null;
}

function renderChrome() {
  $('#tabs').innerHTML = TABS.map(([k, label, icon]) =>
    `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${ICONS[icon]}${label}</button>`).join('');
  let title = '學詞吧', back = false;
  if (state.tab === 'lib') {
    const w = idx().work[state.lib.workId];
    if (w) { title = w.name; back = true; }
  } else title = state.tab === 'words' ? '單字表' : '複習';
  $('#title').textContent = title;
  $('#btn-back').hidden = !back;
  $('#btn-back').innerHTML = ICONS.back;
  $('#btn-gear').innerHTML = ICONS.gear;
  $('#pickbar').innerHTML = state.pick && state.tab === 'lib' && state.lib.songId
    ? '<div class="pickbar"><span>點片語的<b>最後一個字</b>（同一行）</span><button data-pick-cancel>取消</button></div>' : '';
  renderSync();
}

/** 重畫目前這一頁。toTop：換頁時捲回最上面 */
function render(toTop) {
  closePop();
  fixNav();
  saveNav();
  renderChrome();
  const view = $('#view');
  const keep = view.scrollTop;
  const active = document.activeElement;
  const activeId = active && view.contains(active) ? active.id : '';
  const caret = activeId ? active.selectionStart : null;
  view.innerHTML = ({ lib: viewLib, words: viewWords, review: viewReview })[state.tab]();
  view.scrollTop = toTop ? 0 : keep;
  if (activeId) {
    const again = document.getElementById(activeId);
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) { /* 不是文字欄位 */ } }
  }
  refreshSheets();
}

function goSong(songId) {
  const s = idx().song[songId];
  if (!s) return;
  state.tab = 'lib';
  state.lib = { workId: s.workId, songId };
  state.splitView = 'en';
  state.pick = null;
  state.recent = [songId].concat(state.recent.filter((id) => id !== songId)).slice(0, 5);
  lsSet('recent', JSON.stringify(state.recent));
  render(true);
}

/* ==========================================================================
   歌詞本：作品列表 → 作品 → 歌詞
   ========================================================================== */
function viewLib() {
  if (state.lib.songId) return viewSong();
  if (state.lib.workId) return viewWork();
  return viewWorks();
}

const moveBtns = (kind, id, i, n) => `<div class="mv"><button data-move="${kind}" data-id="${id}" data-dir="-1" aria-label="往上" ${i === 0 ? 'disabled' : ''}>${ICONS.up}</button><button data-move="${kind}" data-id="${id}" data-dir="1" aria-label="往下" ${i === n - 1 ? 'disabled' : ''}>${ICONS.down}</button></div>`;

function viewWorks() {
  const works = idx().works;
  if (!works.length) {
    return `<div class="empty">還沒有作品。<br>先新增一部音樂劇，再把歌詞貼進去。</div>
      <button class="btn" data-add-work>＋ 新增作品</button>`;
  }
  const recent = state.recent.map((id) => idx().song[id]).filter((s) => s && idx().work[s.workId]).slice(0, 3);
  const sorting = state.sorting === 'works';
  return `
    ${recent.length && !sorting ? `<div class="card"><h3>最近看過</h3>${recent.map((s) => `
      <div class="item" data-song="${s.id}"><div class="main"><div class="t">${esc(s.title)}</div><div class="s">${esc(idx().work[s.workId].name)}</div></div><span class="go">›</span></div>`).join('')}</div>` : ''}
    <div class="card"><h3><span class="grow">作品</span>${works.length > 1 ? `<button class="btn small ghost" data-sorting="works">${sorting ? '完成' : '排序'}</button>` : ''}</h3>
      ${works.map((w, i) => {
        const songs = songsOfWork(w.id);
        const n = learningCount(songs.map((s) => s.id));
        return `<div class="item" ${sorting ? '' : `data-work="${w.id}"`}><div class="main"><div class="t">${esc(w.name)}</div><div class="s">${songs.length} 首歌${n ? ` · ${n} 個字在學` : ''}</div></div>${sorting ? moveBtns('works', w.id, i, works.length) : '<span class="go">›</span>'}</div>`;
      }).join('')}
    </div>
    ${sorting ? '' : '<button class="btn ghost" data-add-work>＋ 新增作品</button>'}`;
}

function viewWork() {
  const w = idx().work[state.lib.workId];
  const songs = songsOfWork(w.id);
  const sorting = state.sorting === w.id;
  return `
    <div class="card"><h3><span class="grow">歌曲</span>${songs.length > 1 ? `<button class="btn small ghost" data-sorting="${w.id}">${sorting ? '完成' : '排序'}</button>` : ''}</h3>
      ${songs.length ? songs.map((s, i) => {
        const n = learningCount([s.id]);
        return `<div class="item" ${sorting ? '' : `data-song="${s.id}"`}><span class="num">${i + 1}</span><div class="main"><div class="t">${esc(s.title)}</div><div class="s">${n ? `${n} 個字在學` : '還沒有在學的字'}${s.translation ? ' · 有翻譯' : ''}</div></div>${sorting ? moveBtns('songs', s.id, i, songs.length) : '<span class="go">›</span>'}</div>`;
      }).join('') : '<p class="hint" style="padding:8px 0">還沒有歌。按下面的按鈕，把歌詞貼進來。</p>'}
    </div>
    ${sorting ? '' : `<button class="btn" data-add-song>＋ 新增歌曲</button>
    <div class="btn-row" style="margin-top:18px"><button class="btn ghost" data-rename-work>改作品名稱</button><button class="btn danger" data-del-work>刪除作品</button></div>`}`;
}

/** 一行英文歌詞：每個字是一個可以點的 span，記過的畫線。
    片語整段包在一個 span 裡，虛線才會連成一條；兩個片語重疊時合併成一段 */
function lineHtml(line, l) {
  const { tokens, occs } = L.markLine(line, idx().lex.dict);
  const pick = state.pick && state.pick.l === l ? state.pick.t : -1;
  const ranges = [];
  occs.filter((o) => learning(o.word)).sort((a, b) => a.s - b.s).forEach((o) => {
    const last = ranges[ranges.length - 1];
    if (last && o.s <= last.e) last.e = Math.max(last.e, o.e); else ranges.push({ s: o.s, e: o.e });
  });
  const opens = new Set(ranges.map((r) => r.s)), closes = new Set(ranges.map((r) => r.e));
  let html = '', pos = 0;
  tokens.forEach((t, i) => {
    html += esc(line.slice(pos, t.start));
    if (opens.has(i)) html += '<span class="ph">';
    const cls = ['w'];
    if (t.word && learning(t.word)) cls.push('wk');
    if (i === pick) cls.push('pick');
    html += `<span class="${cls.join(' ')}" data-l="${l}" data-t="${i}">${esc(t.text)}</span>`;
    if (closes.has(i)) html += '</span>';
    pos = t.end;
  });
  return html + esc(line.slice(pos));
}

function viewSong() {
  const s = idx().song[state.lib.songId];
  const p = L.pairLines(s.lyrics, s.translation);
  const showZh = p.mode === 'pair' && !state.hideZh;
  const zhView = p.mode === 'split' && state.splitView === 'zh';
  const n = learningCount([s.id]);
  const songs = songsOfWork(s.workId);
  const at = songs.findIndex((x) => x.id === s.id);
  const prev = songs[at - 1], next = songs[at + 1];

  // [ODYSSEUS] 這種整行小標：顯示成灰色小字，不能點
  const who = (l) => `<div class="who">${esc(l.trim().slice(1, -1).trim())}</div>`;
  const body = zhView
    ? p.zh.map((l) => (!l.trim() ? '<div class="stanza"></div>' : L.isLabel(l) ? who(l) : `<div class="zh-only">${esc(l)}</div>`)).join('')
    : p.rows.map((r, l) => (!r.en.trim() ? '<div class="stanza"></div>' : L.isLabel(r.en) ? who(r.en)
      : `<div class="ln" data-ln="${l}"><div class="en">${lineHtml(r.en, l)}</div>${showZh && r.zh ? `<div class="zh">${esc(r.zh)}</div>` : ''}</div>`)).join('');

  return `
    <h2 class="song-title">${esc(s.title)}</h2>
    <div class="song-bar">
      <span class="wn">${n ? `${n} 個字在學` : ''}</span>
      ${p.mode === 'pair' ? `<button class="tbtn ${state.hideZh ? '' : 'on'}" data-toggle-zh aria-label="顯示中文">中文</button>` : ''}
      <button class="tbtn" data-fs="-1" aria-label="字小一點" ${state.font <= FONT_MIN ? 'disabled' : ''}>A−</button>
      <button class="tbtn" data-fs="1" aria-label="字大一點" ${state.font >= FONT_MAX ? 'disabled' : ''}>A+</button>
      <button class="tbtn" data-edit-song aria-label="編輯歌曲">${ICONS.edit}</button>
    </div>
    ${p.mode === 'split' ? `<div class="seg"><button data-split="en" class="${zhView ? '' : 'on'}">英文</button><button data-split="zh" class="${zhView ? 'on' : ''}">中文</button></div>
      <p class="hint" style="margin:-4px 2px 10px">英文 ${p.enCount} 行、中文 ${p.zhCount} 行，對不上，所以分開顯示。按右上角的筆編輯，讓有字的行數一樣就能逐行對照。</p>` : ''}
    ${!state.data.words.length && !zhView ? '<p class="hint" style="margin:0 2px 10px">點任何一個字，就能記下它的中文和 KK 音標。</p>' : ''}
    <div class="card ly" style="--fs:${state.font}px">${body}</div>
    ${prev || next ? `<div class="btn-row">${prev ? `<button class="btn ghost" data-song="${prev.id}">‹ ${esc(prev.title)}</button>` : '<span style="flex:1"></span>'}${next ? `<button class="btn ghost" data-song="${next.id}">${esc(next.title)} ›</button>` : '<span style="flex:1"></span>'}</div>` : ''}`;
}

/* ==========================================================================
   點字跳出的小框
   ========================================================================== */
let pop = null;   // { l, t, top：打開時的捲動位置 }

function closePop() {
  if (!pop) return;
  pop = null;
  const host = $('#pop');
  host.hidden = true; host.innerHTML = '';
  $$('.ly .w.on').forEach((e) => e.classList.remove('on'));
}

function curLine(l) { return L.splitLines(idx().song[state.lib.songId].lyrics)[l] || ''; }

function noteHtml(w, songId) {
  const m = songId && idx().meaning[meaningId(w.id, songId)];
  const known = !learning(w);
  return `<div class="note">
    <div class="note-h"><span class="note-w en">${esc(w.text)}</span>${w.kk ? `<span class="kk">${esc(w.kk)}</span>` : ''}${known ? '<span class="tag ok">已經會了</span>' : ''}</div>
    ${w.zh ? `<div class="note-zh">${esc(w.zh)}</div>` : ''}
    ${m && m.text ? `<div class="note-m"><b>在這首歌：</b>${esc(m.text)}</div>` : ''}
    ${w.note ? `<div class="note-n">${esc(w.note)}</div>` : ''}
    <div class="note-act"><button class="btn small ghost" data-pop-edit="${w.id}">編輯</button>${known
      ? `<button class="btn small" data-restore="${w.id}">恢復</button>`
      : `<button class="btn small ghost" data-known="${w.id}">已經會了</button>`}</div>
  </div>`;
}

function openPop(l, t) {
  pop = { l, t, top: $('#view').scrollTop };
  const { tokens } = L.markLine(curLine(l), idx().lex.dict);
  const tok = tokens[t];
  if (!tok) return closePop();
  // 片語在前（學習中的先），再來是這個字本身
  const seen = new Set();
  const phrases = tok.phrases.map((o) => o.word).filter((w) => !seen.has(w.id) && seen.add(w.id))
    .sort((a, b) => Number(!learning(a)) - Number(!learning(b)));
  const notes = phrases.concat(tok.word ? [tok.word] : []);
  const host = $('#pop');
  // 點的字在片語裡、本身沒記過：標題就是片語的筆記，按鈕寫明要記的是哪個字
  const addLabel = notes.length ? `記「${esc(L.norm(tok.text).toLowerCase())}」` : '記這個字';
  host.innerHTML = `
    ${notes.length ? '' : `<div class="pop-word">${esc(tok.text)}</div>`}
    ${notes.map((w) => noteHtml(w, state.lib.songId)).join('')}
    <div class="pop-act">${tok.word ? '' : `<button class="btn" data-pop-add>${addLabel}</button>`}<button class="btn ghost" data-pop-phrase>從這裡選片語</button></div>`;
  placePop();
}

/** 小框放在字的下面；字在畫面下半部就放上面。超出可視範圍時框裡面自己捲 */
function placePop() {
  const host = $('#pop');
  const a = document.querySelector(`.ly .w[data-l="${pop.l}"][data-t="${pop.t}"]`);
  if (!a) return closePop();
  $$('.ly .w.on').forEach((e) => e.classList.remove('on'));
  a.classList.add('on');
  const r = a.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  host.hidden = false;
  host.style.maxHeight = '';
  const w = host.offsetWidth;
  host.style.left = Math.round(Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12))) + 'px';
  if (r.top > vh * 0.5) {
    host.style.top = '';
    host.style.bottom = Math.round(vh - r.top + 8) + 'px';
    host.style.maxHeight = Math.round(r.top - 8 - 16) + 'px';
  } else {
    host.style.bottom = '';
    host.style.top = Math.round(r.bottom + 8) + 'px';
    host.style.maxHeight = Math.round(vh - r.bottom - 8 - 16) + 'px';
  }
}

function tapWord(el) {
  const l = Number(el.dataset.l), t = Number(el.dataset.t);
  if (state.pick) {
    if (l !== state.pick.l) return toast('片語要在同一行，請點這一行的字');
    const tokens = L.tokenize(curLine(l));
    const a = Math.min(state.pick.t, t), b = Math.max(state.pick.t, t);
    const text = curLine(l).slice(tokens[a].start, tokens[b].end);
    state.pick = null;
    render();
    const existing = state.data.words.find((w) => L.keyOf(w.text) === L.keyOf(text));
    if (existing) return openWordForm(existing, l);
    return openWordForm({ text: L.norm(text).toLowerCase() }, l);
  }
  if (pop && pop.l === l && pop.t === t) return closePop();
  openPop(l, t);
}

/* ==========================================================================
   單字表
   ========================================================================== */
function filteredWords() {
  const { status, kind, workId, q, sort } = state.wf;
  let list = state.data.words.slice();
  if (status) list = list.filter((w) => (status === 'known') === !learning(w));
  if (kind) list = list.filter((w) => L.kindOf(w.text) === kind);
  if (workId) { const set = wordIdsIn(songsOfWork(workId).map((s) => s.id)); list = list.filter((w) => set.has(w.id)); }
  const k = q.trim().toLowerCase();
  if (k) list = list.filter((w) => [w.text, w.zh, w.kk, w.note].some((x) => String(x || '').toLowerCase().includes(k)));
  list.sort(sort === 'az'
    ? (a, b) => L.keyOf(a.text).localeCompare(L.keyOf(b.text))
    : (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return list;
}

function wordListHtml() {
  const list = filteredWords();
  if (!list.length) return `<div class="empty">${state.wf.q.trim() ? '找不到符合的字' : '這裡還沒有字'}</div>`;
  return `<div class="card wl"><h3><span class="grow">共 ${list.length} 個</span></h3>${list.map((w) => {
    const n = songCount(w.id);
    return `<div class="item" data-word="${w.id}"><div class="main">
      <div class="t"><span class="en">${esc(w.text)}</span>${w.kk ? ` <span class="kk">${esc(w.kk)}</span>` : ''}</div>
      <div class="s">${learning(w) ? '' : '<span class="tag ok">已會</span>'}${esc(w.zh || '（還沒寫中文）')}</div>
    </div><span class="cnt">${n ? n + ' 首' : ''}</span></div>`;
  }).join('')}</div>`;
}

function viewWords() {
  const words = state.data.words;
  if (!words.length) return '<div class="empty">還沒有記過字。<br>到「歌詞本」打開一首歌，點不會的字就能記下來。</div>';
  const nLearn = words.filter(learning).length;
  const { status, kind, workId, sort } = state.wf;
  const chip = (v, label) => `<button class="chip ${status === v ? 'on' : ''}" data-wf-status="${v}">${label}</button>`;
  return `
    <label class="search">${ICONS.search}<input id="wf-q" type="search" placeholder="搜尋英文或中文" value="${esc(state.wf.q)}" autocomplete="off"></label>
    <div class="chips">${chip('learning', `學習中 ${nLearn}`)}${chip('known', `已會 ${words.length - nLearn}`)}${chip('', `全部 ${words.length}`)}</div>
    <div class="select-row">
      <select data-wf="kind" aria-label="種類"><option value="" ${kind ? '' : 'selected'}>單字和片語</option><option value="word" ${kind === 'word' ? 'selected' : ''}>只看單字</option><option value="phrase" ${kind === 'phrase' ? 'selected' : ''}>只看片語</option></select>
      <select data-wf="workId" aria-label="作品"><option value="">所有作品</option>${idx().works.map((w) => `<option value="${w.id}" ${workId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
      <select data-wf="sort" aria-label="排序"><option value="new" ${sort === 'new' ? 'selected' : ''}>最新記的</option><option value="az" ${sort === 'az' ? 'selected' : ''}>A → Z</option></select>
    </div>
    <div id="wl">${wordListHtml()}</div>`;
}

/** 一行歌詞裡，把某個字（或片語）標出來 */
function markIn(line, w) {
  const { tokens, occs } = L.markLine(line, L.makeDict([w]));
  const ranges = [];
  tokens.forEach((t) => { if (t.word) ranges.push([t.start, t.end, '']); });
  occs.forEach((o) => ranges.push([tokens[o.s].start, tokens[o.e].end, ' class="p"']));   // 片語用虛線，跟歌詞頁一樣
  ranges.sort((a, b) => a[0] - b[0]);
  let html = '', pos = 0;
  ranges.forEach(([s, e, cls]) => { if (s < pos) return; html += esc(line.slice(pos, s)) + `<mark${cls}>` + esc(line.slice(s, e)) + '</mark>'; pos = e; });
  return html + esc(line.slice(pos));
}

let detailId = '';
function wordSheet() {
  const w = idx().word[detailId];
  if (!w) return `${sheetTop('', '關閉')}<div class="sheet-body"><div class="empty">這個字已經刪掉了</div></div>`;
  const means = state.data.meanings.filter((m) => m.wordId === w.id && m.text && idx().song[m.songId]);
  const occ = occOf(w.id);
  return `
    ${sheetTop(L.kindOf(w.text) === 'phrase' ? '片語' : '單字', '關閉')}
    <div class="sheet-body">
      <div class="card">
        <div class="big-word">${esc(w.text)}</div>
        ${w.kk ? `<div class="kk" style="margin-top:2px">${esc(w.kk)}</div>` : ''}
        <div class="big-zh">${esc(w.zh || '（還沒寫中文）')}</div>
        ${w.note ? `<p class="pre hint" style="margin-top:8px;font-size:14px">${esc(w.note)}</p>` : ''}
        ${learning(w) ? '' : '<p style="margin-top:8px"><span class="tag ok">已經會了</span><span class="hint">歌詞裡不畫線，也不會出現在複習</span></p>'}
      </div>
      ${means.length ? `<div class="card"><h3>在各首歌的意思</h3>${means.map((m) => `<div class="mean"><small>${esc(idx().song[m.songId].title)}</small><div>${esc(m.text)}</div></div>`).join('')}</div>` : ''}
      <div class="card"><h3>出現在 ${occ.length ? `${new Set(occ.map((o) => o.songId)).size} 首歌` : ''}</h3>
        ${occ.length ? occ.map((o) => {
          const s = idx().song[o.songId];
          const work = s && idx().work[s.workId];
          return `<div class="occ" data-goto="${o.songId}" data-line="${o.line}"><div class="s">${esc(s.title)}${work ? ' · ' + esc(work.name) : ''}</div><div class="line">${markIn(o.text, w)}</div></div>`;
        }).join('') : '<p class="hint">目前沒有歌詞出現這個字（可能歌詞改過了）。</p>'}
      </div>
      <div class="btn-row"><button class="btn ghost" data-word-edit="${w.id}">編輯</button>${learning(w)
        ? `<button class="btn ghost" data-known="${w.id}">已經會了</button>`
        : `<button class="btn" data-restore="${w.id}">恢復成學習中</button>`}</div>
      <button class="btn danger" data-word-del="${w.id}">刪除這個字</button>
    </div>`;
}

function setStatus(id, status) {
  const w = idx().word[id];
  if (!w) return;
  put('words', Object.assign({}, w, { status, updatedAt: now() }));
  toast(status === 'known' ? '標成已經會了，歌詞裡不再畫線' : '恢復了，歌詞裡會再畫線');
}

function deleteWord(id) {
  const w = idx().word[id];
  if (!w || !confirm(`刪除「${w.text}」？筆記和各首歌裡的意思都會一起刪掉，刪了就找不回來。`)) return false;
  state.data.meanings.filter((m) => m.wordId === id).forEach((m) => del('meanings', m.id));
  del('words', id);
  toast('刪除了');
  return true;
}

/* ==========================================================================
   複習
   ========================================================================== */
function scopeWords() {
  const { kind, workId, songId } = state.rs;
  let list = state.data.words.filter(learning);
  if (kind === 'work') { const set = wordIdsIn(songsOfWork(workId).map((s) => s.id)); list = list.filter((w) => set.has(w.id)); }
  if (kind === 'song') { const set = wordIdsIn([songId]); list = list.filter((w) => set.has(w.id)); }
  return list;
}

/** 範圍選了作品或歌曲，但還沒指定哪一個（或那個被刪了）：帶第一個 */
function fixScope() {
  const rs = state.rs;
  if (rs.kind === 'all') return;
  if (!idx().work[rs.workId]) rs.workId = idx().works.length ? idx().works[0].id : '';
  if (rs.kind === 'song') {
    const songs = songsOfWork(rs.workId);
    if (!songs.some((s) => s.id === rs.songId)) rs.songId = songs.length ? songs[0].id : '';
  }
}

function startReview(ids) {
  state.review = { ids: shuffle(ids), i: 0, flipped: false, ok: [], no: [] };
  render(true);
}

/** 卡片上的提示句：優先用複習範圍裡的那首歌 */
function hintOf(w) {
  const occ = occOf(w.id);
  const { kind, songId, workId } = state.rs;
  let o = null;
  if (kind === 'song') o = occ.find((x) => x.songId === songId);
  if (!o && kind === 'work') o = occ.find((x) => idx().song[x.songId].workId === workId);
  return o || occ.find((x) => x.songId === w.songId) || occ[0] || null;
}

function viewReview() {
  const r = state.review;
  if (r) {
    while (r.i < r.ids.length && !idx().word[r.ids[r.i]]) r.i++;   // 複習到一半被刪掉的字跳過
    return r.i < r.ids.length ? reviewCard(r) : reviewDone(r);
  }
  if (!state.data.words.some(learning)) return '<div class="empty">還沒有在學的字。<br>到「歌詞本」打開一首歌，點不會的字記下來，就能在這裡複習。</div>';
  fixScope();
  const rs = state.rs;
  const n = scopeWords().length;
  const workSel = `<select data-rs="workId" aria-label="作品">${idx().works.map((w) => `<option value="${w.id}" ${rs.workId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>`;
  const songSel = `<select data-rs="songId" aria-label="歌曲">${songsOfWork(rs.workId).map((s) => `<option value="${s.id}" ${rs.songId === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select>`;
  return `
    <div class="card"><h3>要複習哪些字</h3>
      <div class="seg" style="margin-top:6px"><button data-rs-kind="all" class="${rs.kind === 'all' ? 'on' : ''}">全部</button><button data-rs-kind="work" class="${rs.kind === 'work' ? 'on' : ''}">選作品</button><button data-rs-kind="song" class="${rs.kind === 'song' ? 'on' : ''}">選歌曲</button></div>
      ${rs.kind !== 'all' ? `<div class="select-row">${workSel}</div>` : ''}
      ${rs.kind === 'song' ? `<div class="select-row">${songSel}</div>` : ''}
      <p class="hint" style="margin:4px 0 10px">${n ? `共 ${n} 個在學的字，順序隨機。` : '這個範圍沒有在學的字。'}</p>
      <button class="btn" data-rv-start ${n ? '' : 'disabled'}>開始複習</button>
    </div>
    <p class="hint" style="padding:0 4px">卡片正面是英文，點一下翻面看中文和音標。記得就按「記得」；還不熟的，一輪結束後可以再練一次。已經會了的字不會出現在這裡。</p>`;
}

function reviewCard(r) {
  const w = idx().word[r.ids[r.i]];
  const h = hintOf(w);
  const hs = h && idx().song[h.songId];
  const m = hs && idx().meaning[meaningId(w.id, hs.id)];
  return `
    <div class="rv-top"><span>${r.i + 1} / ${r.ids.length}</span><button class="btn small ghost" data-rv-end>結束</button></div>
    <div class="pbar"><i style="width:${Math.round((r.i / r.ids.length) * 100)}%"></i></div>
    <div class="card fc" data-rv-flip>
      <div class="fc-word">${esc(w.text)}</div>
      ${h ? `<div class="fc-hint">${markIn(h.text, w)}</div><div class="fc-src">${esc(hs.title)}</div>` : ''}
      ${r.flipped ? `<div class="fc-back">
        ${w.kk ? `<div class="kk">${esc(w.kk)}</div>` : ''}
        <div class="zh">${esc(w.zh || '（還沒寫中文）')}</div>
        ${m && m.text ? `<div class="note-m"><b>在這首歌：</b>${esc(m.text)}</div>` : ''}
        ${w.note ? `<div class="note-n">${esc(w.note)}</div>` : ''}
      </div>` : '<div class="fc-tap">點一下看答案</div>'}
    </div>
    ${r.flipped ? `<div class="btn-row"><button class="btn ghost" data-rv="no">還不熟</button><button class="btn" data-rv="ok">記得</button></div>
      <button class="btn danger" data-rv-known>已經會了，以後不用再複習</button>` : ''}`;
}

function reviewDone(r) {
  const no = r.no.map((id) => idx().word[id]).filter(Boolean);
  return `
    <div class="card" style="text-align:center"><h3 style="justify-content:center;font-size:16px;margin:4px 0 10px">這一輪結束了</h3>
      <div class="score"><div class="card"><b>${r.ok.length}</b><small>記得</small></div><div class="card"><b>${no.length}</b><small>還不熟</small></div></div>
    </div>
    ${no.length ? `<div class="card"><h3>還不熟的字</h3>${no.map((w) => `<div class="item" data-word="${w.id}"><div class="main"><div class="t"><span class="en">${esc(w.text)}</span>${w.kk ? ` <span class="kk">${esc(w.kk)}</span>` : ''}</div><div class="s">${esc(w.zh)}</div></div><span class="go">›</span></div>`).join('')}</div>
      <button class="btn" data-rv-again="no">再練不熟的 ${no.length} 個</button>` : ''}
    <button class="btn ${no.length ? 'ghost' : ''}" data-rv-again="all">全部再來一次</button>
    <button class="btn ghost" data-rv-reset>換範圍</button>`;
}

/* ==========================================================================
   全螢幕面板：開關與重繪
   ========================================================================== */
const sheets = [];   // [{ id, render }]
function openSheet(id, renderFn) {
  closePop();
  const found = sheets.find((s) => s.id === id);
  if (found) found.render = renderFn; else sheets.push({ id, render: renderFn });
  refreshSheets();
}
function closeSheet(id) {
  const i = sheets.findIndex((s) => s.id === id);
  if (i >= 0) sheets.splice(i, 1);
  refreshSheets();
}
function refreshSheets() {
  const host = $('#sheets');
  // 保留正在輸入的欄位焦點，不然每次重繪都會收鍵盤
  const active = document.activeElement;
  const activeId = active && host.contains(active) ? active.id : '';
  const caret = activeId ? active.selectionStart : null;
  const scrolls = $$('.sheet-body', host).map((e) => e.scrollTop);
  host.innerHTML = sheets.map((s) => `<div class="sheet" data-sheet="${s.id}">${s.render()}</div>`).join('');
  $$('.sheet-body', host).forEach((e, i) => { e.scrollTop = scrolls[i] || 0; });
  if (activeId) {
    const again = document.getElementById(activeId);
    if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) { /* 不是文字欄位 */ } }
  }
}
const sheetTop = (title, left, right) => `<div class="sheet-top"><button class="link" data-close>${left || '取消'}</button><h2>${esc(title)}</h2>${right ? `<button class="link" data-save>${right}</button>` : '<span style="min-width:52px"></span>'}</div>`;

/* ==========================================================================
   表單：記字、歌曲
   ========================================================================== */
let form = null;
let kkCaret = null;   // KK 音標欄的游標位置：按符號鍵時插在這裡

/** existing 有 id 是編輯；只有 text 是新的字。l 是在哪一行點的（從單字表編輯時沒有） */
function openWordForm(existing, l) {
  const songId = l != null ? state.lib.songId : '';
  const m = existing.id && songId ? idx().meaning[meaningId(existing.id, songId)] : null;
  form = {
    kind: 'word', songId, line: l != null ? curLine(l) : '', id: existing.id || '',
    model: { text: existing.text || '', zh: existing.zh || '', kk: existing.kk || '', note: existing.note || '', meaning: m ? m.text : '' }
  };
  kkCaret = null;
  openSheet('form', wordFormHtml);
}

function wordFormHtml() {
  const f = form, m = f.model;
  const song = f.songId && idx().song[f.songId];
  const field = (key, label, extra, ph) => `<div class="field col"><label for="f-${key}">${label}</label><input id="f-${key}" data-path="${key}" value="${esc(m[key])}" placeholder="${esc(ph || '')}" autocomplete="off" ${extra || ''}></div>`;
  return `
    ${sheetTop(f.id ? '編輯' : '記下來', '取消', '存起來')}
    <div class="sheet-body">
      ${f.line ? `<div class="ctx">${markIn(f.line, { id: '_', text: f.id ? idx().word[f.id].text : m.text })}<small>${esc(song.title)}</small></div>` : ''}
      <div class="card">
        ${field('text', '英文 <span class="req">*</span>', 'autocapitalize="off" autocorrect="off" spellcheck="false"', '單字或片語')}
        ${field('zh', '中文', '', '例如：渴望')}
        <div class="field col"><label for="f-kk">KK 音標</label><input id="f-kk" class="ipa" data-path="kk" value="${esc(m.kk)}" placeholder="例如：[jɝn]" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          <div class="kkkeys">${KK_KEYS.map((k) => `<button type="button" data-kk="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
        <div class="field col"><label for="f-note">備註</label><textarea id="f-note" data-path="note" rows="3" placeholder="例句、用法、自己的提醒">${esc(m.note)}</textarea></div>
      </div>
      ${song ? `<div class="card"><div class="field col"><div class="label-row"><label for="f-meaning">在「${esc(song.title)}」裡的意思</label><small>選填</small></div><textarea id="f-meaning" data-path="meaning" rows="2" placeholder="同一個字在不同歌裡意思可能不一樣">${esc(m.meaning)}</textarea></div></div>` : ''}
      <p class="hint" style="padding:0 4px">${L.kindOf(m.text) === 'phrase' ? '片語：同一行裡連在一起出現就會畫虛線，大小寫、中間的標點不影響。' : '只有一模一樣的字會畫線（大小寫不影響）：記了 dream，dreams 不會畫。'}</p>
      ${f.id ? '<button class="btn danger" data-form-del style="margin-top:14px">刪除這個字</button>' : ''}
    </div>`;
}

function saveWord() {
  const f = form, m = f.model;
  const text = m.text.trim().replace(/\s+/g, ' ');
  const key = L.keyOf(text);
  if (!key) return toast('要填英文字');
  const dup = state.data.words.find((w) => w.id !== f.id && L.keyOf(w.text) === key);
  if (dup) return toast(`單字表裡已經有「${dup.text}」了`);
  const base = f.id ? idx().word[f.id] : { status: 'learning', songId: f.songId };
  const rec = put('words', Object.assign({}, base, { text, kind: L.kindOf(text), zh: m.zh.trim(), kk: m.kk.trim(), note: m.note.trim(), updatedAt: now() }));
  if (f.songId) {
    const mid = meaningId(rec.id, f.songId);
    if (m.meaning.trim()) put('meanings', Object.assign({}, idx().meaning[mid], { id: mid, wordId: rec.id, songId: f.songId, text: m.meaning.trim() }));
    else if (idx().meaning[mid]) del('meanings', mid);
  }
  form = null;
  closeSheet('form');
  render();
  toast(f.id ? '改好了' : '記下來了');
}

function openSongForm(song, workId) {
  form = {
    kind: 'song', id: song ? song.id : '',
    model: song ? { workId: song.workId, title: song.title, lyrics: song.lyrics, translation: song.translation || '' } : { workId, title: '', lyrics: '', translation: '' }
  };
  openSheet('form', songFormHtml);
}

function pairHint(m) {
  const p = L.pairLines(m.lyrics, m.translation);
  if (!p.enCount) return '';
  if (p.mode === 'none') return `英文 ${p.enCount} 行。`;
  if (p.mode === 'pair') return `英文、中文都是 ${p.enCount} 行，可以逐行對照 ✓`;
  return `英文 ${p.enCount} 行、中文 ${p.zhCount} 行，對不上，會分開顯示。要逐行對照，就讓兩邊有字的行數一樣（空行不算）。`;
}

function songFormHtml() {
  const f = form, m = f.model;
  return `
    ${sheetTop(f.id ? '編輯歌曲' : '新增歌曲', '取消', '存起來')}
    <div class="sheet-body">
      <div class="card">
        <div class="field"><label for="f-workId">作品</label><select id="f-workId" data-path="workId">${idx().works.map((w) => `<option value="${w.id}" ${m.workId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="f-title">歌名 <span class="req">*</span></label><input id="f-title" data-path="title" value="${esc(m.title)}" placeholder="歌名" autocomplete="off"></div>
      </div>
      <div class="card"><div class="field col"><label for="f-lyrics">英文歌詞 <span class="req">*</span></label><textarea id="f-lyrics" class="lyrics-in" data-path="lyrics" placeholder="整首貼上，換行和空行會保留" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(m.lyrics)}</textarea></div></div>
      <div class="card"><div class="field col"><div class="label-row"><label for="f-translation">中文翻譯</label><small>選填</small></div><textarea id="f-translation" class="lyrics-in" data-path="translation" placeholder="有找到再貼。每行對應一行英文，就能逐行對照">${esc(m.translation)}</textarea></div>
        <p class="hint" id="pair-hint">${pairHint(m)}</p></div>
      ${f.id ? '<button class="btn danger" data-form-del>刪除這首歌</button>' : ''}
    </div>`;
}

function saveSong() {
  const f = form, m = f.model;
  if (!m.title.trim()) return toast('要填歌名');
  if (!L.splitLines(m.lyrics).length) return toast('要貼上英文歌詞');
  const old = f.id ? idx().song[f.id] : null;
  const siblings = songsOfWork(m.workId);
  const order = old && old.workId === m.workId ? old.order : siblings.reduce((mx, s) => Math.max(mx, Number(s.order) || 0), 0) + 1;
  const rec = put('songs', Object.assign({}, old, { workId: m.workId, title: m.title.trim(), lyrics: m.lyrics, translation: m.translation, order, updatedAt: now() }));
  form = null;
  closeSheet('form');
  toast(old ? '改好了' : '存好了');
  goSong(rec.id);
}

function deleteSong(id) {
  const s = idx().song[id];
  if (!s || !confirm(`刪除「${s.title}」？歌詞會刪掉；記過的字還留在單字表。`)) return false;
  state.data.meanings.filter((m) => m.songId === id).forEach((m) => del('meanings', m.id));
  del('songs', id);
  state.recent = state.recent.filter((x) => x !== id);
  lsSet('recent', JSON.stringify(state.recent));
  state.lib.songId = '';
  toast('刪除了');
  return true;
}

/** 調順序：整串重新編號，有變的才存 */
function move(entity, id, dir) {
  const list = entity === 'works' ? idx().works : songsOfWork(idx().song[id].workId);
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const arr = list.slice();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  arr.forEach((r, k) => { if (Number(r.order) !== k + 1) put(entity, Object.assign({}, r, { order: k + 1 })); });
  render();
}

/* ==========================================================================
   設定
   ========================================================================== */
function settingsSheet() {
  const themes = [['light', '淺色', '#faf7f5'], ['dark', '深色', '#16141b'], ['auto', '自動', 'linear-gradient(90deg,#faf7f5 50%,#16141b 50%)'], ['glow', '粉紫', 'linear-gradient(135deg,#ff8fd0,#7c8cff)'], ['custom', '自訂', bgData ? `url(${bgData.url}) center/cover` : '#3a2457']];
  const custom = state.theme === 'custom';
  const photo = state.theme === 'glow' || custom;
  const d = state.data;
  const slider = (k, label, min, max, val, unit) => `<div class="slider"><div class="lab"><span>${label}</span><span id="sv-${k}">${val}${unit}</span></div><input type="range" min="${min}" max="${max}" value="${val}" data-slider="${k}"></div>`;
  return `
    ${sheetTop('設定', '關閉')}
    <div class="sheet-body">
      <div class="card"><h3>連線（Google 試算表）</h3>
        <div class="field col"><label for="set-url">後端網址</label><input id="set-url" type="url" value="${esc(state.apiUrl)}" placeholder="https://script.google.com/macros/s/…/exec"></div>
        <div class="field col"><label for="set-secret">通關密語</label><input id="set-secret" type="password" value="${esc(state.secret)}" autocomplete="off"></div>
        <button class="btn" data-save-conn style="margin-top:8px">儲存並測試</button>
        <p class="hint" style="margin-top:8px">${state.apiUrl ? (state.sync.error ? '⚠ ' + esc(state.sync.error) : '') : '還沒連線，資料只存在這支手機。'}</p>
      </div>

      <div class="card"><h3>外觀</h3>
        <div class="swatches">${themes.map(([k, l, bg]) => `<button class="sw ${state.theme === k ? 'on' : ''}" data-theme-pick="${k}" style="background:${bg}"><span>${l}</span></button>`).join('')}</div>
        ${photo ? `
          ${custom ? `<input type="file" id="bg-file" accept="image/*" hidden><button class="btn ghost" data-pick-bg style="margin:6px 0 10px">${bgData ? '換一張照片' : '從相簿挑一張照片'}</button>` : ''}
          ${slider('dim', '背景壓暗', 20, 80, Math.round(Math.max(sliderVal('dim', 0.3), 0.2) * 100), '%')}
          ${slider('blur', '背景模糊', 0, 20, sliderVal('blur', 2), 'px')}
          ${custom ? slider('pos', '照片位置', 0, 100, sliderVal('pos', 50), '%') : ''}
          <p class="hint">卡片是玻璃配白字。照片太亮、字不夠清楚，就把「壓暗」拉高。照片只存在這支手機，換手機要重新選。</p>
          ${custom && bgData ? '<button class="btn danger" data-remove-bg>移除自訂背景</button>' : ''}` : ''}
      </div>

      <div class="card"><h3>資料</h3>
        <p class="hint">${d.works.length} 部作品 · ${d.songs.length} 首歌 · ${d.words.length} 個字（${d.words.filter(learning).length} 個在學）</p>
      </div>

      <div class="card"><h3>關於</h3><p class="hint">學詞吧 ${FRONT_VERSION} · 後端 ${esc(state.sync.backend || '—')}</p></div>
    </div>`;
}

/* ==========================================================================
   事件
   ========================================================================== */
document.addEventListener('click', (ev) => {
  /* ----- 小框裡 ----- */
  const inPop = ev.target.closest('#pop');
  if (inPop) {
    const b = ev.target.closest('button');
    if (!b || !pop) return;
    const d = b.dataset, { l, t } = pop;
    if (b.hasAttribute('data-pop-add')) {
      const tok = L.tokenize(curLine(l))[t];
      closePop();
      return openWordForm({ text: L.norm(tok.text).toLowerCase() }, l);
    }
    if (b.hasAttribute('data-pop-phrase')) {
      state.pick = { songId: state.lib.songId, l, t };
      return render();
    }
    if (d.popEdit) { closePop(); return openWordForm(idx().word[d.popEdit], l); }
    if (d.known) { setStatus(d.known, 'known'); return render(); }
    if (d.restore) { setStatus(d.restore, 'learning'); return render(); }
    return;
  }

  /* ----- 點歌詞上的字 ----- */
  const word = ev.target.closest('.ly .w');
  if (word) return tapWord(word);
  if (pop) closePop();

  const t = ev.target.closest('button, [data-song], [data-work], [data-word], [data-goto], [data-rv-flip]');
  if (!t) return;
  const d = t.dataset;
  if (t.disabled) return;

  /* ----- 頂部、分頁 ----- */
  if (d.tab) {
    if (d.tab === state.tab && d.tab === 'lib') state.lib = { workId: '', songId: '' };   // 再點一次歌詞本回到最上層
    state.tab = d.tab; state.pick = null; state.sorting = '';
    return render(true);
  }
  if (t.id === 'btn-back') {
    if (state.lib.songId) state.lib.songId = ''; else state.lib.workId = '';
    state.pick = null; state.sorting = '';
    return render(true);
  }
  if (t.id === 'btn-gear') return openSheet('settings', settingsSheet);
  if (t.hasAttribute('data-pick-cancel')) { state.pick = null; return render(); }

  /* ----- 面板內 ----- */
  const sheetEl = t.closest('.sheet');
  const sheetId = sheetEl ? sheetEl.dataset.sheet : '';
  if (t.hasAttribute('data-close')) {
    if (sheetId === 'form') form = null;
    closeSheet(sheetId);
    return render();
  }
  if (sheetId === 'form') {
    if (t.hasAttribute('data-save')) return form.kind === 'word' ? saveWord() : saveSong();
    if (d.kk) return insertKK(d.kk);
    if (t.hasAttribute('data-form-del')) {
      const ok = form.kind === 'word' ? deleteWord(form.id) : deleteSong(form.id);
      if (!ok) return;
      form = null; closeSheet('form'); closeSheet('word');
      return render(true);
    }
    return;
  }
  if (sheetId === 'settings') return settingsClick(t, d);

  /* ----- 歌詞本 ----- */
  if (d.work) { state.lib = { workId: d.work, songId: '' }; state.sorting = ''; return render(true); }
  if (d.song) return goSong(d.song);
  if (t.hasAttribute('data-add-work')) {
    const name = (prompt('作品名稱（例如音樂劇的劇名）') || '').trim();
    if (!name) return;
    const order = state.data.works.reduce((mx, w) => Math.max(mx, Number(w.order) || 0), 0) + 1;
    const w = put('works', { id: '', name, order });
    state.lib = { workId: w.id, songId: '' };
    return render(true);
  }
  if (t.hasAttribute('data-add-song')) return openSongForm(null, state.lib.workId);
  if (t.hasAttribute('data-edit-song')) return openSongForm(idx().song[state.lib.songId]);
  if (t.hasAttribute('data-rename-work')) {
    const w = idx().work[state.lib.workId];
    const name = (prompt('新的作品名稱', w.name) || '').trim();
    if (name && name !== w.name) put('works', Object.assign({}, w, { name }));
    return render();
  }
  if (t.hasAttribute('data-del-work')) {
    const w = idx().work[state.lib.workId];
    const songs = songsOfWork(w.id);
    if (!confirm(`刪除「${w.name}」${songs.length ? `和底下 ${songs.length} 首歌` : ''}？記過的字還留在單字表。`)) return;
    songs.forEach((s) => {
      state.data.meanings.filter((m) => m.songId === s.id).forEach((m) => del('meanings', m.id));
      del('songs', s.id);
    });
    del('works', w.id);
    state.lib = { workId: '', songId: '' };
    toast('刪除了');
    return render(true);
  }
  if (d.sorting) { state.sorting = state.sorting === d.sorting ? '' : d.sorting; return render(); }
  if (d.move) return move(d.move, d.id, Number(d.dir));
  if (t.hasAttribute('data-toggle-zh')) { state.hideZh = !state.hideZh; lsSet('hideZh', state.hideZh ? '1' : ''); return render(); }
  if (d.fs) {
    state.font = Math.min(FONT_MAX, Math.max(FONT_MIN, state.font + Number(d.fs) * 2));
    lsSet('font', state.font);
    return render();
  }
  if (d.split) { state.splitView = d.split; return render(true); }

  /* ----- 單字表、單字詳細 ----- */
  if (d.wfStatus != null) { state.wf.status = d.wfStatus; return render(); }
  if (d.word) { detailId = d.word; return openSheet('word', wordSheet); }
  if (d.goto) {
    const line = Number(d.line);
    sheets.length = 0;
    goSong(d.goto);
    const el = $(`.ln[data-ln="${line}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1800);
    }
    return;
  }
  if (d.wordEdit) return openWordForm(idx().word[d.wordEdit]);
  if (d.wordDel) { if (deleteWord(d.wordDel)) { closeSheet('word'); render(); } return; }
  if (d.known) { setStatus(d.known, 'known'); return render(); }
  if (d.restore) { setStatus(d.restore, 'learning'); return render(); }

  /* ----- 複習 ----- */
  if (d.rsKind) { state.rs.kind = d.rsKind; return render(); }
  if (t.hasAttribute('data-rv-start')) return startReview(scopeWords().map((w) => w.id));
  if (t.hasAttribute('data-rv-flip')) { state.review.flipped = !state.review.flipped; return render(); }
  if (d.rv) {
    const r = state.review;
    r[d.rv].push(r.ids[r.i]);
    r.i++; r.flipped = false;
    return render(true);
  }
  if (t.hasAttribute('data-rv-known')) {
    const r = state.review;
    setStatus(r.ids[r.i], 'known');
    r.ok.push(r.ids[r.i]);
    r.i++; r.flipped = false;
    return render(true);
  }
  if (t.hasAttribute('data-rv-end')) { const r = state.review; r.ids = r.ids.slice(0, r.i); return render(true); }
  if (d.rvAgain) {
    const r = state.review;
    const ids = d.rvAgain === 'no' ? r.no : r.ids;
    return startReview(ids.filter((id) => idx().word[id] && learning(idx().word[id])));
  }
  if (t.hasAttribute('data-rv-reset')) { state.review = null; return render(true); }
});

function settingsClick(t, d) {
  if (d.themePick) {
    state.theme = d.themePick; lsSet('theme', d.themePick);
    applyTheme(); return refreshSheets();
  }
  if (t.hasAttribute('data-pick-bg')) return $('#bg-file').click();
  if (t.hasAttribute('data-remove-bg')) {
    bgSet(null); bgData = null; state.theme = 'light'; lsSet('theme', 'light');
    applyTheme(); return refreshSheets();
  }
  if (t.hasAttribute('data-save-conn')) {
    state.apiUrl = $('#set-url').value.trim(); state.secret = $('#set-secret').value.trim();
    lsSet('api', state.apiUrl); lsSet('secret', state.secret);
    if (!state.apiUrl) { setSync('idle'); return toast('已清除連線設定'); }
    toast('連線中…');
    return pull().then(() => { refreshSheets(); if (state.sync.status === 'ok') toast('已同步'); });
  }
}

/** KK 音標的符號鍵：插在游標位置，鍵盤不收起來 */
function insertKK(ch) {
  const inp = $('#f-kk');
  if (!inp) return;
  const s = kkCaret == null ? inp.value.length : kkCaret;
  inp.value = inp.value.slice(0, s) + ch + inp.value.slice(s);
  kkCaret = s + ch.length;
  form.model.kk = inp.value;
  inp.focus();
  try { inp.setSelectionRange(kkCaret, kkCaret); } catch (e) { /* 不支援就算了 */ }
}
// 按符號鍵時不要讓輸入框失去焦點
document.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.kkkeys button')) ev.preventDefault(); });
['input', 'keyup', 'click', 'focus', 'select'].forEach((type) => document.addEventListener(type, (ev) => {
  if (ev.target && ev.target.id === 'f-kk') kkCaret = ev.target.selectionStart;
}, true));

/* ---------- 輸入欄位 ---------- */
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'wf-q') {
    state.wf.q = el.value;
    // 注音、拼音選字中不要重畫，不然字會打不出來
    if (!ev.isComposing) $('#wl').innerHTML = wordListHtml();
    return;
  }
  if (el.dataset.slider) {
    const k = el.dataset.slider, v = Number(el.value);
    lsSet(k, k === 'dim' ? v / 100 : v);
    $('#sv-' + k).textContent = v + (k === 'blur' ? 'px' : '%');
    return applyTheme();
  }
  if (el.dataset.path && form) {
    form.model[el.dataset.path] = el.value;
    if (form.kind === 'song' && (el.dataset.path === 'lyrics' || el.dataset.path === 'translation')) $('#pair-hint').textContent = pairHint(form.model);
  }
});
document.addEventListener('compositionend', (ev) => {
  if (ev.target.id === 'wf-q') { state.wf.q = ev.target.value; $('#wl').innerHTML = wordListHtml(); }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'bg-file' && el.files[0]) {
    importBackground(el.files[0]).then(refreshSheets).catch(() => toast('這張照片讀不出來，換一張試試'));
    return;
  }
  if (el.dataset.wf) { state.wf[el.dataset.wf] = el.value; return render(); }
  if (el.dataset.rs) {
    state.rs[el.dataset.rs] = el.value;
    if (el.dataset.rs === 'workId') state.rs.songId = '';
    return render();
  }
  if (el.dataset.path && form) form.model[el.dataset.path] = el.value;
});

// 捲動或轉向時小框會跟字分開，直接關掉。
// 點字時畫面可能還在慣性滑一點點，捲超過一小段才算
$('#view').addEventListener('scroll', (ev) => { if (pop && Math.abs(ev.target.scrollTop - pop.top) > 12) closePop(); }, { passive: true });
window.addEventListener('resize', () => { if (pop) closePop(); });

/* ==========================================================================
   啟動
   ========================================================================== */
window.addEventListener('online', () => { flush(); });
window.addEventListener('offline', renderSync);

/** 開發用：網址加 ?seed=local，就把 www/_local-seed.json 灌進本機資料（只存手機本機，不送後端）。
    那個檔案被 .gitignore 擋掉，不會進 repo；檔案不存在就什麼都不做。 */
async function loadLocalSeed() {
  if (new URLSearchParams(location.search).get('seed') !== 'local') return;
  try {
    const res = await fetch('_local-seed.json', { cache: 'no-store' });
    if (!res.ok) return;
    const seed = await res.json();
    ENTITIES.forEach((e) => { state.data[e] = seed[e] || []; });
    state.outbox = [];
    saveLocal();
    history.replaceState(null, '', location.pathname);
  } catch (e) { /* 沒有檔案或格式不對，照常啟動 */ }
}

async function boot() {
  await loadLocalSeed();
  const saved = await bgGet();
  if (saved) bgData = saved;
  if (state.theme === 'custom' && !bgData) state.theme = 'glow';
  applyTheme();
  render();
  if (state.apiUrl) pull();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();

// 給 scripts 測試用
window.__xc = { state, render, put, openSheet, applyTheme };
})();
