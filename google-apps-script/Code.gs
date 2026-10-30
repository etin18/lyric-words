/**
 * 學詞吧 — 音樂劇歌詞本 後端 API（Google Apps Script）
 *
 * 部署方式：
 *   1. 開啟目標 Google 試算表 → 擴充功能 → Apps Script
 *   2. 把本檔內容整份貼上，存檔
 *   3. 部署 → 新增部署作業 → 類型選「網頁應用程式」
 *      - 執行身分：我
 *      - 具有存取權的使用者：任何人
 *   4. 複製產生的網址（結尾是 /exec），貼進 App 的「設定」
 *
 * 分頁會在第一次呼叫時自動建立：作品、歌曲、單字、歌曲裡的意思
 *
 * ★★ 通關密語 ★★
 *   把下面的 SECRET 改成你自己的一組密語，再到 App 設定填入「同一組」。
 *   ⚠️ 改好密語的版本只貼在自己的 Apps Script 編輯器裡，
 *      不要貼回 GitHub 或任何公開的地方。
 *   （SECRET 留空字串代表不驗證，僅供測試。）
 */

var SECRET = '';   // ← 改成你自己的通關密語

/** 後端版本。App 設定頁會跟自己的版本並排顯示，用來確認有沒有真的重新部署。 */
var API_VERSION = 'v1';

/* ==========================================================================
   資料表定義：欄位順序＝試算表欄位順序
   type：text 文字／number 數字
   long：內容很長（整首歌詞），格子不自動換行，免得一列撐得超高
   ========================================================================== */

var SHEETS = {
  works: {
    sheetName: '作品',
    fields: [
      { key: 'id', header: 'id', type: 'text', width: 250 },
      { key: 'name', header: '名稱', type: 'text', width: 200 },
      { key: 'order', header: '排序', type: 'number' },
      { key: 'createdAt', header: '建立時間', type: 'text' }
    ]
  },
  songs: {
    sheetName: '歌曲',
    fields: [
      { key: 'id', header: 'id', type: 'text', width: 250 },
      { key: 'workId', header: '作品id', type: 'text', width: 250 },
      { key: 'title', header: '歌名', type: 'text', width: 200 },
      { key: 'order', header: '排序', type: 'number' },
      { key: 'lyrics', header: '英文歌詞', type: 'text', width: 320, long: true },
      { key: 'translation', header: '中文翻譯', type: 'text', width: 320, long: true },
      { key: 'createdAt', header: '建立時間', type: 'text' },
      { key: 'updatedAt', header: '更新時間', type: 'text' }
    ]
  },
  words: {
    sheetName: '單字',
    fields: [
      { key: 'id', header: 'id', type: 'text', width: 250 },
      { key: 'text', header: '字', type: 'text', width: 160 },
      // word 單字／phrase 片語
      { key: 'kind', header: '類型', type: 'text' },
      { key: 'zh', header: '中文', type: 'text', width: 200 },
      { key: 'kk', header: 'KK音標', type: 'text', width: 140 },
      { key: 'note', header: '備註', type: 'text', width: 240 },
      // learning 學習中／known 已會
      { key: 'status', header: '狀態', type: 'text' },
      // 第一次記錄時所在的歌
      { key: 'songId', header: '首次出處id', type: 'text', width: 250 },
      { key: 'createdAt', header: '建立時間', type: 'text' },
      { key: 'updatedAt', header: '更新時間', type: 'text' }
    ]
  },
  meanings: {
    sheetName: '歌曲裡的意思',
    fields: [
      // id 固定是「單字id__歌曲id」，同一個字在同一首歌只有一筆
      { key: 'id', header: 'id', type: 'text', width: 250 },
      { key: 'wordId', header: '單字id', type: 'text', width: 250 },
      { key: 'songId', header: '歌曲id', type: 'text', width: 250 },
      { key: 'text', header: '意思', type: 'text', width: 240 },
      { key: 'createdAt', header: '建立時間', type: 'text' }
    ]
  }
};

var ENTITIES = Object.keys(SHEETS);

/* ==========================================================================
   進入點
   ========================================================================== */

