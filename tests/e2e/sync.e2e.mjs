// E2E синхронизации: два «устройства» (контекста браузера) через поддельные Google OAuth и Drive.
// Проверяет: отметка и её снятие доходят, в облаке только шифр без wraps.pk и токенов, токен не попадает в хранилища браузера.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PORT = 8792;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PASS = 'синтетика синхронизация 7';
const TOKEN = 'FAKE-ACCESS-TOKEN-0123456789';
const CARD = {
  card: { patient: { name: 'Тестовый Пациент' }, meds: [{ id: 'm1', name: 'Тестомицин', dose: '5 мг', status: 'active' }] },
  tasks: [{ id: 't1', title: 'Пройти PHQ-9 повторно', xp: 30, system: 'psych' }],
  habits: [{ id: 'walk', label: 'Прогулка', xp: 5 }]
};
const MARKERS = ['Тестомицин', 'Тестовый Пациент', 'PHQ-9 повторно'];

// Поддельный Drive: один файл в appDataFolder, version растёт при каждой записи
const drive = { file: null, writes: 0 };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' };
async function driveRoute(route) {
  const req = route.request(), url = new URL(req.url()), json = (o, s = 200) => route.fulfill({ status: s, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (req.headers()['authorization'] !== 'Bearer ' + TOKEN) return json({ error: 'auth' }, 401);
  const p = url.pathname, m = p.match(/\/files\/([^/]+)$/);
  if (req.method() === 'GET' && p === '/drive/v3/files') {
    assert.equal(url.searchParams.get('spaces'), 'appDataFolder');
    return json({ files: drive.file ? [{ id: drive.file.id, version: String(drive.file.version) }] : [] });
  }
  if (req.method() === 'GET' && m) {
    if (url.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: drive.file.body });
    return json({ id: drive.file.id, version: String(drive.file.version) });
  }
  if (req.method() === 'POST' && p === '/upload/drive/v3/files') {
    const body = req.postData(), b = req.headers()['content-type'].split('boundary=')[1];
    const parts = body.split('--' + b);
    assert.ok(parts[1].includes('"appDataFolder"'), 'файл создаётся в appDataFolder');
    drive.file = { id: 'file-1', version: 1, body: parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') };
    drive.writes++;
    return json({ id: 'file-1', version: '1' });
  }
  if (req.method() === 'PATCH' && m) {
    drive.file.version++; drive.file.body = req.postData(); drive.writes++;
    return json({ id: drive.file.id, version: String(drive.file.version) });
  }
  return json({ error: 'unexpected ' + req.method() + ' ' + p }, 400);
}
const auths = [];
async function authRoute(route) {
  const u = new URL(route.request().url());
  auths.push(Object.fromEntries(u.searchParams));
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.appdata');
  assert.equal(u.searchParams.get('response_type'), 'token');
  const back = `${u.searchParams.get('redirect_uri')}#access_token=${TOKEN}&token_type=Bearer&expires_in=3600&state=${encodeURIComponent(u.searchParams.get('state'))}`;
  return route.fulfill({ status: 302, headers: { Location: back } });
}

let server, browser;
test.before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new URL('../serve.js', import.meta.url)), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => server.stdout.once('data', r));
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
});
test.after(async () => { await browser?.close(); server?.kill(); });

