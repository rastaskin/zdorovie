// Макеты для Figma: экраны приложения на синтетической медкарте → SVG (+ PNG для сверки).
// node design/export.mjs   (локально берёт системный Edge; результат в design/figma/, в git не попадает)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'figma');
const TOOL = readFileSync(path.join(here, 'dom-to-svg.js'), 'utf8');
const PORT = 8795, PASS = 'макет синтетика 2026';
mkdirSync(OUT, { recursive: true });

// Выдуманный пациент. Никаких настоящих данных: файлы уходят в облако Figma.
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const CARD = {
  card: {
    patient: { name: 'Иван Образцов', birth: '1988-04-12', height: '182 см', blood: 'II (A) Rh+', intolerance: 'Не выявлено', note: 'Синтетический пациент для макетов.' },
    problems: [
      { id: 'p1', title: 'Частые простуды', system: 'resp', status: 'Наблюдение', note: 'Около двух эпизодов в год.' },
      { id: 'p2', title: 'Повышенные триглицериды', system: 'metab', status: 'Контроль', note: 'Пересдать через три месяца.' },
      { id: 'p3', title: 'Искривление перегородки носа', system: 'nose', status: 'Без лечения', note: 'Операция не планируется.' }
    ],
    meds: [
      { id: 'm1', name: 'Тестомицин', dose: '50 мг', schedule: 'Утром', start: day(9), status: 'active', note: 'По схеме врача.' },
      { id: 'm2', name: 'Пробалин', dose: '5 мг', schedule: 'На ночь', start: day(9), status: 'active' },
      { id: 'm3', name: 'Старый препарат', status: 'stopped', note: 'Отменён.' }
    ],
    labs: [
      ...[[day(900), 141], [day(500), 150], [day(220), 146], [day(3), 128]].map(([date, value], i) => ({ id: 'hb' + i, name: 'Гемоглобин', value, unit: 'г/л', ref: '130-170', date })),
      ...[[day(500), 1.4], [day(220), 2.3]].map(([date, value], i) => ({ id: 'tg' + i, name: 'Триглицериды', value, unit: 'ммоль/л', ref: '<1.7', date })),
      { id: 'vd', name: '25-OH витамин D', value: 18, unit: 'нг/мл', ref: '30-100', date: day(220) },
      { id: 'tsh', name: 'ТТГ', value: 2.1, unit: 'мкМЕ/мл', ref: '0.27-4.2', date: day(220) },
      { id: 'crp', name: 'С-реактивный белок', value: 1.2, unit: 'мг/л', ref: '<5', date: day(3) }
    ],
    studies: [
      { id: 's1', date: day(5), type: 'Рентген грудной клетки', place: 'Поликлиника', conclusion: 'Патологических изменений не выявлено.' },
      { id: 's2', date: day(400), type: 'ЭКГ', place: 'Поликлиника', conclusion: 'Синусовый ритм, ЧСС 68.' }
    ],
    visits: [
      { id: 'v1', date: day(7), specialty: 'Терапевт', doctor: 'Петров П. П.', place: 'Поликлиника', summary: 'ОРВИ. Назначены анализы крови и рентген.' },
      { id: 'v2', date: day(60), specialty: 'ЛОР', doctor: '', place: 'Поликлиника', summary: 'Искривление перегородки. Наблюдение.' }
    ],
    recs: [
      { id: 'r1', system: 'resp', priority: 1, title: 'Бросить курить', text: 'Главное, что снизит число простуд.' },
      { id: 'r2', system: 'metab', priority: 2, title: 'Пересдать липидограмму', text: 'Через три месяца после начала лечения.' },
      { id: 'r3', system: 'blood', priority: 3, title: 'Витамин D', text: 'Пересдать осенью.' }
    ],
    private: { screening: [{ name: 'AUDIT-C', value: '2', note: 'Низкий риск' }], substances: 'Курение, 10 сигарет в день.', family: 'Отец — гипертония.', plan: 'Наблюдение у терапевта.' }
  },
  tasks: [
    { id: 't1', title: 'Сдать анализы крови', system: 'blood', type: 'Анализ', due: day(4), xp: 30, ach: 'Кровь расшифрована', details: 'Натощак, утром.' },
    { id: 't2', title: 'Записаться к кардиологу', system: 'heart', type: 'Запись', due: day(-5), xp: 40, ach: 'Сердце на экране' },
    { id: 't3', title: 'Спирометрия', system: 'resp', type: 'Исследование', due: day(-40), xp: 40 },
    { id: 't4', title: 'Позвонить врачу', system: 'psych', type: 'Звонок', xp: 20 },
    { id: 't5', title: 'Первое взвешивание', system: 'metab', type: 'Замер', xp: 20, done: day(30), trigger: 'weight' },
    { id: 't6', title: 'Прививка от гриппа', system: 'resp', type: 'Процедура', xp: 30, done: day(12) }
  ],
  habits: [{ id: 'a', label: 'Таблетка утром', xp: 5, med: true }, { id: 'b', label: 'Таблетка на ночь', xp: 5, med: true }, { id: 'c', label: 'Прогулка 20+ минут', xp: 5 }, { id: 'd', label: 'Три приёма пищи', xp: 5 }],
  daily: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [day(i + 1), { h: { a: i % 5 !== 0, b: i % 4 !== 0, c: i % 2 === 0, d: i % 3 !== 0 }, mood: 2 + (i * 7 % 4), sleep: 2 + (i * 5 % 4), can: ['none', 'less', 'usual', 'none'][i % 4] }])),
  weights: [[day(30), 78.4], [day(21), 78.9], [day(14), 79.3], [day(7), 79.1]].map(([date, kg]) => ({ date, kg, waist: 86 })),
  phq: [{ date: day(28), score: 14, items: [2, 2, 2, 1, 2, 1, 2, 1, 1] }, { date: day(14), score: 10, items: [1, 2, 1, 1, 1, 1, 2, 1, 0] }],
  backups: [day(20), day(10)],
  settings: { trackLabel: 'Трекер привычки', trackHint: 'Честная отметка видна только вам.' },
  safety: { doctor: 'Петров П. П., терапевт', contact: 'Мария, сестра', helps: 'Выйти на улицу, позвонить другу.' }
};

