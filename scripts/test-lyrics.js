/**
 * 歌詞比對規則的測試（不用瀏覽器）：node scripts/test-lyrics.js
 * 歌詞都是自己編的。
 */
const L = require('../www/lyrics.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  console.log(`✗ ${name}\n    得到 ${g}\n    應該 ${w}`);
}
const keys = (line) => L.tokenize(line).map((t) => t.key);

/* ---------- 斷字 ---------- */
eq('一般斷字', keys('The harbor wakes, before the sun!'), ['the', 'harbor', 'wakes', 'before', 'the', 'sun']);
eq('中間的撇號算同一個字', keys("Don't you know I'm here"), ["don't", 'you', 'know', "i'm", 'here']);
eq('彎撇號當成直撇號', keys('Don’t stop'), ["don't", 'stop']);
eq("結尾 in' 算進來", keys("I was dreamin' of you"), ['i', 'was', "dreamin'", 'of', 'you']);
eq('引號包住的字不吃到引號', keys("She said 'hello' twice"), ['she', 'said', 'hello', 'twice']);
eq('開頭的撇號不算', keys("'Cause I said so"), ['cause', 'i', 'said', 'so']);
eq('連字號把字切開', keys('heart-broken'), ['heart', 'broken']);
eq('重音字母', keys('a café so naïve'), ['a', 'café', 'so', 'naïve']);
eq('原文位置正確', L.tokenize('  Hold on,').map((t) => [t.text, t.start, t.end]), [['Hold', 2, 6], ['on', 7, 9]]);
eq('原文保留彎撇號', L.tokenize('Don’t').map((t) => t.text), ['Don’t']);
eq('數字和中文不算字', keys('24601 號 here'), ['here']);

/* ---------- key、種類 ---------- */
eq('片語 key 不管大小寫與標點', L.keyOf('Hold  On,'), 'hold on');
eq('單字種類', L.kindOf('yearn'), 'word');
eq('片語種類', L.kindOf('fade away'), 'phrase');

/* ---------- 分行 ---------- */
eq('分行：頭尾空行拿掉、連續空行併一行、行尾空白去掉', L.splitLines('\n\nA  \r\nB\n\n\n\nC\n\n'), ['A', 'B', '', 'C']);

/* ---------- 逐行對照 ---------- */
const EN = 'Line one\nLine two\n\nLine three';
eq('沒有翻譯', L.pairLines(EN, '').mode, 'none');
eq('行數對得上（翻譯沒分段也行）', L.pairLines(EN, '一\n二\n三').rows.map((r) => r.zh), ['一', '二', '', '三']);
eq('翻譯有分段也行', L.pairLines(EN, '一\n\n二\n三').mode, 'pair');
eq('行數對不上就分開', L.pairLines(EN, '一\n二').mode, 'split');
eq('分開時算出行數', [L.pairLines(EN, '一\n二').enCount, L.pairLines(EN, '一\n二').zhCount], [3, 2]);

/* ---------- 比對 ---------- */
const words = [
  { id: 'w1', text: 'yearn' },
  { id: 'w2', text: 'hold on' },
  { id: 'w3', text: 'Tide' },
  { id: 'w4', text: "dreamin'" },
  { id: 'w5', text: 'on' }
];
const dict = L.makeDict(words);
const m1 = L.markLine('I YEARN for more, hold on, Hold On!', dict);
eq('單字不分大小寫', m1.tokens[1].word && m1.tokens[1].word.id, 'w1');
eq('變化形不算', L.markLine('she yearns', dict).tokens[1].word, null);
eq('片語出現兩次', m1.occs.map((o) => [o.word.id, o.s, o.e]), [['w2', 4, 5], ['w2', 6, 7]]);
eq('字同時在片語裡：兩個都有', [m1.tokens[5].word && m1.tokens[5].word.id, m1.tokens[5].phrases.length], ['w5', 1]);
eq('片語中間的標點不影響', L.markLine('hold, on', dict).occs.length, 1);
eq('片語不能缺字', L.markLine('hold me on', dict).occs.length, 0);
eq('片語在行尾被切掉不算', L.markLine('I said hold', dict).occs.length, 0);
eq("in' 的字要一模一樣", [L.markLine("dreamin' away", dict).tokens[0].word && 'hit', L.markLine('dreaming away', dict).tokens[0].word], ['hit', null]);
eq('記的時候大寫也比得到', L.markLine('the tide will turn', dict).tokens[1].word.id, 'w3');

/* ---------- 小標（誰在唱） ---------- */
eq('整行方括號是小標', ['[MIRA]', ' [MIRA, spoken] ', '[Chorus]', 'I [said] so', '[MIRA] hello', ''].map(L.isLabel), [true, true, true, false, false, false]);
const WITH_LABELS = '[MIRA]\nline one\nline two\n\n[TOMAS & MIRA]\nline three';
eq('小標不算行數', L.pairLines(WITH_LABELS, '一\n二\n三').mode, 'pair');
eq('小標那行沒有翻譯', L.pairLines(WITH_LABELS, '一\n二\n三').rows.map((r) => r.zh), ['', '一', '二', '', '', '三']);
eq('翻譯也有小標照樣對得上', L.pairLines(WITH_LABELS, '[米拉]\n一\n二\n三').rows.map((r) => r.zh), ['', '一', '二', '', '', '三']);
eq('小標裡的字不算出現過', L.buildIndex([{ id: 'x', lyrics: '[MIRA]\nMira sings' }], [{ id: 'm', text: 'mira', kind: 'word' }]).occ.get('m').map((o) => o.line), [1]);

/* ---------- 索引 ---------- */
const songs = [
  { id: 's1', lyrics: 'I yearn\nI yearn again, I yearn\n\nhold on' },
  { id: 's2', lyrics: 'Hold on, the tide' },
  { id: 's3', lyrics: 'nothing here' }
];
const ix = L.buildIndex(songs, words);
eq('同一行出現兩次只記一次', ix.occ.get('w1').map((o) => [o.songId, o.line]), [['s1', 0], ['s1', 1]]);
eq('片語跨歌曲', ix.occ.get('w2').map((o) => [o.songId, o.line]), [['s1', 3], ['s2', 0]]);
eq('每首歌有哪些字', [...ix.songWords.get('s2')].sort(), ['w2', 'w3', 'w5']);
eq('沒有記過的字的歌', ix.songWords.get('s3').size, 0);

console.log(`\n${pass} 個通過${fail ? `，${fail} 個失敗` : ''}`);
process.exit(fail ? 1 : 0);
