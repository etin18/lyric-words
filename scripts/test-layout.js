/**
 * 版面小細節檢查：每個主題 × 每一頁（含設定、表單、小框、詳細、複習）× 三種手機寬度，
 * 找「東西跑出去」這類問題。先 `python3 scripts/serve.py 8791`，再
 *   PW_CORE=<playwright-core 路徑> node scripts/test-layout.js
 *
 * 檢查什麼：
 *   1. 整頁或面板可以左右滑（scrollWidth > clientWidth）
 *   2. 有元素的右緣超出畫面
 *   3. 列表那一列的文字被擠到幾乎看不見（.main 太窄）
 *   4. 圓形按鈕裡的圖示沒置中
 *   5. 小框超出畫面
 * 資料故意灌得很長（長作品名、長歌名、超長的一行歌詞、長單字）。全部是虛構的。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(process.env.PW_CORE);
const BASE = process.env.BASE || 'http://localhost:8791';
const DEMO = require('./seed-demo.js');

function findChromium() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium'))
    .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()));
  for (const d of dirs) for (const rel of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
    const full = path.join(base, d, rel); if (fs.existsSync(full)) return full;
  }
}

const LONG = 'Supercalifragilisticexpialidociously Extraordinary Lantern Road Revival';
const LONG_LINE = 'Antidisestablishmentarianism-and-everything-else-we-sang-about-without-a-single-space-to-break-the-line';
const SEED = JSON.parse(JSON.stringify(DEMO));
SEED.works[0].name = LONG + ' 超長的虛構作品名稱';
SEED.songs[0].title = LONG + ' (Reprise) 超長歌名';
SEED.songs[0].lyrics = SEED.songs[0].lyrics.replace('The harbor wakes before the sun,', `The harbor wakes ${LONG_LINE} before the sun,`);
SEED.words.push({ id: 'kL', text: 'antidisestablishmentarianism', kind: 'word', zh: '超長中文解釋'.repeat(8), kk: '[ˏæntɪˏdɪsəˋstæblɪʃməntˋɛrɪənɪzəm]', note: '很長的備註'.repeat(20), status: 'learning', songId: 's1', createdAt: '2026-10-02T00:00:00Z' });
SEED.meanings.push({ id: 'kL__s1', wordId: 'kL', songId: 's1', text: '這首歌裡的意思'.repeat(10) });

const THEMES = ['light', 'dark', 'glow', 'custom'];
const WIDTHS = [320, 360, 390];

/** 在頁面裡跑的檢查，回傳問題清單 */
function scan() {
  const problems = [];
  const vw = document.documentElement.clientWidth;
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' 「' + (el.innerText || '').trim().slice(0, 20).replace(/\n/g, ' ') + '」';
  for (const el of [document.documentElement, document.body, document.querySelector('#view'), ...document.querySelectorAll('.sheet-body')]) {
    if (el && el.scrollWidth > el.clientWidth + 1) problems.push(`可以左右滑：${label(el)}（${el.scrollWidth} > ${el.clientWidth}）`);
  }
  for (const el of document.querySelectorAll('#view *, .sheet *, #pop, #pop *, #pickbar *, .top *')) {
    let ellipsed = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).textOverflow === 'ellipsis') { ellipsed = true; break; }
    }
    if (ellipsed) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1) problems.push(`超出右緣：${label(el)}（right ${Math.round(r.right)} > ${vw}）`);
    if (r.width && r.left < -1) problems.push(`超出左緣：${label(el)}（left ${Math.round(r.left)}）`);
  }
  const pop = document.querySelector('#pop:not([hidden])');
  if (pop) {
    const r = pop.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight + 1) problems.push(`小框超出上下：top ${Math.round(r.top)} bottom ${Math.round(r.bottom)}`);
  }
  for (const el of document.querySelectorAll('.item .main')) {
    if (el.getBoundingClientRect().width < 60) problems.push(`文字被擠到只剩 ${Math.round(el.getBoundingClientRect().width)}px：${label(el)}`);
  }
  for (const el of document.querySelectorAll('.ico, .tbtn, .mv button')) {
    const svg = el.querySelector('svg');
    if (!svg || !el.getBoundingClientRect().width) continue;
    const r = el.getBoundingClientRect(), s = svg.getBoundingClientRect();
    if (Math.abs((s.left + s.width / 2) - (r.left + r.width / 2)) > 1 || Math.abs((s.top + s.height / 2) - (r.top + r.height / 2)) > 1) problems.push(`圖示沒置中：${label(el)}`);
  }
  return problems;
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  let total = 0, bad = 0;
  const report = [];
  const errors = [];

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 700 } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`[${theme} ${width}px] ${e}`));
      page.on('dialog', (d) => d.accept());
      await page.addInitScript(([seed, th]) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.clear();
        localStorage.setItem('xc.data', JSON.stringify(seed));
        localStorage.setItem('xc.theme', th);
        localStorage.setItem('xc.recent', JSON.stringify(['s1', 's2']));
      }, [SEED, theme]);
      await page.goto(BASE);
      await page.waitForSelector('#view .card');
      if (theme === 'custom') {
        // 自訂背景：畫一張亮色漸層當照片存進 IndexedDB，再重開
        await page.evaluate(async () => {
          const c = document.createElement('canvas'); c.width = 400; c.height = 800;
          const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 400, 800);
          gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#9ad7ff'); g.fillStyle = gr; g.fillRect(0, 0, 400, 800);
          const url = c.toDataURL('image/jpeg', 0.8);
          await new Promise((res) => { const r = indexedDB.open('xc-bg', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ url, lum: 0.9 }, 'bg'); tx.oncomplete = res; }; });
        });
        await page.reload();
        await page.waitForSelector('#view .card');
      }
      const w = (text) => page.locator('.ly .w').filter({ hasText: new RegExp(`^${text}$`) }).first();

      const pages = [
        ['作品列表', async () => {}],
        ['作品排序', async () => { await page.click('[data-sorting="works"]'); }],
        ['作品頁', async () => { await page.click('[data-sorting="works"]'); await page.click('[data-work="wA"]'); }],
        ['歌曲排序', async () => { await page.click('[data-sorting="wA"]'); }],
        ['歌詞頁（長行、長歌名）', async () => { await page.click('[data-sorting="wA"]'); await page.click('[data-song="s1"]'); }],
        ['小框-長單字', async () => { await w('Antidisestablishmentarianism').click(); }],
        ['小框-片語', async () => { await page.click('#title'); await w('Hold').click(); }],
        ['小框-最下面的字', async () => { await page.click('#title'); await page.evaluate(() => { document.querySelector('#view').scrollTop = 99999; }); await w('long').click(); }],
        ['選片語', async () => { await page.click('[data-pop-phrase]'); }],
        ['記片語表單', async () => { await w('long').last().click(); }],
        ['字最大', async () => { await page.click('.sheet [data-close]'); for (let i = 0; i < 5; i++) await page.click('[data-fs="1"]'); }],
        ['行數對不上', async () => { for (let i = 0; i < 5; i++) await page.click('[data-fs="-1"]'); await page.click('[data-tab="lib"]'); await page.click('[data-tab="lib"]'); await page.click('[data-work="wA"]'); await page.click('[data-song="s3"]'); }],
        ['編輯歌曲', async () => { await page.click('[data-edit-song]'); }],
        ['編輯長單字', async () => { await page.click('.sheet [data-close]'); await page.click('[data-tab="words"]'); await page.click('[data-word="kL"]'); await page.click('[data-word-edit="kL"]'); }],
        ['單字詳細（長）', async () => { await page.click('.sheet[data-sheet="form"] [data-close]'); }],
        ['單字表', async () => { await page.click('.sheet [data-close]'); }],
        ['複習範圍-選歌曲', async () => { await page.click('[data-tab="review"]'); await page.click('[data-rs-kind="song"]'); }],
        ['複習卡-翻面', async () => { await page.click('[data-rs-kind="all"]'); await page.click('[data-rv-start]'); await page.click('[data-rv-flip]'); }],
        ['複習結束', async () => { await page.click('[data-rv-end]'); }],
        ['設定', async () => { await page.click('#btn-gear'); }],
        ['空的歌詞本', async () => { await page.click('.sheet [data-close]'); await page.evaluate(() => { const s = window.__xc.state; ['works', 'songs', 'words', 'meanings'].forEach((e) => { s.data[e] = []; }); s.tab = 'lib'; s.lib = { workId: '', songId: '' }; s.review = null; window.__xc.render(); }); }]
      ];

      for (const [name, go] of pages) {
        try { await go(); } catch (e) { report.push(`[${theme} ${width}px] ${name}：走不到這一頁（${e.message.split('\n')[0]}）`); bad++; total++; continue; }
        await page.waitForTimeout(60);
        const problems = await page.evaluate(scan);
        total++;
        if (problems.length) { bad++; problems.slice(0, 6).forEach((p) => report.push(`[${theme} ${width}px] ${name}：${p}`)); }
      }
      await ctx.close();
    }
  }

  await browser.close();
  console.log(report.length ? report.join('\n') : '沒有發現問題');
  if (errors.length) console.log('\n頁面錯誤：\n' + errors.join('\n'));
  console.log(`\n${total - bad}/${total} 個畫面通過（${THEMES.length} 主題 × ${WIDTHS.length} 寬度）`);
  process.exit(bad || errors.length ? 1 : 0);
})();