const SCREENS = [
  ['01-приветствие', async p => {}],
  ['02-сегодня', async p => { await p.click('[data-act="tab"][data-tab="today"]'); }],
  ['03-задачи', async p => { await p.click('[data-act="tab"][data-tab="tasks"]'); }],
  ['04-медкарта-сводка', async p => { await p.click('[data-act="tab"][data-tab="card"]'); await p.click('[data-act="seg"][data-v="summary"]'); }],
  ['05-медкарта-анализы', async p => { await p.click('[data-act="seg"][data-v="labs"]'); }],
  ['06-советы', async p => { await p.click('[data-act="tab"][data-tab="advice"]'); }],
  ['07-прогресс', async p => { await p.click('[data-act="tab"][data-tab="progress"]'); }],
  ['08-окно-данные', async p => { await p.click('[data-act="tab"][data-tab="today"]'); await p.click('[data-act="data"]'); await p.waitForTimeout(700); }]
];

const srv = spawn(process.execPath, [path.join(here, '..', 'tests', 'serve.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const browser = await chromium.launch(process.env.PW_CHANNEL === 'chromium' ? {} : { channel: process.env.PW_CHANNEL || 'msedge' });
try {
  for (const [dev, width, height] of [['ПК', 1280, 860], ['iPhone', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    // Синхронизация в макетах не нужна: подменяем конфиг, чтобы не было переадресации на Google
    await ctx.route(`http://127.0.0.1:${PORT}/config.js`, r => r.fulfill({ contentType: 'text/javascript', body: 'window.ZCONFIG={};' }));
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${PORT}/`);
    for (const [name, go] of SCREENS) {
      if (name === '02-сегодня') {
        await p.click('[data-act="g-new"]'); await p.fill('#p1', PASS); await p.fill('#p2', PASS);
        await p.click('[data-act="g-setpass"]'); await p.check('#rec-ok'); await p.click('[data-act="g-recdone"]');
        await p.waitForSelector('[data-act="g-pkskip"], #file-in', { state: 'attached' });
        if (await p.$('[data-act="g-pkskip"]')) await p.click('[data-act="g-pkskip"]');
        await p.setInputFiles('#file-in', { name: 'card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(CARD)) });
        await p.waitForSelector('[data-act="habit"]');
        await p.click('[data-act="habit"][data-id="a"]'); await p.click('[data-act="mood"][data-n="4"]');
        await p.waitForTimeout(2600); // тост о XP исчезает
      }
      await go(p);
      await p.evaluate(() => window.scrollTo(0, 0));
      // кадр на всю высоту страницы, чтобы в макете был весь экран
      const full = await p.evaluate(() => document.documentElement.scrollHeight);
      const h = name === '08-окно-данные' ? height : Math.max(height, full);
      await p.setViewportSize({ width, height: h });
      await p.waitForTimeout(250);
      const svg = await p.evaluate(`(async()=>{${TOOL};return await window.__domToSvg(${JSON.stringify('Здоровье · ' + dev + ' · ' + name)}, ${name === '08-окно-данные'})})()`);
      const base = path.join(OUT, `${dev}-${name}`);
      writeFileSync(base + '.svg', svg);
      await p.screenshot({ path: base + '.png' });
      await p.setViewportSize({ width, height });
      console.log(dev, name, Math.round(svg.length / 1024) + ' КБ');
    }
    if (errs.length) console.log('ошибки страницы:', errs);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); }
