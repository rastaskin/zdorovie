// E2E: медкарта не лежит открытым текстом ни в IndexedDB, ни в файле Tauri, ни в экспортированной копии.
// Локально: PW_CHANNEL=msedge npm run test:e2e (браузер из системы). В CI — chromium из playwright install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PORT = 8790;
const URL = `http://127.0.0.1:${PORT}/`;
const PASS = 'синтетика проверка 42';
// Синтетическая медкарта. «PHQ» ищем в составе фразы с кириллицей: в base64 шифра она случайно возникнуть не может.
const CARD = {
  card: {
    patient: { name: 'Тестовый Пациент' },
    meds: [{ id: 'm1', name: 'Тестомицин', dose: '50 мг', status: 'active' }],
    labs: [{ id: 'l1', name: 'Гемоглобин', value: 140, unit: 'г/л', ref: '130–170', date: '2026-09-01' }]
  },
  tasks: [{ id: 't1', title: 'Пройти PHQ-9 повторно', due: '2026-11-01', xp: 30, system: 'psych', type: 'Замер' }],
  habits: [{ id: 'walk', label: 'Прогулка', xp: 5 }],
  phq: [{ date: '2026-09-01', score: 7, items: [1, 1, 1, 1, 1, 1, 1, 0, 0] }]
};
const MARKERS = ['Тестомицин', 'Гемоглобин', 'PHQ-9 повторно', 'Тестовый Пациент'];
function assertNoPlain(text, where) {
  for (const m of MARKERS) assert.ok(!text.includes(m), `${where}: найден открытый текст «${m}»`);
}

let server, browser;
test.before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new globalThis.URL('../serve.js', import.meta.url)), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => server.stdout.once('data', r));
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
});
test.after(async () => { await browser?.close(); server?.kill(); });

async function createAndImport(page) {
  await page.goto(URL);
  await page.click('[data-act="g-new"]');
  await page.fill('#p1', PASS); await page.fill('#p2', PASS);
  await page.click('[data-act="g-setpass"]');
  await page.check('#rec-ok');
  await page.click('[data-act="g-recdone"]');
  await page.waitForSelector('[data-act="g-pkskip"], #file-in', { state: 'attached' });
  const faceId = !!(await page.$('[data-act="g-pkskip"]'));
  if (faceId) await page.click('[data-act="g-pkskip"]');
  await page.setInputFiles('#file-in', { name: 'card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(CARD)) });
  await page.waitForSelector('[data-act="habit"][data-id="walk"]');
  await page.click('[data-act="habit"][data-id="walk"]');
  await page.waitForTimeout(300);
  return { faceId };
}
async function unlock(page, pass) {
  await page.fill('#up', pass);
  await page.click('[data-act="g-unlock"]');
}
const idbVault = page => page.evaluate(() => new Promise((res, rej) => {
  const o = indexedDB.open('zdorovie', 1);
  o.onsuccess = () => { const g = o.result.transaction('kv').objectStore('kv').get('vault'); g.onsuccess = () => res(JSON.stringify(g.result)); g.onerror = rej; };
  o.onerror = rej;
}));

test('веб: шифр в IndexedDB и в копии, вход по фразе, восстановление на втором устройстве', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await createAndImport(page);

  const raw = await idbVault(page);
  assert.ok(raw.includes('"format":"zdorovie-vault"'));
  assertNoPlain(raw, 'IndexedDB');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, 'localStorage и sessionStorage пусты');

  await page.click('[data-act="data"]');
  await page.waitForSelector('[data-act="backup"]:not([disabled])');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="backup"]')]);
  const exported = await readFile(await dl.path(), 'utf8');
  assert.equal(JSON.parse(exported).format, 'zdorovie-vault');
  assertNoPlain(exported, 'экспорт');

  await page.click('[data-act="close"]');
  await page.click('[data-act="security"]');
  await page.click('[data-act="lock-now"]');
  await unlock(page, 'неверная фраза 000');
  await page.waitForFunction(() => /не подходит/.test(document.getElementById('gerr')?.textContent || ''));
  await unlock(page, PASS);
  await page.waitForSelector('[data-act="habit"][data-id="walk"][aria-pressed="true"]');

  // Второе устройство: восстановление из копии
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(URL);
  await p2.setInputFiles('#restore-in', { name: dl.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(exported) });
  await unlock(p2, PASS);
  await p2.waitForSelector('[data-act="g-pkskip"], [data-act="habit"]', { state: 'attached' });
  if (await p2.$('[data-act="g-pkskip"]')) await p2.click('[data-act="g-pkskip"]');
  await p2.click('[data-act="tab"][data-tab="card"]');
  await p2.click('[data-act="seg"][data-v="meds"]');
  assert.ok((await p2.textContent('#main')).includes('Тестомицин'), 'данные восстановлены');
  assertNoPlain(await idbVault(p2), 'IndexedDB второго устройства');
  await ctx2.close();
  await ctx.close();
});

// Имитация window.__TAURI__: файлы в памяти страницы, диалог сохранения возвращает путь.
const TAURI_MOCK = () => {
  const F = window.__FILES = {};
  window.__TAURI__ = {
    path: { appDataDir: async () => 'C:/AppData/app.zdorovie.desktop', join: async (...a) => a.join('/') },
    fs: {
      mkdir: async () => {}, exists: async p => p in F,
      readTextFile: async p => { if (!(p in F)) throw new Error('nf'); return F[p]; },
      writeTextFile: async (p, s) => { F[p] = s; },
      rename: async (a, b) => { F[b] = F[a]; delete F[a]; },
      remove: async p => { delete F[p]; }
    },
    dialog: { save: async o => 'C:/Users/test/' + o.defaultPath },
    updater: { check: async () => null }
  };
};

test('Tauri: шифр в файле хранилища и в копии, Face ID не предлагается', async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(TAURI_MOCK);
  const page = await ctx.newPage();
  const { faceId } = await createAndImport(page);
  assert.equal(faceId, false, 'в Tauri экран Face ID не показывается');
  const files = await page.evaluate(() => window.__FILES);
  const vaultPath = 'C:/AppData/app.zdorovie.desktop/vault.enc.json';
  assert.ok(files[vaultPath], 'файл хранилища записан');
  assert.ok(!files[vaultPath + '.tmp'], 'временный файл переименован');
  assertNoPlain(files[vaultPath], 'файл Tauri');

  await page.click('[data-act="data"]');
  await page.waitForSelector('[data-act="backup"]:not([disabled])');
  await page.click('[data-act="backup"]');
  await page.waitForFunction(() => Object.keys(window.__FILES).some(k => k.startsWith('C:/Users/test/')));
  const out = await page.evaluate(() => Object.entries(window.__FILES).find(([k]) => k.startsWith('C:/Users/test/'))[1]);
  assert.equal(JSON.parse(out).format, 'zdorovie-vault');
  assertNoPlain(out, 'копия Tauri');
  assert.equal(JSON.parse(files[vaultPath]).wraps.pk.length, 0);
  await ctx.close();
});
