// Статические инварианты безопасности: CSP не шире разрешённого, в репозитории нет медданных, токенов и секретов.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Всё, что можно разрешать в CSP. Хосты Google — только эти три.
const ALLOWED = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://accounts.google.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'ipc:', 'http://ipc.localhost', 'https://accounts.google.com', 'https://www.googleapis.com', 'https://oauth2.googleapis.com'],
  'frame-src': ['https://accounts.google.com'],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'object-src': ["'none'"]
};
function checkCsp(dirs, where) {
  for (const d of ['default-src', 'script-src', 'object-src', 'base-uri']) assert.ok(dirs[d], `${where}: нет ${d}`);
  for (const [d, srcs] of Object.entries(dirs)) {
    assert.ok(ALLOWED[d], `${where}: директива ${d} не разрешена`);
    for (const s of srcs) assert.ok(ALLOWED[d].includes(s), `${where}: ${d} ${s} шире разрешённого`);
  }
}
const parse = str => Object.fromEntries(str.split(';').map(x => x.trim()).filter(Boolean).map(x => { const [d, ...s] = x.split(/\s+/); return [d, s]; }));

test('CSP в index.html не шире разрешённого', () => {
  const m = read('web/index.html').match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(m, 'нет CSP в index.html');
  checkCsp(parse(m[1]), 'index.html');
});

test('CSP в tauri.conf.json не шире разрешённого', () => {
  const csp = JSON.parse(read('desktop/src-tauri/tauri.conf.json')).app.security.csp;
  const dirs = typeof csp === 'string' ? parse(csp) : Object.fromEntries(Object.entries(csp).map(([d, s]) => [d, s.split(/\s+/)]));
  checkCsp(dirs, 'tauri.conf.json');
  assert.ok(!dirs['script-src'].includes('https://accounts.google.com'), 'в настольной версии сторонние скрипты не нужны');
});

test('нет сторонних скриптов, шрифтов и стилей из сети', () => {
  const html = read('web/index.html');
  for (const m of html.matchAll(/<(script|link)\b[^>]*(src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(m[3]) || m[3] === 'https://accounts.google.com/gsi/client', 'внешний ресурс: ' + m[3]);
  }
  assert.ok(!/https?:\/\//.test(read('web/fonts/fonts.css')), 'шрифты только локальные');
});

// Файлы, которые попадут в репозиторий (всё, кроме игнорируемых каталогов)
const SKIP = new Set(['.git', 'node_modules', 'target', 'gen', 'test-results', '.claude']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
const TEXT = /\.(js|mjs|html|css|md|json|yml|yaml|toml|rs|webmanifest|txt)$/;

test('в репозитории нет файлов с данными', () => {
  const allowedJson = /^(package(-lock)?\.json|desktop\/package(-lock)?\.json|desktop\/src-tauri\/tauri\.conf\.json|desktop\/src-tauri\/capabilities\/[^/]+\.json)$/;
  const files = walk(ROOT).filter(f => !ignored(f));
  for (const f of files) {
    if (f.endsWith('.json')) assert.ok(allowedJson.test(f), 'файл .json вне списка: ' + f);
    assert.ok(!/\.enc\.json$|medcard/i.test(f), 'похоже на медкарту: ' + f);
  }
});

test('в репозитории нет токенов и client secret', () => {
  const bad = [/GOCSPX-[\w-]{10,}/, /ya29\.[\w-]{20,}/, /1\/\/0[\w-]{30,}/, /"refresh_token"\s*:\s*"[^"]+"/, /"access_token"\s*:\s*"[^"]+"/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /untrusted comment: rsign encrypted secret key/];
  for (const f of walk(ROOT).filter(f => TEXT.test(f) && !ignored(f) && f !== 'tests/invariants.test.js')) {
    const s = read(f);
    for (const re of bad) assert.ok(!re.test(s), `${f}: похоже на секрет (${re})`);
  }
});

test('медицинские маркеры встречаются только в синтетических тестах', () => {
  const markers = ['Тестомицин', 'Гемоглобин'];
  for (const f of walk(ROOT).filter(f => TEXT.test(f) && !ignored(f) && !f.startsWith('tests/') && f !== 'CLAUDE.md')) {
    const s = read(f);
    for (const w of markers) assert.ok(!s.includes(w), `${f}: содержит «${w}»`);
  }
});

// Учитываем .gitignore: те же правила, что использует git (упрощённо — по шаблонам из файла)
function ignored(f) {
  const rules = read('.gitignore').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  let ign = false;
  for (const r of rules) {
    const neg = r.startsWith('!'), pat = neg ? r.slice(1) : r;
    if (globMatch(pat, f)) ign = !neg;
  }
  return ign;
}
function globMatch(pat, f) {
  if (pat.endsWith('/')) return f.startsWith(pat) || f.includes('/' + pat);
  const re = '^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*/g, '[^/]*') + '$';
  return pat.includes('/') ? new RegExp(re).test(f) : new RegExp(re).test(f.split('/').pop());
}