async function device() {
  const ctx = await browser.newContext();
  await ctx.route(`${ORIGIN}/config.js`, r => r.fulfill({ contentType: 'text/javascript', body: "window.ZCONFIG={webClientId:'test-client.apps.googleusercontent.com'};" }));
  await ctx.route('https://accounts.google.com/**', authRoute);
  await ctx.route('https://www.googleapis.com/**', driveRoute);
  const page = await ctx.newPage();
  page.on('pageerror', e => { throw e; });
  return { ctx, page };
}
async function skipFaceId(page) {
  await page.waitForSelector('[data-act="g-pkskip"], [data-act="habit"], #file-in', { state: 'attached' });
  if (await page.$('[data-act="g-pkskip"]')) await page.click('[data-act="g-pkskip"]');
}
async function unlock(page) { await page.fill('#up', PASS); await page.click('[data-act="g-unlock"]'); }
const habitState = page => page.getAttribute('[data-act="habit"][data-id="walk"]', 'aria-pressed');
async function syncAndWait(page) {
  const before = drive.writes;
  await page.click('[data-act="sync-tap"]');
  await page.waitForFunction(() => !/Синхронизация…/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  return drive.writes - before;
}
const storageDump = page => page.evaluate(async () => {
  const v = await new Promise(res => { const o = indexedDB.open('zdorovie', 1); o.onsuccess = () => { const g = o.result.transaction('kv').objectStore('kv').get('vault'); g.onsuccess = () => res(JSON.stringify(g.result)); }; });
  return { idb: v, ls: localStorage.length, ss: sessionStorage.length, ssDump: JSON.stringify(sessionStorage) };
});

test('синхронизация двух устройств через Google Drive', async () => {
  // Устройство A: новое хранилище, медкарта, подключение Google Drive
  const A = await device(), a = A.page;
  await a.goto(ORIGIN + '/');
  await a.click('[data-act="g-new"]');
  await a.fill('#p1', PASS); await a.fill('#p2', PASS);
  await a.click('[data-act="g-setpass"]');
  await a.check('#rec-ok'); await a.click('[data-act="g-recdone"]');
  await skipFaceId(a);
  await a.setInputFiles('#file-in', { name: 'card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(CARD)) });
  await a.waitForSelector('[data-act="habit"][data-id="walk"]');
  await a.click('[data-act="data"]');
  await a.click('[data-act="gd-on"]');
  // Вернулись от Google: хранилище заблокировано, токен в памяти, адрес очищен
  await a.waitForSelector('#up');
  assert.equal(new URL(a.url()).hash, '');
  await unlock(a);
  await a.waitForSelector('[data-act="habit"][data-id="walk"]');
  await a.waitForFunction(() => /Синхронизировано/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  assert.ok(drive.file, 'файл создан в облаке');

  const env = JSON.parse(drive.file.body);
  assert.equal(env.format, 'zdorovie-vault');
  assert.equal(env.wraps.pk, undefined, 'в облаке нет wraps.pk');
  assert.equal(env.local, undefined, 'в облаке нет локальных полей');
  for (const m of [...MARKERS, TOKEN]) assert.ok(!drive.file.body.includes(m), `в облаке открытый текст: ${m}`);
  let st = await storageDump(a);
  assert.equal(st.ls + st.ss, 0, 'localStorage и sessionStorage пусты: ' + st.ssDump);
  assert.ok(!st.idb.includes(TOKEN), 'токен не попал в IndexedDB');
  for (const m of MARKERS) assert.ok(!st.idb.includes(m));

  // Устройство B: «Подключить медкарту из Google Drive»
  const B = await device(), b = B.page;
  await b.goto(ORIGIN + '/');
  await b.click('[data-act="g-cloud"]');
  await b.waitForSelector('#up');
  assert.match(await b.textContent('.gate'), /Google Drive/);
  await unlock(b);
  await skipFaceId(b);
  await b.waitForSelector('[data-act="habit"][data-id="walk"]');
  await b.click('[data-act="tab"][data-tab="card"]');
  await b.click('[data-act="seg"][data-v="meds"]');
  assert.ok((await b.textContent('#main')).includes('Тестомицин'), 'данные пришли из облака');
  await b.click('[data-act="tab"][data-tab="today"]');

  // Отметка на B → A
  await b.click('[data-act="habit"][data-id="walk"]');
  assert.equal(await syncAndWait(b), 1);
  await syncAndWait(a);
  await a.waitForFunction(() => document.querySelector('[data-act="habit"][data-id="walk"]').getAttribute('aria-pressed') === 'true');

  // Снятие отметки на A → B
  await a.click('[data-act="habit"][data-id="walk"]');
  await syncAndWait(a);
  await syncAndWait(b);
  assert.equal(await habitState(b), 'false');

  // Повторная синхронизация без изменений ничего не загружает
  assert.equal(await syncAndWait(a), 0);
  assert.equal(await syncAndWait(b), 0);

  // Смена фразы на B: A принимает новую обёртку и открывается новой фразой
  const NEWPASS = 'новая синтетика фраза 8';
  await b.click('[data-act="security"]');
  await b.fill('#cp0', PASS); await b.fill('#cp1', NEWPASS); await b.fill('#cp2', NEWPASS);
  const w0 = drive.writes;
  await b.click('[data-act="chpass"]');
  await b.waitForFunction(() => /Фраза изменена/.test(document.getElementById('toast').textContent));
  for (let i = 0; i < 50 && drive.writes === w0; i++) await b.waitForTimeout(100);
  assert.equal(drive.writes, w0 + 1, 'новая обёртка ушла в облако');
  await syncAndWait(a);
  await a.click('[data-act="security"]'); await a.click('[data-act="lock-now"]');
  await a.fill('#up', NEWPASS); await a.click('[data-act="g-unlock"]');
  await a.waitForSelector('[data-act="habit"][data-id="walk"]');

  // Перезапуск A: тихий вход (prompt=none) без петли переадресаций
  const n = auths.length;
  await a.reload();
  await a.waitForSelector('#up');
  assert.equal(auths.length, n + 1);
  assert.equal(auths.at(-1).prompt, 'none');
  st = await storageDump(a);
  assert.equal(st.ls + st.ss, 0);
  await A.ctx.close(); await B.ctx.close();
});

// Настольная версия: имитация window.__TAURI__. Файлы хранятся в node (переживают перезагрузку страницы),
// вход — authorization code + PKCE, refresh token хранится в конверте зашифрованным.
test('Tauri: вход PKCE, refresh token только зашифрованным, синхронизация после перезапуска', async () => {
  drive.file = null;
  const REFRESH = 'FAKE-REFRESH-TOKEN-9876543210', files = {}, grants = [];
  const ctx = await browser.newContext();
  await ctx.route(`${ORIGIN}/config.js`, r => r.fulfill({ contentType: 'text/javascript', body: "window.ZCONFIG={desktopClientId:'desk.apps.googleusercontent.com',desktopClientSecret:'desk-secret'};" }));
  await ctx.route('https://www.googleapis.com/**', driveRoute);
  await ctx.exposeFunction('__tfs', (op, p, s) => {
    if (op === 'exists') return p in files;
    if (op === 'read') return files[p];
    if (op === 'write') { files[p] = s; return; }
    if (op === 'rename') { files[s] = files[p]; delete files[p]; return; }
    if (op === 'remove') { delete files[p]; return; }
  });
  await ctx.exposeFunction('__token', form => {
    const q = Object.fromEntries(new URLSearchParams(form));
    grants.push(q);
    assert.equal(q.client_id, 'desk.apps.googleusercontent.com');
    assert.equal(q.client_secret, 'desk-secret');
    if (q.grant_type === 'authorization_code') {
      assert.equal(q.code, 'AUTH-CODE');
      assert.ok(q.code_verifier && q.code_verifier.length >= 43, 'PKCE verifier');
      assert.match(q.redirect_uri, /^http:\/\/127\.0\.0\.1:45678$/);
      return { access_token: TOKEN, expires_in: 3600, refresh_token: REFRESH };
    }
    assert.equal(q.grant_type, 'refresh_token');
    assert.equal(q.refresh_token, REFRESH);
    return { access_token: TOKEN, expires_in: 3600 };
  });
  await ctx.addInitScript(() => {
    let onRedirect = null;
    window.__TAURI__ = {
      core: { invoke: async (cmd, args) => { if (cmd !== 'oauth_listen') throw new Error(cmd); return 45678; } },
      event: { listen: async (name, cb) => { onRedirect = cb; return () => { onRedirect = null; }; } },
      opener: { openUrl: async url => {
        const u = new URL(url);
        if (u.searchParams.get('code_challenge_method') !== 'S256' || u.searchParams.get('access_type') !== 'offline') throw new Error('bad auth url');
        setTimeout(() => onRedirect && onRedirect({ payload: '/?state=' + encodeURIComponent(u.searchParams.get('state')) + '&code=AUTH-CODE&scope=x' }), 50);
      } },
      http: { fetch: async (url, init) => {
        if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify(await window.__token(init.body)), { status: 200, headers: { 'Content-Type': 'application/json' } });
        return fetch(url, init);
      } },
      path: { appDataDir: async () => 'C:/AppData/app.zdorovie.desktop', join: async (...a) => a.join('/') },
      fs: {
        mkdir: async () => {}, exists: p => window.__tfs('exists', p),
        readTextFile: async p => { const s = await window.__tfs('read', p); if (s == null) throw new Error('nf'); return s; },
        writeTextFile: (p, s) => window.__tfs('write', p, s), rename: (a, b) => window.__tfs('rename', a, b), remove: p => window.__tfs('remove', p)
      },
      dialog: { save: async () => null },
      updater: { check: async () => null }
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { throw e; });
  await page.goto(ORIGIN + '/');
  await page.click('[data-act="g-new"]');
  await page.fill('#p1', PASS); await page.fill('#p2', PASS);
  await page.click('[data-act="g-setpass"]');
  await page.check('#rec-ok'); await page.click('[data-act="g-recdone"]');
  await page.setInputFiles('#file-in', { name: 'card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(CARD)) });
  await page.waitForSelector('[data-act="habit"][data-id="walk"]');
  await page.click('[data-act="data"]');
  await page.click('[data-act="gd-on"]');
  await page.waitForFunction(() => /Синхронизировано/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  assert.ok(drive.file, 'файл создан в облаке');

  const vaultPath = 'C:/AppData/app.zdorovie.desktop/vault.enc.json', local = files[vaultPath];
  assert.ok(JSON.parse(local).local.gtoken.ct, 'refresh token сохранён в конверте');
  for (const s of [REFRESH, TOKEN]) {
    assert.ok(!local.includes(s), 'токен в файле хранилища в открытом виде');
    assert.ok(!drive.file.body.includes(s), 'токен в облаке');
  }
  assert.ok(!drive.file.body.includes('gtoken'));

  // Перезапуск: токена в памяти нет, refresh token расшифровывается после разблокировки
  await page.reload();
  await unlock(page);
  await page.waitForSelector('[data-act="habit"][data-id="walk"]');
  await page.click('[data-act="habit"][data-id="walk"]');
  await page.click('[data-act="sync-tap"]');
  await page.waitForFunction(() => /Синхронизировано/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  assert.equal(grants.at(-1).grant_type, 'refresh_token');
  assert.equal(JSON.parse(drive.file.body).data.ct.length > 0, true);
  assert.equal(drive.file.version, 2, 'отметка ушла в облако');
  await ctx.close();
});

test('в облаке медкарта с другим ключом: облако не перезаписывается, подключение по её фразе', async () => {
  assert.ok(drive.file, 'облако заполнено предыдущим тестом');
  const before = drive.file.body, C = await device(), c = C.page, OTHER = 'другая фраза устройства 5';
  await c.goto(ORIGIN + '/');
  await c.click('[data-act="g-new"]');
  await c.fill('#p1', OTHER); await c.fill('#p2', OTHER);
  await c.click('[data-act="g-setpass"]');
  await c.check('#rec-ok'); await c.click('[data-act="g-recdone"]');
  await skipFaceId(c);
  await c.setInputFiles('#file-in', { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ tasks: [{ id: 'tc', title: 'Задача с устройства C' }] })) });
  await c.waitForSelector('[data-act="tab"]');
  await c.click('[data-act="data"]');
  await c.click('[data-act="gd-on"]');
  await c.fill('#up', OTHER); await c.click('[data-act="g-unlock"]');
  await c.waitForFunction(() => /другая медкарта/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  assert.equal(drive.file.body, before, 'облако с чужим ключом не перезаписано');

  await c.click('[data-act="sync-tap"]');
  await c.fill('#cfp', PASS);
  c.once('dialog', d => d.accept());
  await c.click('[data-act="gd-adopt"]');
  await c.waitForFunction(() => /Синхронизировано/.test(document.querySelector('[data-sync-label]')?.textContent || ''));
  assert.notEqual(drive.file.body, before, 'объединённая медкарта загружена');
  const cloud = JSON.parse(drive.file.body), local = JSON.parse((await storageDump(c)).idb);
  assert.deepEqual(local.wraps.pass, cloud.wraps.pass, 'устройство приняло ключ облачной медкарты');
  await c.click('[data-act="close"]');
  await c.click('[data-act="tab"][data-tab="tasks"]');
  const text = await c.textContent('#main');
  assert.ok(text.includes('Задача с устройства C') && text.includes('PHQ-9 повторно'), 'данные обеих медкарт на месте');
  // После блокировки открывается фразой облачной медкарты
  await c.click('[data-act="security"]'); await c.click('[data-act="lock-now"]');
  await unlock(c);
  await c.waitForSelector('[data-act="tab"]');
  await C.ctx.close();
});