function doGet(e) {
  return respond({ ok: true, service: '學詞吧 API', message: '這是 API 端點，請從 App 使用。' });
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: '無法解析請求內容' });
  }
  return respond(route(payload));
}

/** 所有操作都在 script lock 內執行，避免同時送出時互相蓋掉。 */
function route(payload) {
  var expected = String(SECRET || '').trim();
  if (expected && String(payload.secret || '').trim() !== expected) {
    return { ok: false, error: '通關密語錯誤，請到設定確認', authError: true };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: '系統忙碌中，請稍後再試' };
  }

  try {
    switch (payload.action || 'list') {
      case 'list': {
        var out = { ok: true };
        ENTITIES.forEach(function (name) { out[name] = listRows(name); });
        return out;
      }
      case 'batch': {
        // App 離線時累積的操作，一次送來；依序執行，回報每一筆成功與否
        var results = (payload.ops || []).map(function (op) {
          try {
            runOp(op);
            return { ok: true };
          } catch (err) {
            return { ok: false, error: String((err && err.message) || err) };
          }
        });
        return { ok: true, results: results };
      }
      default:
        runOp(payload);
        return { ok: true };
    }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  } finally {
    lock.releaseLock();
  }
}

function runOp(op) {
  switch (op.action) {
    case 'save':
      saveRow(op.entity, op.record);
      return;
    case 'remove':
      removeRow(op.entity, op.id);
      return;
    default:
      throw new Error('未知的操作：' + op.action);
  }
}

function respond(obj) {
  obj.apiVersion = API_VERSION;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
   通用 CRUD
   ========================================================================== */

function getConfig(entity) {
  var config = SHEETS[entity];
  if (!config) throw new Error('未知的資料表：' + entity);
  return config;
}

function getSheet(entity) {
  var config = getConfig(entity);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(config.sheetName);
    var headers = config.fields.map(function (f) { return f.header; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    config.fields.forEach(function (f, idx) { formatColumn(sheet, f, idx + 1); });
  } else {
    ensureColumns(sheet, config);
  }
  return sheet;
}

function formatColumn(sheet, f, col) {
  if (f.width) sheet.setColumnWidth(col, f.width);
  var body = sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1);
  // 文字欄設純文字，Sheets 才不會自作聰明改格式（例如把 1/2 變成日期）
  if (f.type === 'text') body.setNumberFormat('@');
  if (f.long) body.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('top');
}

/** 後來新增的欄位補到既有分頁的最後面，舊資料的欄位順序不會亂。 */
function ensureColumns(sheet, config) {
  var have = sheet.getLastColumn();
  if (have >= config.fields.length) return;
  for (var i = have; i < config.fields.length; i++) {
    sheet.getRange(1, i + 1).setValue(config.fields[i].header).setFontWeight('bold');
    formatColumn(sheet, config.fields[i], i + 1);
  }
}

function listRows(entity) {
  var config = getConfig(entity);
  var sheet = getSheet(entity);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, config.fields.length).getValues();
  return values
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      var rec = {};
      config.fields.forEach(function (f, i) { rec[f.key] = readCell(row[i], f.type); });
      return rec;
    });
}

function saveRow(entity, record) {
  var config = getConfig(entity);
  var sheet = getSheet(entity);
  if (!record || !record.id) throw new Error('缺少 id');
  if (!record.createdAt) record.createdAt = new Date().toISOString();

  var row = config.fields.map(function (f) { return writeCell(record[f.key], f.type); });
  var rowIndex = findRowById(sheet, record.id);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function removeRow(entity, id) {
  var sheet = getSheet(entity);
  var rowIndex = findRowById(sheet, id);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
}

function findRowById(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function readCell(value, type) {
  if (type === 'number') return value === '' ? 0 : Number(value);
  return value === null || value === undefined ? '' : String(value);
}

function writeCell(value, type) {
  if (value === undefined || value === null) return '';
  if (type === 'number') return value === '' ? '' : Number(value);
  var s = String(value);
  // 「=」開頭的字會被當成公式。前面加一個單引號強制當文字，讀回來時單引號不會出現
  return s.charAt(0) === '=' ? "'" + s : s;
}
