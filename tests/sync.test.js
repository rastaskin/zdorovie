// Алгоритм синхронизации на поддельном Drive. Шифрование подменено: «ключ» — метка в iv, этого достаточно,
// чтобы проверить, что чужой DEK не перезаписывает облако. Реальная криптография — в E2E.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../web/model.js');
const Z = require('../web/sync.js');

function fakeDrive() {
  const d = {
    file: null, uploads: 0, hook: null,
    async find() { return d.file && { id: d.file.id, version: String(d.file.version) }; },
    async meta(id) { if (d.hook) { const h = d.hook; d.hook = null; await h(); } return { id, version: String(d.file.version) }; },
    async download() { return d.file.body; },
    async create(body) { d.file = { id: 'f1', version: 1, body }; d.uploads++; return { id: 'f1', version: '1' }; },
    async update(id, body) { d.file.version++; d.file.body = body; d.uploads++; return { id, version: String(d.file.version) }; }
  };
  return d;
}

let clock = 1000;
function device(drive, key, S) {
  const dev = {
    drive, now: () => ++clock, merge: M.merge, equal: M.equal,
    S: S || M.blank(),
    vault: { format: 'zdorovie-vault', v: 1, created: 'c', wraps: { pass: { salt: 's', iv: 'p', ct: key, at: 1 }, rec: { iv: 'r', ct: key, at: 1 }, prfSalt: 'x', pk: [{ id: 'pk1', host: 'h' }] }, data: null, local: { sync: { on: true }, gtoken: { iv: 'g', ct: 'REFRESH' } } },
    async decrypt(env) { if (env.data.iv !== key) throw new Error('foreign'); return M.normalize(JSON.parse(env.data.ct)); },
    async persist(withData) { if (withData) dev.seal(); },
    seal() { dev.vault.data = { iv: key, ct: JSON.stringify(dev.S) }; },
    // мутация пользователем: как commit() приложения
    edit(fn) { const prev = M.clone(dev.S); fn(dev.S); M.stamp(prev, dev.S, ++clock); dev.seal(); dev.vault.local.sync.dirty = true; },
    sync() { return Z.run(dev); }
  };
  dev.seal();
  return dev;
}
const cloud = drive => JSON.parse(drive.file.body);

test('пустое облако: загрузка без wraps.pk и без локальных полей', async () => {
  const drive = fakeDrive(), A = device(drive, 'K');
  A.edit(s => { s.tasks.push({ id: 't1', title: 'Задача' }); });
  const r = await A.sync();
  assert.equal(r.status, 'created');
  const env = cloud(drive);
  assert.equal(env.wraps.pk, undefined);
  assert.equal(env.local, undefined);
  assert.ok(!drive.file.body.includes('REFRESH'), 'refresh token не уходит в облако');
  assert.equal(A.vault.local.sync.version, '1');
  assert.equal(A.vault.local.sync.dirty, false);
});

test('отметка, снятие отметки и удаление доходят до второго устройства', async () => {
  const drive = fakeDrive(), A = device(drive, 'K'), B = device(drive, 'K');
  A.edit(s => { s.tasks.push({ id: 't1', title: 'Задача', done: '' }); s.daily['2026-10-20'] = { h: { walk: true } }; });
  await A.sync(); await B.sync();
  assert.equal(B.S.daily['2026-10-20'].h.walk, true);
  B.edit(s => { s.daily['2026-10-20'].h.walk = false; s.tasks = []; });
  await B.sync(); await A.sync();
  assert.equal(A.S.daily['2026-10-20'].h.walk, false);
  assert.equal(A.S.tasks.length, 0);
});

test('без изменений ничего не загружается повторно', async () => {
  const drive = fakeDrive(), A = device(drive, 'K'), B = device(drive, 'K');
  A.edit(s => { s.habits.push({ id: 'h1', label: 'Х' }); });
  await A.sync(); await B.sync();
  const n = drive.uploads;
  assert.equal((await A.sync()).status, 'ok');
  assert.equal((await B.sync()).status, 'ok');
  B.vault.local.sync.dirty = true; // правка, которая уже есть в облаке
  await B.sync();
  assert.equal(drive.uploads, n);
});

