/* ==========================================================================
   學詞吧 — 歌詞處理：斷字、比對記過的字、英文與翻譯逐行對照
   不碰畫面，Node 也能跑（scripts/test-lyrics.js）。
   ========================================================================== */
(function (root) {
'use strict';

const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ';
const IS_LETTER = new RegExp(`[${LETTER}]`);
const WORD_RE = new RegExp(`[${LETTER}]+(?:'[${LETTER}]+)*`, 'g');

/** 彎撇號、反引號都當成直撇號。一個字元換一個字元，所以位置不會跑掉 */
const norm = (s) => String(s == null ? '' : s).replace(/[’‘ʼ´`]/g, "'");

/**
 * 一行拆成字：英文字母，中間可以有撇號（don't、I'm）；
 * 結尾是 in' 的也算進來（dreamin'、nothin'）。連字號、空白、標點都會把字切開。
 * 回傳 [{ text 原文, start, end, key 比對用（小寫） }]
 */
function tokenize(line) {
  const raw = String(line == null ? '' : line);
  const s = norm(raw);
  const out = [];
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(s))) {
    let end = m.index + m[0].length;
    if (/in$/i.test(m[0]) && s[end] === "'" && !IS_LETTER.test(s[end + 1] || '')) {
      end++;
      WORD_RE.lastIndex = end;
    }
    out.push({ text: raw.slice(m.index, end), start: m.index, end, key: s.slice(m.index, end).toLowerCase() });
  }
  return out;
}

/** 比對用的鑰匙：單字是小寫本身，片語是各字小寫用一個空白接起來（標點、多餘空白不算） */
const keyOf = (text) => tokenize(text).map((t) => t.key).join(' ');
const kindOf = (text) => (tokenize(text).length > 1 ? 'phrase' : 'word');

/** 整首歌拆成行：統一換行、去掉行尾空白、頭尾空行拿掉、連續空行併成一行 */
function splitLines(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  const out = [];
  lines.forEach((l) => {
    if (!l && (!out.length || !out[out.length - 1])) return;
    out.push(l);
  });
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

/**
 * 英文與中文翻譯配對。空行不算行數（翻譯常常沒有分段）。
 *   none：沒有翻譯
 *   pair：有字的行數一樣，逐行對照；rows[i].zh 是第 i 行英文的翻譯
 *   split：行數對不上，分開顯示
 * 英文的行號一律是 splitLines(lyrics) 的位置，三種模式都一樣，跳到某一行時才找得到。
 */
function pairLines(lyrics, translation) {
  const en = splitLines(lyrics);
  const zhAll = splitLines(translation);
  const zh = zhAll.filter((l) => l.trim());
  const enCount = en.filter((l) => l.trim()).length;
  if (!zh.length) return { mode: 'none', rows: en.map((l) => ({ en: l, zh: '' })), en, zh: [], enCount, zhCount: 0 };
  if (zh.length !== enCount) return { mode: 'split', rows: en.map((l) => ({ en: l, zh: '' })), en, zh: zhAll, enCount, zhCount: zh.length };
  let k = 0;
  return { mode: 'pair', rows: en.map((l) => ({ en: l, zh: l.trim() ? zh[k++] : '' })), en, zh: zhAll, enCount, zhCount: zh.length };
}

/** 單字表整理成查表用的形狀：單字用 key 查，片語用第一個字查 */
function makeDict(words) {
  const byKey = new Map();
  const byFirst = new Map();
  (words || []).forEach((w) => {
    const keys = tokenize(w.text).map((t) => t.key);
    if (!keys.length) return;
    if (keys.length === 1) {
      if (!byKey.has(keys[0])) byKey.set(keys[0], w);
      return;
    }
    if (!byFirst.has(keys[0])) byFirst.set(keys[0], []);
    byFirst.get(keys[0]).push({ word: w, keys });
  });
  return { byKey, byFirst };
}

/**
 * 找出一行裡哪些字、哪些片語記過（不管學習中或已會，畫面自己決定要不要標）。
 * tokens[i].word：這個字本身的筆記；tokens[i].phrases：蓋到這個字的片語
 * occs：片語出現的位置 [{ word, s, e }]（s、e 是 tokens 的位置，含頭含尾）
 */
function markLine(line, dict) {
  const tokens = tokenize(line);
  const occs = [];
  tokens.forEach((t, i) => {
    t.word = dict.byKey.get(t.key) || null;
    t.phrases = [];
    const cands = dict.byFirst.get(t.key);
    if (!cands) return;
    cands.forEach((p) => {
      if (i + p.keys.length > tokens.length) return;
      for (let k = 1; k < p.keys.length; k++) if (tokens[i + k].key !== p.keys[k]) return;
      occs.push({ word: p.word, s: i, e: i + p.keys.length - 1 });
    });
  });
  occs.forEach((o) => { for (let k = o.s; k <= o.e; k++) tokens[k].phrases.push(o); });
  return { tokens, occs };
}

/**
 * 掃過所有歌詞：每個字出現在哪幾首歌的哪一行、每首歌有哪些記過的字。
 * occ：wordId → [{ songId, line, text }]（同一行出現兩次只記一次）
 * songWords：songId → Set(wordId)
 */
function buildIndex(songs, words) {
  const dict = makeDict(words);
  const occ = new Map();
  const songWords = new Map();
  (songs || []).forEach((song) => {
    const set = new Set();
    songWords.set(song.id, set);
    splitLines(song.lyrics).forEach((line, l) => {
      if (!line.trim()) return;
      const { tokens, occs } = markLine(line, dict);
      const add = (w) => {
        set.add(w.id);
        if (!occ.has(w.id)) occ.set(w.id, []);
        const list = occ.get(w.id);
        const last = list[list.length - 1];
        if (!last || last.songId !== song.id || last.line !== l) list.push({ songId: song.id, line: l, text: line });
      };
      tokens.forEach((t) => { if (t.word) add(t.word); });
      occs.forEach((o) => add(o.word));
    });
  });
  return { dict, occ, songWords };
}

const Lyrics = { norm, tokenize, keyOf, kindOf, splitLines, pairLines, makeDict, markLine, buildIndex };
if (typeof module !== 'undefined' && module.exports) module.exports = Lyrics;
else root.Lyrics = Lyrics;
})(typeof window !== 'undefined' ? window : globalThis);
