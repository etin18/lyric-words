/**
 * 用 Playwright 開 App、灌入示範資料、走完主要流程並截圖，同時收集 console 錯誤。
 * 最後產生 shots/index.html，一頁看完所有截圖。
 * 先 `python3 scripts/serve.py 8791`，再
 *   PW_CORE=<playwright-core 路徑> node scripts/screenshot.js
 * 資料全是虛構的（scripts/seed-demo.js），repo 是公開的。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(process.env.PW_CORE);
const SEED = require('./seed-demo.js');

const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8791';

function findChromium() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium'))
    .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()));
  for (const d of dirs) for (const rel of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
    const full = path.join(base, d, rel); if (fs.existsSync(full)) return full;
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());

  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('xc.data', JSON.stringify(seed));
    localStorage.setItem('xc.theme', 'light');
  }, SEED);
  await page.goto(BASE);
  await page.waitForSelector('#view .card');

  const shots = [];
  const shot = async (name, note) => {
    await page.waitForTimeout(120);
    const file = `${String(shots.length + 1).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    shots.push({ file, name, note });
  };
  const word = (text, nth) => page.locator('.ly .w').filter({ hasText: new RegExp(`^${text}$`) }).nth(nth || 0);

  await shot('作品列表', '歌詞本首頁：作品、幾首歌、幾個字在學');
  await page.click('[data-work="wA"]');
  await shot('作品頁', '作品裡的歌曲');
  await page.click('[data-song="s1"]');
  await shot('歌詞頁', '逐行對照。實線＝記過的單字，虛線＝片語');

  await word('yearn').click();
  await shot('點記過的單字', '小框顯示筆記，可以編輯或標成已經會了');
  await word('tide').click();
  await shot('點有這首歌意思的字', '「在這首歌」的意思另外顯示');
  await word('Hold').click();
  await shot('點片語裡的字', '片語 hold on 的筆記');
  await word('lantern').click();
  await shot('點已經會了的字', '沒有畫線，但點了還是看得到筆記，可以恢復');
  await word('harbor').click();
  await shot('點沒記過的字', '可以記這個字，或從這裡選片語');

  await page.click('[data-pop-phrase]');
  await shot('選片語', '下面出現提示，點片語最後一個字');
  await word('wakes').click();
  await shot('記片語', '片語表單，上面是那一行歌詞');
  await page.click('.sheet [data-close]');

  await word('harbor').click();
  await page.click('[data-pop-add]');
  await page.fill('#f-zh', '港口');
  await page.click('#f-kk');
  for (const k of ['[', 'ˋ', 'h', 'ɑ', 'r', 'b', 'ɚ', ']']) {
    if (/^[a-z]$/.test(k)) await page.keyboard.type(k); else await page.click(`.kkkeys [data-kk="${k}"]`);
  }
  await page.fill('#f-meaning', '這首歌的場景');
  await shot('記單字', 'KK 音標下面有符號鍵，不用切鍵盤');
  await page.click('.sheet [data-save]');
  await shot('記好之後', 'harbor 畫上線了');

  await page.click('[data-toggle-zh]');
  await shot('隱藏中文', '先自己讀英文');
  await page.click('[data-toggle-zh]');
  await page.click('[data-fs="1"]');
  await page.click('[data-fs="1"]');
  await page.evaluate(() => { document.querySelector('#view').scrollTop = 99999; });
  await shot('字放大＋上下首', 'A+ 放大字；最下面可以切到上一首、下一首');
  await page.click('[data-fs="-1"]');
  await page.click('[data-fs="-1"]');

  await page.click('[data-song="s2"]');
  await shot('沒有翻譯的歌', '只有英文');
  await page.click('[data-song="s3"]');
  await shot('行數對不上', '翻譯少一行：分開顯示，並說明原因');
  await page.click('[data-split="zh"]');
  await shot('行數對不上-看中文', '');
  await page.click('[data-edit-song]');
  await shot('編輯歌曲', '下面會即時算行數對不對得上');
  await page.click('.sheet [data-close]');

  await page.click('[data-tab="words"]');
  await shot('單字表', '搜尋、學習中／已會、種類、作品、排序');
  await page.click('[data-word="k2"]');
  await shot('單字詳細', '各首歌的意思、出現在哪幾首歌的哪一行');
  await page.locator('.occ').nth(1).click();
  await page.waitForTimeout(300);
  await shot('跳到那一行', '從單字表點一行歌詞，直接跳過去並閃一下');

  await page.click('[data-tab="words"]');
  await page.click('[data-wf-status="known"]');
  await shot('單字表-已會', '已會的字還在，點進去可以恢復');

  await page.click('[data-tab="review"]');
  await shot('複習-選範圍', '全部、選作品、選歌曲');
  await page.click('[data-rv-start]');
  await shot('複習-正面', '英文＋出處那行歌詞當提示');
  await page.click('[data-rv-flip]');
  await shot('複習-翻面', '中文、音標、這首歌的意思、備註');
  let k = 0;
  while (await page.locator('[data-rv-flip]').count()) {
    if (!(await page.locator('[data-rv]').count())) await page.click('[data-rv-flip]');
    await page.click(`[data-rv="${k++ % 3 === 0 ? 'no' : 'ok'}"]`);
  }
  await shot('複習-一輪結束', '還不熟的可以再練一輪');

  await page.click('#btn-gear');
  await shot('設定', '連線、外觀（沿用追星記帳本）');
  await page.click('.sheet [data-close]');

  for (const [theme, label] of [['dark', '深色'], ['glow', '粉紫']]) {
    await page.evaluate((th) => { localStorage.setItem('xc.theme', th); window.__xc.state.theme = th; window.__xc.applyTheme(); }, theme);
    await page.click('[data-tab="lib"]');
    await page.click('[data-tab="lib"]');
    await page.click('[data-song="s1"]');
    await word('yearn').click();
    await shot(`${label}-歌詞`, '');
  }

  await browser.close();

  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>學詞吧 截圖</title>
<style>body{font-family:-apple-system,"PingFang TC",sans-serif;margin:0;padding:20px;background:#f3eff2;color:#2a2430}
h1{font-size:20px;margin:0 0 4px}p.sub{margin:0 0 18px;color:#7d7485;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}
figure{margin:0}img{width:100%;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.12);display:block;background:#fff}
figcaption{font-size:13px;margin-top:8px;line-height:1.5}figcaption b{display:block;font-size:14px}</style></head>
<body><h1>學詞吧 第一版截圖</h1><p class="sub">${new Date().toLocaleString('zh-TW')} · 手機寬 390px · 歌詞都是自己編的示範內容</p><div class="grid">
${shots.map((s) => `<figure><img src="${s.file}" loading="lazy"><figcaption><b>${s.name}</b>${s.note}</figcaption></figure>`).join('\n')}
</div></body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`${shots.length} 張截圖 → shots/index.html`);
  console.log(errors.length ? `console 錯誤：\n${errors.join('\n')}` : '沒有 console 錯誤');
})().catch((e) => { console.error(e); process.exit(1); });