test('облако изменилось во время синхронизации: повтор и слияние обеих правок', async () => {
  const drive = fakeDrive(), A = device(drive, 'K'), B = device(drive, 'K');
  await A.sync(); await B.sync();
  A.edit(s => { s.tasks.push({ id: 'a', title: 'A' }); });
  B.edit(s => { s.tasks.push({ id: 'b', title: 'B' }); });
  drive.hook = async () => { await B.sync(); };
  const r = await A.sync();
  assert.equal(r.status, 'ok');
  const env = cloud(drive);
  assert.deepEqual(JSON.parse(env.data.ct).tasks.map(t => t.id).sort(), ['a', 'b']);
  await B.sync();
  assert.deepEqual(B.S.tasks.map(t => t.id).sort(), ['a', 'b']);
});

test('три конфликта подряд: busy, облако не затёрто', async () => {
  const drive = fakeDrive(), A = device(drive, 'K'), B = device(drive, 'K');
  await A.sync(); await B.sync();
  A.edit(s => { s.tasks.push({ id: 'a', title: 'A' }); });
  let n = 0;
  B.drive = { ...drive }; // B видит тот же файл, но без подмены meta
  const orig = drive.meta;
  drive.meta = async id => { if (n++ < 3) { B.edit(s => { s.bonus.push({ id: 'b' + n, xp: 1 }); }); await B.sync(); } return orig(id); };
  const r = await A.sync();
  assert.equal(r.status, 'busy');
  assert.equal(JSON.parse(cloud(drive).data.ct).bonus.length, 3);
  drive.meta = orig;
  assert.equal((await A.sync()).status, 'ok');
  assert.ok(JSON.parse(cloud(drive).data.ct).tasks.some(t => t.id === 'a'));
});

test('облако зашифровано другим DEK: не перезаписывается', async () => {
  const drive = fakeDrive(), A = device(drive, 'K1'), X = device(drive, 'K2');
  X.edit(s => { s.tasks.push({ id: 'x', title: 'X' }); });
  await X.sync();
  const before = drive.file.body;
  A.edit(s => { s.tasks.push({ id: 'a', title: 'A' }); });
  const r = await A.sync();
  assert.equal(r.status, 'foreign');
  assert.equal(drive.file.body, before);
  assert.equal(A.S.tasks.length, 1);
});

test('повреждённый файл в облаке не перезаписывается', async () => {
  const drive = fakeDrive(), A = device(drive, 'K');
  drive.file = { id: 'f1', version: 5, body: 'не json' };
  assert.equal((await A.sync()).status, 'foreign');
  assert.equal(drive.file.body, 'не json');
});

test('фразу сменили на другом устройстве: принимается более новая обёртка', async () => {
  const drive = fakeDrive(), A = device(drive, 'K'), B = device(drive, 'K');
  await A.sync(); await B.sync();
  B.vault.wraps.pass = { salt: 's2', iv: 'p2', ct: 'K', at: 50_000 };
  B.vault.local.sync.dirty = true;
  await B.sync();
  assert.equal(cloud(drive).wraps.pass.salt, 's2', 'новая обёртка ушла в облако без изменений данных');
  await A.sync();
  assert.equal(A.vault.wraps.pass.salt, 's2');
  assert.equal(A.vault.wraps.pk.length, 1, 'Face ID этого устройства остаётся');
  // Старая обёртка на третьем устройстве не откатывает новую
  const C = device(drive, 'K');
  C.vault.local.sync.dirty = true;
  await C.sync();
  assert.equal(C.vault.wraps.pass.salt, 's2');
  assert.equal(cloud(drive).wraps.pass.salt, 's2');
});
