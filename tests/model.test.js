// Тесты модели синхронизации. Только синтетические данные.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../web/model.js');

const T0 = 1_000_000;
const clone = M.clone;

// Устройство: состояние плюс мутация через stamp, как в commit() приложения.
function edit(S, now, fn) { const prev = clone(S); fn(S); return M.stamp(prev, S, now); }

function base() {
  const S = M.blank();
  S.habits = [{ id: 'walk', label: 'Прогулка', xp: 5 }, { id: 'pill', label: 'Таблетка', xp: 5 }];
  S.tasks = [{ id: 't1', title: 'Сдать анализ', done: '' }, { id: 't2', title: 'Записаться к врачу', done: '' }];
  S.card.labs = [{ id: 'l1', name: 'Показатель А', value: 5, date: '2026-01-10' }];
  S.weights = [{ date: '2026-10-01', kg: 80 }];
  S.phq = [{ date: '2026-10-01', score: 7, items: [1, 1, 1, 1, 1, 1, 1, 0, 0] }];
  return edit(M.blank(), T0, s => Object.assign(s, clone(S)));
}
const byKey = (a, k = 'id') => Object.fromEntries(a.map(r => [r[k], r]));
// Содержимое без учёта порядка массивов: для проверки коммутативности.
function canon(S) {
  const o = clone(S);
  for (const L of M.LISTS) { const a = L.card ? o.card[L.n] : o[L.n]; a.sort((x, y) => String(x[L.k]).localeCompare(String(y[L.k]))); }
  return o;
}

test('stamp: новая и изменённая запись получают _u, неизменённая сохраняет свой', () => {
  const S = base();
  assert.equal(S.tasks[0]._u, T0);
  edit(S, T0 + 50, s => { s.tasks[1].title = 'Новое название'; });
  assert.equal(S.tasks[0]._u, T0);
  assert.equal(S.tasks[1]._u, T0 + 50);
  // Замена записи новым объектом с тем же содержимым (upsertBy) не сбрасывает _u
  edit(S, T0 + 60, s => { s.weights[0] = { date: '2026-10-01', kg: 80 }; });
  assert.equal(S.weights[0]._u, T0);
  // Объекты верхнего уровня
  edit(S, T0 + 70, s => { s.safety.doctor = 'Доктор Тест'; });
  assert.equal(S.safety._u, T0 + 70);
  assert.equal(S.settings._u, undefined);
});

test('stamp: _u растёт, даже если часы устройства отстают', () => {
  const S = base();
  edit(S, T0 - 5000, s => { s.tasks[0].title = 'x'; });
  assert.ok(S.tasks[0]._u > T0);
});

test('снятая отметка дня распространяется', () => {
  const A = base();
  edit(A, T0 + 10, s => { s.daily['2026-10-20'] = { h: { walk: true, pill: true } }; });
  let B = M.merge(base(), A);
  assert.equal(B.daily['2026-10-20'].h.pill, true);
  edit(B, T0 + 20, s => { s.daily['2026-10-20'].h.pill = false; });
  const A2 = M.merge(A, B);
  assert.equal(A2.daily['2026-10-20'].h.pill, false);
  assert.equal(A2.daily['2026-10-20'].h.walk, true);
});

test('снятая отметка задачи распространяется', () => {
  const A = base();
  edit(A, T0 + 10, s => { s.tasks[0].done = '2026-10-20'; });
  const B = M.merge(base(), A);
  assert.equal(byKey(B.tasks).t1.done, '2026-10-20');
  edit(B, T0 + 20, s => { byKey(s.tasks).t1.done = ''; });
  assert.equal(byKey(M.merge(A, B).tasks).t1.done, '');
});

test('удаление распространяется в обе стороны', () => {
  const A = base(), B = base();
  edit(A, T0 + 10, s => { s.tasks = s.tasks.filter(t => t.id !== 't2'); s.habits = s.habits.filter(h => h.id !== 'pill'); s.card.labs = []; });
  assert.ok(A.tomb['tasks:t2'] >= T0 + 10);
  for (const R of [M.merge(A, B), M.merge(B, A)]) {
    assert.deepEqual(R.tasks.map(t => t.id), ['t1']);
    assert.deepEqual(R.habits.map(h => h.id), ['walk']);
    assert.equal(R.card.labs.length, 0);
  }
});

