/* Переводит текущую страницу в SVG для импорта в Figma: прямоугольники с заливкой и рамкой, фоновые фактуры
   картинками, тексты — текстовыми слоями, <img> и встроенные <svg> — как есть. Запускается внутри страницы:
   const svg = await window.__domToSvg(). Только для макетов: точность «как видно глазом», не попиксельная. */
(function () {
  'use strict';
  const PSEUDO_OFF = '__svgx-nopseudo';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = v => Math.round(v * 100) / 100;
  let uid = 0;
  const id = p => p + (++uid);

  function color(c) {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return { rgb: `rgb(${p[0]},${p[1]},${p[2]})`, a };
  }
  const fillAttr = (c, k = 'fill') => c ? ` ${k}="${c.rgb}"${c.a < 1 ? ` ${k}-opacity="${n(c.a)}"` : ''}` : ` ${k}="none"`;

  /* ::before/::after → настоящие элементы, чтобы у них были размеры и место */
  function materializePseudos() {
    const st = document.createElement('style');
    st.textContent = `.${PSEUDO_OFF}::before,.${PSEUDO_OFF}::after{content:none!important}`;
    const made = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('svg')) return;
      for (const which of ['::before', '::after']) {
        const cs = getComputedStyle(el, which);
        if (!cs.content || cs.content === 'none' || cs.content === 'normal') continue;
        if (cs.display === 'none') continue;
        const sp = document.createElement('span');
        sp.setAttribute('data-svgx-pseudo', which);
        for (let i = 0; i < cs.length; i++) { const p = cs[i]; sp.style.setProperty(p, cs.getPropertyValue(p)); }
        const txt = cs.content.replace(/^["']|["']$/g, '');
        if (txt && !/^url\(/.test(cs.content) && cs.content !== '""' && cs.content !== "''") sp.textContent = txt;
        made.push([el, which, sp]);
      }
    });
    made.forEach(([el, which, sp]) => { which === '::before' ? el.prepend(sp) : el.append(sp); el.classList.add(PSEUDO_OFF); });
    document.head.append(st);
  }

  const imgCache = new Map();
  function loadImg(src) {
    if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
    return imgCache.get(src);
  }
  function toData(canvas, opaque) { return canvas.toDataURL(opaque ? 'image/jpeg' : 'image/png', 0.86); }

  /* Фон элемента: один слой url() или линейный градиент поверх цвета */
  function parseSize(v, iw, ih, w, h) {
    const p = v.split(' ');
    if (p[0] === 'cover' || p[0] === 'contain') { const s = (p[0] === 'cover' ? Math.max : Math.min)(w / iw, h / ih); return [iw * s, ih * s]; }
    const dim = (t, full) => t === 'auto' || t === undefined ? null : t.endsWith('%') ? full * parseFloat(t) / 100 : parseFloat(t);
    let tw = dim(p[0], w), th = dim(p[1], h);
    if (tw == null && th == null) return [iw, ih];
    if (tw == null) tw = iw * th / ih;
    if (th == null) th = ih * tw / iw;
    return [tw, th];
  }
  function parsePos(v, w, h, tw, th) {
    const p = v.split(' ');
    const one = (t, free) => t.endsWith('%') ? free * parseFloat(t) / 100 : parseFloat(t);
    return [one(p[0], w - tw), one(p[1] || '50%', h - th)];
  }
  async function bgImage(el, cs, r, out, defs) {
    const bi = cs.backgroundImage;
    if (!bi || bi === 'none') return;
    const lg = bi.match(/^linear-gradient\((.*)\)$/);
    if (lg) {
      const parts = lg[1].split(/,(?![^(]*\))/).map(s => s.trim());
      let ang = 180;
      if (/deg$/.test(parts[0])) ang = parseFloat(parts.shift());
      else if (/^to /.test(parts[0])) { const t = parts.shift(); ang = { 'to right': 90, 'to left': 270, 'to top': 0, 'to bottom': 180 }[t] ?? 180; }
      const stops = parts.map((s, i) => { const c = color(s); const pct = (s.match(/(\d+(\.\d+)?)%\s*$/) || [])[1]; return { c, o: pct != null ? pct / 100 : i / (parts.length - 1) }; });
      const gid = id('g'), rad = (ang - 90) * Math.PI / 180;
      const x1 = 0.5 - Math.cos(rad) / 2, y1 = 0.5 - Math.sin(rad) / 2, x2 = 0.5 + Math.cos(rad) / 2, y2 = 0.5 + Math.sin(rad) / 2;
      defs.push(`<linearGradient id="${gid}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${stops.map(s => `<stop offset="${n(s.o)}" stop-color="${s.c ? s.c.rgb : '#000'}" stop-opacity="${s.c ? n(s.c.a) : 0}"/>`).join('')}</linearGradient>`);
      out.push(`<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"${r.rx ? ` rx="${n(r.rx)}"` : ''} fill="url(#${gid})"/>`);
      return;
    }
    const um = bi.match(/url\("?([^")]+)"?\)/);
    if (!um) return;
    const img = await loadImg(um[1]).catch(() => null);
    if (!img) return;
    const [tw, th] = parseSize(cs.backgroundSize, img.naturalWidth, img.naturalHeight, r.w, r.h);
    const [px, py] = parsePos(cs.backgroundPosition, r.w, r.h, tw, th);
    const repeat = !/no-repeat/.test(cs.backgroundRepeat);
    if (!repeat) {
      const c = document.createElement('canvas'); c.width = Math.ceil(tw * 2); c.height = Math.ceil(th * 2);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      out.push(`<image x="${n(r.x + px)}" y="${n(r.y + py)}" width="${n(tw)}" height="${n(th)}" href="${toData(c, false)}" preserveAspectRatio="none"/>`);
      return;
    }
    /* повторяющаяся фактура: заливаем область элемента плиткой и кладём одной картинкой (Figma не любит <pattern>) */
    const sc = 1.5, c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(r.w * sc)); c.height = Math.max(1, Math.ceil(r.h * sc));
    const g = c.getContext('2d');
    const bc = color(cs.backgroundColor); if (bc) { g.fillStyle = cs.backgroundColor; g.fillRect(0, 0, c.width, c.height); }
    const ox = ((px % tw) + tw) % tw - tw, oy = ((py % th) + th) % th - th;
    for (let y = oy; y < r.h; y += th) for (let x = ox; x < r.w; x += tw) g.drawImage(img, x * sc, y * sc, tw * sc, th * sc);
    out.push(`<image x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" href="${toData(c, !!bc)}" preserveAspectRatio="none"/>`);
  }

  /* Рамки: border и «резные» box-shadow без смещения и размытия (0 0 0 Npx цвет) */
  function borders(cs, r, out) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => ({ w: parseFloat(cs['border' + s + 'Width']) || 0, c: color(cs['border' + s + 'Color']), st: cs['border' + s + 'Style'] }));
    const same = sides.every(s => s.w === sides[0].w && s.st === sides[0].st && s.c && sides[0].c && s.c.rgb === sides[0].c.rgb);
    const dash = st => st === 'dashed' ? ' stroke-dasharray="4 3"' : st === 'dotted' ? ' stroke-dasharray="1 2"' : '';
    if (same && sides[0].w > 0 && sides[0].st !== 'none') {
      const w = sides[0].w;
      out.push(`<rect x="${n(r.x + w / 2)}" y="${n(r.y + w / 2)}" width="${n(r.w - w)}" height="${n(r.h - w)}"${r.rx ? ` rx="${n(r.rx)}"` : ''} fill="none" stroke-width="${n(w)}"${fillAttr(sides[0].c, 'stroke')}${dash(sides[0].st)}/>`);
    } else {
      const L = [[r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h]];
      sides.forEach((s, i) => {
        if (!s.w || s.st === 'none' || !s.c) return;
        const [x1, y1, x2, y2] = L[i], d = s.w / 2, off = [[0, d], [-d, 0], [0, -d], [d, 0]][i];
        out.push(`<line x1="${n(x1 + off[0])}" y1="${n(y1 + off[1])}" x2="${n(x2 + off[0])}" y2="${n(y2 + off[1])}" stroke-width="${n(s.w)}"${fillAttr(s.c, 'stroke')}${dash(s.st)}/>`);
      });
    }
  }
  function spreadShadows(cs, r) {
    const res = [];
    if (!cs.boxShadow || cs.boxShadow === 'none') return res;
    cs.boxShadow.split(/,(?![^(]*\))/).forEach(sh => {
      if (/inset/.test(sh)) return;
      const c = color(sh), nums = (sh.replace(/rgba?\([^)]*\)/, '').match(/-?\d+(\.\d+)?px/g) || []).map(parseFloat);
      if (!c || nums.length < 4 || nums[0] || nums[1] || nums[2] || !nums[3]) return;
      res.push({ s: nums[3], c });
    });
    return res.sort((a, b) => b.s - a.s).map(({ s, c }) => `<rect x="${n(r.x - s)}" y="${n(r.y - s)}" width="${n(r.w + 2 * s)}" height="${n(r.h + 2 * s)}"${fillAttr(c)}/>`);
  }

  /* Текст: по строкам, каждая строка — отдельный <text> с базовой линией по метрикам шрифта */
  const metricCanvas = document.createElement('canvas').getContext('2d');
  function textNode(tn, out) {
    const el = tn.parentElement, cs = getComputedStyle(el);
    const fill = color(cs.color); if (!fill) return;
    const raw = tn.textContent; if (!raw.trim()) return;
    const range = document.createRange(), lines = [];
    let cur = null;
    for (let i = 0; i < raw.length; i++) {
      range.setStart(tn, i); range.setEnd(tn, i + 1);
      const rc = range.getClientRects()[0];
      if (!rc || !rc.width) { if (cur && /\s/.test(raw[i])) cur.t += raw[i]; continue; }
      if (!cur || Math.abs(rc.top - cur.top) > rc.height / 2) { cur = { top: rc.top, h: rc.height, x: rc.left, t: '', right: rc.right }; lines.push(cur); }
      cur.t += raw[i]; cur.right = rc.right;
    }
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    metricCanvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = metricCanvas.measureText('Hgу'), asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * .8, desc = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * .2;
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    let tt = cs.textTransform;
    lines.forEach(L => {
      let t = L.t.replace(/\s+/g, ' ').trimEnd(); if (!t.trim()) return;
      /* ведущий пробел оставляем: x строки стоит у него */
      if (tt === 'uppercase') t = t.toUpperCase(); else if (tt === 'lowercase') t = t.toLowerCase();
      const base = L.top + (L.h - (asc + desc)) / 2 + asc;
      out.push(`<text x="${n(L.x)}" y="${n(base)}" font-family="${esc(fam)}" font-size="${parseFloat(cs.fontSize)}" font-weight="${cs.fontWeight}"${ls ? ` letter-spacing="${n(ls)}"` : ''}${fillAttr(fill)} xml:space="preserve">${esc(t)}</text>`);
      if (/line-through/.test(cs.textDecorationLine)) out.push(`<line x1="${n(L.x)}" y1="${n(L.top + L.h * .55)}" x2="${n(L.right)}" y2="${n(L.top + L.h * .55)}" stroke-width="1"${fillAttr(fill, 'stroke')}/>`);
    });
  }
  function formValue(el, cs, r, out) {
    const v = el.tagName === 'SELECT' ? (el.selectedOptions[0] || {}).text : el.value;
    if (!v || el.type === 'checkbox' || el.type === 'file') return;
    const fill = color(cs.color), fs = parseFloat(cs.fontSize);
    const x = r.x + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), y = el.tagName === 'TEXTAREA' ? r.y + parseFloat(cs.paddingTop) + fs : r.y + r.h / 2 + fs * .35;
    const shown = el.type === 'password' ? '•'.repeat(v.length) : v;
    out.push(`<text x="${n(x)}" y="${n(y)}" font-family="${esc(cs.fontFamily.split(',')[0].replace(/["']/g, ''))}" font-size="${fs}"${fillAttr(fill)}>${esc(shown)}</text>`);
  }

  async function imgEl(el, r, out) {
    const img = await loadImg(el.currentSrc || el.src).catch(() => null); if (!img) return;
    const c = document.createElement('canvas'); c.width = Math.ceil(r.w * 2); c.height = Math.ceil(r.h * 2);
    const g = c.getContext('2d'), f = getComputedStyle(el).filter;
    /* серые неполученные достижения, приглушённые гербы: CSS-фильтр «запекаем» в картинку (тени не переносим, они вылезают за рамку) */
    if (f && f !== 'none') g.filter = f.replace(/drop-shadow\([^()]*(\([^()]*\)[^()]*)*\)/g, '').trim() || 'none';
    g.drawImage(img, 0, 0, c.width, c.height);
    out.push(`<image x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" href="${toData(c, false)}" preserveAspectRatio="none"/>`);
  }
  /* встроенный <svg> (графики, галочки): копия с вычисленными цветами вместо классов и currentColor */
  function inlineSvg(el, r, out) {
    const clone = el.cloneNode(true), src = [el, ...el.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((s, i) => {
      const cs = getComputedStyle(s), d = dst[i];
      ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity'].forEach(p => { const v = cs.getPropertyValue(p); if (v && v !== 'normal') d.setAttribute(p, v); });
      if (s.tagName === 'text') { d.setAttribute('font-family', cs.fontFamily.split(',')[0].replace(/["']/g, '')); d.setAttribute('font-size', cs.fontSize); }
      d.removeAttribute('class'); d.removeAttribute('style');
    });
    clone.setAttribute('x', n(r.x)); clone.setAttribute('y', n(r.y)); clone.setAttribute('width', n(r.w)); clone.setAttribute('height', n(r.h));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${n(r.w)} ${n(r.h)}`);
    clone.removeAttribute('aria-hidden'); clone.removeAttribute('role');
    out.push(new XMLSerializer().serializeToString(clone).replace(/ xmlns="[^"]*"/, ''));
  }

  /* Слои поверх (fixed, z-index > 0) рисуются после основного потока, как в браузере */
  let deferred = [];
  async function walk(el, out, defs, top) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (!top && (cs.position === 'fixed' || (cs.position !== 'static' && (parseInt(cs.zIndex, 10) || 0) > 0))) { deferred.push({ el, z: parseInt(cs.zIndex, 10) || 0 }); return; }
    const b = el.getBoundingClientRect();
    /* поворот (ромбы-галочки): рисуем элемент без поворота и поворачиваем группой */
    let transformOpen = '', transformClose = '', r;
    const tr = cs.transform;
    if (tr && tr !== 'none' && /matrix\(/.test(tr) && el.offsetWidth) {
      const [a, bb, c, d] = tr.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
      const w = el.offsetWidth, h = el.offsetHeight, cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (Math.abs(bb) > 1e-3 || Math.abs(c) > 1e-3) {
        transformOpen = `<g transform="translate(${n(cx)} ${n(cy)}) matrix(${n(a)} ${n(bb)} ${n(c)} ${n(d)} 0 0) translate(${n(-cx)} ${n(-cy)})">`;
        transformClose = '</g>';
        r = { x: cx - w / 2, y: cy - h / 2, w, h };
      }
    }
    r = r || { x: b.left, y: b.top, w: b.width, h: b.height };
    r.rx = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.w / 2, r.h / 2);
    const op = parseFloat(cs.opacity) < 1 ? `<g opacity="${n(parseFloat(cs.opacity))}">` : '';
    const own = [];
    if (r.w > 0 && r.h > 0) {
      own.push(...spreadShadows(cs, r));
      const bg = color(cs.backgroundColor);
      if (bg && (!cs.backgroundImage || cs.backgroundImage === 'none' || /gradient/.test(cs.backgroundImage)))
        own.push(`<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"${r.rx ? ` rx="${n(r.rx)}"` : ''}${fillAttr(bg)}/>`);
      await bgImage(el, cs, r, own, defs);
      borders(cs, r, own);
    }
    if (el.tagName === 'IMG') { await imgEl(el, r, own); return out.push(op + transformOpen + own.join('') + transformClose + (op ? '</g>' : '')); }
    if (el instanceof SVGSVGElement) { inlineSvg(el, r, own); return out.push(op + transformOpen + own.join('') + transformClose + (op ? '</g>' : '')); }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) formValue(el, cs, r, own);
    const kids = [];
    const closedDetails = el.tagName === 'DETAILS' && !el.open;
    for (const ch of el.childNodes) {
      if (closedDetails && !(ch.nodeType === 1 && ch.tagName === 'SUMMARY')) continue;
      if (ch.nodeType === 3) textNode(ch, kids);
      else if (ch.nodeType === 1 && !/^(SCRIPT|STYLE|TEMPLATE|DATALIST|OPTION)$/.test(ch.tagName)) await walk(ch, kids, defs);
    }
    let kidsStr = kids.join('');
    if (kidsStr && cs.overflowX !== 'visible' && el !== document.body && el !== document.documentElement) {
      const cid = id('c');
      defs.push(`<clipPath id="${cid}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"/></clipPath>`);
      kidsStr = `<g clip-path="url(#${cid})">${kidsStr}</g>`;
    }
    const name = el.id || (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();
    const body = own.join('') + kidsStr;
    if (body) out.push(`<g id="${esc(id(name.replace(/[^\wа-яё-]/gi, '_') + '_'))}">${op}${transformOpen}${body}${transformClose}${op ? '</g>' : ''}</g>`);
  }

  window.__domToSvg = async function (title, viewportOnly) {
    uid = 0; deferred = [];
    materializePseudos();
    await document.fonts.ready;
    const W = document.documentElement.clientWidth, H = viewportOnly ? innerHeight : Math.max(document.documentElement.scrollHeight, innerHeight);
    const out = [], defs = [];
    /* фон страницы (дерево на html) */
    const hcs = getComputedStyle(document.documentElement);
    const page = [];
    const hb = color(hcs.backgroundColor); if (hb) page.push(`<rect width="${W}" height="${H}"${fillAttr(hb)}/>`);
    await bgImage(document.documentElement, hcs, { x: 0, y: 0, w: W, h: H }, page, defs);
    try {
      await walk(document.body, out, defs);
      for (let done = 0; done < deferred.length;) {
        const batch = deferred.slice(done).sort((a, b) => a.z - b.z); done = deferred.length;
        for (const d of batch) await walk(d.el, out, defs, true);
      }
    }
    finally {
      document.querySelectorAll('[data-svgx-pseudo]').forEach(e => e.remove());
      document.querySelectorAll('.' + PSEUDO_OFF).forEach(e => e.classList.remove(PSEUDO_OFF));
      document.querySelectorAll('style').forEach(s => { if (s.textContent.includes(PSEUDO_OFF)) s.remove(); });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<title>${esc(title || document.title)}</title><defs>${defs.join('')}</defs><g id="background">${page.join('')}</g>${out.join('')}</svg>`;
  };
})();