test('удаление замера по дате: веса и PHQ с одной датой не путаются', () => {
  const A = base(), B = base();
  edit(A, T0 + 10, s => { s.weights = []; });
  assert.ok(A.tomb['weights:2026-10-01']);
  assert.equal(A.tomb['phq:2026-10-01'], undefined);
  const R = M.merge(B, A);
  assert.equal(R.weights.length, 0);
  assert.equal(R.phq.length, 1);
});

test('правка на двух устройствах: побеждает более поздняя, разные записи не теряются', () => {
  const A = base(), B = base();
  edit(A, T0 + 10, s => { s.tasks[0].title = 'A'; s.tasks[1].title = 'A2'; });
  edit(B, T0 + 20, s => { s.tasks[0].title = 'B'; s.card.labs[0].value = 6; });
  for (const R of [M.merge(A, B), M.merge(B, A)]) {
    const t = byKey(R.tasks);
    assert.equal(t.t1.title, 'B');
    assert.equal(t.t2.title, 'A2');
    assert.equal(R.card.labs[0].value, 6);
  }
});

test('надгробие против более поздней правки: правка побеждает', () => {
  const A = base(), B = base();
  edit(A, T0 + 10, s => { s.tasks = s.tasks.filter(t => t.id !== 't1'); });
  edit(B, T0 + 20, s => { s.tasks[0].title = 'Правка после удаления'; });
  for (const R of [M.merge(A, B), M.merge(B, A)]) assert.equal(byKey(R.tasks).t1.title, 'Правка после удаления');
});

test('надгробие новее правки: запись удалена', () => {
  const A = base(), B = base();
  edit(B, T0 + 10, s => { s.tasks[0].title = 'Правка'; });
  edit(A, T0 + 20, s => { s.tasks = s.tasks.filter(t => t.id !== 't1'); });
  for (const R of [M.merge(A, B), M.merge(B, A)]) assert.equal(byKey(R.tasks).t1, undefined);
});

test('повторное создание после удаления побеждает надгробие', () => {
  const A = base();
  edit(A, T0 + 10, s => { s.weights = []; });
  edit(A, T0 + 20, s => { s.weights.push({ date: '2026-10-01', kg: 79 }); });
  assert.equal(A.tomb['weights:2026-10-01'], undefined);
  const R = M.merge(base(), A);
  assert.equal(R.weights[0].kg, 79);
});

test('идемпотентность и коммутативность слияния', () => {
  const A = base(), B = base();
  edit(A, T0 + 10, s => { s.daily['2026-10-19'] = { h: { walk: true }, mood: 4 }; s.tasks.pop(); s.backups.push('2026-10-19'); });
  edit(B, T0 + 20, s => { s.daily['2026-10-20'] = { h: { pill: true } }; s.tasks[0].done = '2026-10-20'; s.backups.push('2026-10-20'); s.settings.autolock = 15; });
  const AB = M.merge(A, B), BA = M.merge(B, A);
  assert.deepEqual(canon(AB), canon(BA));
  assert.deepEqual(M.merge(AB, B), AB);
  assert.deepEqual(M.merge(AB, A), AB);
  assert.deepEqual(M.merge(AB, AB), AB);
  assert.deepEqual(M.merge(M.merge(AB, BA), AB), AB);
  assert.deepEqual(AB.backups, ['2026-10-19', '2026-10-20']);
  assert.equal(AB.settings.autolock, 15);
});

test('слияние не меняет входные состояния', () => {
  const A = base(), B = base();
  edit(B, T0 + 10, s => { s.tasks = []; });
  const a = JSON.stringify(A), b = JSON.stringify(B);
  M.merge(A, B);
  assert.equal(JSON.stringify(A), a);
  assert.equal(JSON.stringify(B), b);
});

test('миграция: записи без _u считаются 0 и не теряют отметок', () => {
  const old = M.blank();
  old.tasks = [{ id: 't1', title: 'Старая', done: '' }];
  old.daily = { '2026-09-01': { h: { walk: true } } };
  const other = clone(old);
  other.tasks[0].done = '2026-09-02';
  other.daily['2026-09-01'].h = { pill: true };
  const AB = M.merge(old, other), BA = M.merge(other, old);
  assert.deepEqual(AB, BA);
  assert.equal(AB.tasks[0].done, '2026-09-02');
  assert.deepEqual(AB.daily['2026-09-01'].h, { walk: true, pill: true });
  assert.deepEqual(M.merge(AB, old), AB);
  // Любая новая правка (_u > 0) побеждает старые данные, надгробие тоже
  const C = clone(old);
  edit(C, T0, s => { s.tasks = []; });
  assert.equal(M.merge(other, C).tasks.length, 0);
});

test('миграция: записям без id выдаётся одинаковый id на всех устройствах', () => {
  const raw = { card: { meds: [{ name: 'Препарат Х', dose: '10 мг' }, { name: 'Препарат Х', dose: '10 мг' }] } };
  const a = M.normalize(raw), b = M.normalize(clone(raw));
  assert.deepEqual(a.card.meds.map(m => m.id), b.card.meds.map(m => m.id));
  assert.notEqual(a.card.meds[0].id, a.card.meds[1].id);
  assert.equal(M.merge(a, b).card.meds.length, 2);
});

test('импорт от Claude: добавляет, не затирает отметки, ставит _u = now', () => {
  const S = base();
  edit(S, T0 + 10, s => { s.tasks[0].done = '2026-10-20'; s.daily['2026-10-20'] = { h: { pill: true } }; });
  const plain = {
    tasks: [{ id: 't1', title: 'Сдать анализ (уточнено)', done: '' }, { id: 't3', title: 'Новая задача' }],
    card: { labs: [{ id: 'l2', name: 'Показатель Б', value: 1, date: '2026-10-15' }], patient: { name: 'Тест' } },
    daily: { '2026-10-20': { h: { walk: true } } }
  };
  const NOW = T0 + 100;
  M.importPlain(S, plain, NOW);
  const t = byKey(S.tasks);
  assert.equal(t.t1.done, '2026-10-20');
  assert.equal(t.t1.title, 'Сдать анализ (уточнено)');
  assert.equal(t.t1._u, NOW);
  assert.equal(t.t3._u, NOW);
  assert.equal(t.t2._u, T0);
  assert.equal(byKey(S.card.labs).l2._u, NOW);
  assert.equal(S.card.patient._u, NOW);
  assert.deepEqual(S.daily['2026-10-20'].h, { pill: true, walk: true });
  assert.equal(S.daily['2026-10-20']._u, NOW);
});

test('импорт от Claude не воскрешает удалённое пользователем', () => {
  const S = base();
  edit(S, T0 + 10, s => { s.tasks = s.tasks.filter(t => t.id !== 't2'); });
  M.importPlain(S, { tasks: [{ id: 't2', title: 'Записаться к врачу' }] }, T0 + 20);
  assert.equal(byKey(S.tasks).t2, undefined);
});

test('импорт-патч дополняет поля существующих записей и не создаёт пустых', () => {
  const S = base();
  edit(S, T0 + 10, s => { s.tasks[0].done = '2026-10-20'; });
  M.importPlain(S, { tasks: [{ id: 't1', ach: 'Награда' }, { id: 'нет-такой', ach: 'X' }], habits: [{ id: 'pill', med: true }, { id: 'нет', med: true }] }, T0 + 20);
  const t = byKey(S.tasks);
  assert.equal(t.t1.ach, 'Награда');
  assert.equal(t.t1.title, 'Сдать анализ');
  assert.equal(t.t1.done, '2026-10-20');
  assert.equal(t['нет-такой'], undefined);
  assert.equal(byKey(S.habits).pill.med, true);
  assert.equal(byKey(S.habits).pill.label, 'Таблетка');
  assert.equal(S.habits.length, 2);
});
