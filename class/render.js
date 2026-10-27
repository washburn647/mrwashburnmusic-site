/* Draws one slide of a deck as HTML and SVG on a fixed 960 x 540 stage.
   The caller scales the stage to fit (a TV, a thumbnail, the editor). */

const PX_PER_PT = 960 / 720;
const SVG = 'http://www.w3.org/2000/svg';
let uid = 0;

// Fonts the decks use, with the stand-in each falls back to where the
// original isn't installed (Chromebooks have no Comic Sans).
const FONT_STACKS = {
  'comic sans ms': '"Comic Sans MS", "Comic Neue", cursive',
  'comic neue': '"Comic Neue", "Comic Sans MS", cursive',
  'arial': 'Arial, "Liberation Sans", Helvetica, sans-serif',
  'times new roman': '"Times New Roman", "Liberation Serif", Times, serif'
};

export function fontStack(name) {
  const key = String(name || 'Arial').toLowerCase();
  return FONT_STACKS[key] || '"' + name.replace(/"/g, '') + '", Arial, sans-serif';
}

/**
 * opts.media(hash) -> URL for a picture
 * opts.onLink(link, event) -> called when a linked element is clicked
 */
export function renderSlide(slide, deck, opts = {}) {
  const stage = document.createElement('div');
  stage.className = 'slide-stage';
  stage.style.width = deck.w + 'px';
  stage.style.height = deck.h + 'px';
  paintBackground(stage, slide.bg, opts);
  for (const el of slide.els) {
    const node = el.t === 'pic' ? drawPicture(el, opts) : drawShape(el, opts);
    if (!node) continue;
    if (el.link) makeLink(node, el.link, opts);
    stage.appendChild(node);
  }
  return stage;
}

function paintBackground(stage, bg, opts) {
  if (!bg) { stage.style.background = '#fff'; return; }
  if (bg.type === 'solid') stage.style.background = bg.color;
  else if (bg.type === 'linear') stage.style.background = cssGradient(bg);
  else if (bg.type === 'radial') stage.style.background =
    'radial-gradient(circle, ' + bg.stops.map((s) => s.color + ' ' + s.pos + '%').join(', ') + ')';
  else if (bg.type === 'image' && opts.media) {
    stage.style.backgroundColor = '#fff';
    stage.style.backgroundImage = 'url("' + opts.media(bg.media) + '")';
    stage.style.backgroundSize = bg.tile ? 'auto' : '100% 100%';
    stage.style.backgroundRepeat = bg.tile ? 'repeat' : 'no-repeat';
  }
}

function cssGradient(f) {
  return 'linear-gradient(' + (f.angle + 90) + 'deg, ' +
    f.stops.map((s) => s.color + ' ' + s.pos + '%').join(', ') + ')';
}

function box(el) {
  const d = document.createElement('div');
  d.className = 'el';
  d.style.left = el.x + 'px';
  d.style.top = el.y + 'px';
  d.style.width = Math.max(el.w, 0) + 'px';
  d.style.height = Math.max(el.h, 0) + 'px';
  const t = [];
  if (el.rot) t.push('rotate(' + el.rot + 'deg)');
  if (el.flipH) t.push('scaleX(-1)');
  if (el.flipV) t.push('scaleY(-1)');
  if (t.length) d.style.transform = t.join(' ');
  return d;
}

function makeLink(node, link, opts) {
  node.classList.add('link');
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    if (opts.onLink) opts.onLink(link, e);
  });
}

// ---- pictures ------------------------------------------------------------

function drawPicture(el, opts) {
  const d = box(el);
  d.classList.add('pic');
  const img = document.createElement('img');
  img.alt = el.alt || '';
  img.draggable = false;
  img.decoding = 'async';
  if (opts.media) img.src = opts.media(el.media);
  const [l, t, r, b] = el.crop || [0, 0, 0, 0];
  const fw = 1 - l - r, fh = 1 - t - b;
  const iw = el.w / (fw || 1), ih = el.h / (fh || 1);
  img.style.width = iw + 'px';
  img.style.height = ih + 'px';
  img.style.left = -l * iw + 'px';
  img.style.top = -t * ih + 'px';
  d.appendChild(img);
  if (el.alpha != null) d.style.opacity = el.alpha;
  if (el.geom === 'ellipse') d.style.borderRadius = '50%';
  else if (el.geom === 'roundRect') d.style.borderRadius = roundRadius(el) + 'px';
  else if (el.geom && el.geom !== 'rect') {
    const path = geometry(el.geom, el.w, el.h, el.adj || {}, el.path).fill;
    d.style.clipPath = 'path("' + path + '")';
  }
  if (el.line) {
    d.style.outline = el.line.width + 'px solid ' + el.line.color;
    d.style.outlineOffset = -el.line.width / 2 + 'px';
  }
  return d;
}

// ---- shapes ----------------------------------------------------------------

function drawShape(el, opts) {
  const d = box(el);
  d.classList.add('sp');
  const hasPaint = (el.fill && el.fill.type !== 'none') || el.line;
  if (hasPaint) d.appendChild(shapeSvg(el, opts));
  if (el.text) d.appendChild(drawText(el, opts));
  return d;
}

function shapeSvg(el, opts) {
  const w = Math.max(el.w, 0.01), h = Math.max(el.h, 0.01);
  const pad = el.line ? el.line.width + 8 : 0;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'paint');
  svg.setAttribute('width', w + 2 * pad);
  svg.setAttribute('height', h + 2 * pad);
  svg.setAttribute('viewBox', [-pad, -pad, w + 2 * pad, h + 2 * pad].join(' '));
  svg.style.left = -pad + 'px';
  svg.style.top = -pad + 'px';
  const g = geometry(el.geom, w, h, el.adj || {}, el.path);
  const defs = document.createElementNS(SVG, 'defs');
  svg.appendChild(defs);

  const fillPaint = paint(el.fill, defs, w, h, g.fill, opts);
  const main = document.createElementNS(SVG, 'path');
  main.setAttribute('d', g.fill);
  main.setAttribute('fill', g.open ? 'none' : fillPaint.fill);
  if (fillPaint.image) svg.appendChild(fillPaint.image);
  if (el.line) {
    main.setAttribute('stroke', el.line.color);
    main.setAttribute('stroke-width', el.line.width);
    main.setAttribute('stroke-linejoin', 'round');
    if (el.line.dash) main.setAttribute('stroke-dasharray', dash(el.line.dash, el.line.width));
    if (el.line.head || el.line.tail) arrowHeads(main, el.line, defs);
  } else {
    main.setAttribute('stroke', 'none');
  }
  svg.appendChild(main);
  // Shading facets (bevel, can, folded corner) sit over the fill.
  for (const f of g.shades || []) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', f.d);
    p.setAttribute('fill', f.dark ? 'rgba(0,0,0,' + f.dark + ')' : 'rgba(255,255,255,' + f.light + ')');
    if (el.line) {
      p.setAttribute('stroke', el.line.color);
      p.setAttribute('stroke-width', el.line.width);
      p.setAttribute('stroke-linejoin', 'round');
    }
    svg.appendChild(p);
  }
  return svg;
}

function paint(fill, defs, w, h, clipD, opts) {
  if (!fill || fill.type === 'none') return { fill: 'none' };
  if (fill.type === 'solid') return { fill: fill.color };
  const id = 'g' + (++uid);
  if (fill.type === 'linear' || fill.type === 'radial') {
    const grad = document.createElementNS(SVG, fill.type === 'linear' ? 'linearGradient' : 'radialGradient');
    grad.setAttribute('id', id);
    if (fill.type === 'linear') {
      grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0.5');
      grad.setAttribute('x2', '1'); grad.setAttribute('y2', '0.5');
      grad.setAttribute('gradientTransform', 'rotate(' + fill.angle + ' 0.5 0.5)');
    }
    for (const s of fill.stops) {
      const stop = document.createElementNS(SVG, 'stop');
      stop.setAttribute('offset', s.pos + '%');
      stop.setAttribute('stop-color', s.color);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
    return { fill: 'url(#' + id + ')' };
  }
  if (fill.type === 'image' && opts.media) {
    const clip = document.createElementNS(SVG, 'clipPath');
    clip.setAttribute('id', id);
    const cp = document.createElementNS(SVG, 'path');
    cp.setAttribute('d', clipD);
    clip.appendChild(cp);
    defs.appendChild(clip);
    const img = document.createElementNS(SVG, 'image');
    img.setAttribute('href', opts.media(fill.media));
    img.setAttribute('width', w);
    img.setAttribute('height', h);
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('clip-path', 'url(#' + id + ')');
    if (fill.alpha != null) img.setAttribute('opacity', fill.alpha);
    return { fill: 'none', image: img };
  }
  return { fill: 'none' };
}

function dash(kind, w) {
  const u = Math.max(w, 1);
  const map = { dot: [1, 2], sysDot: [1, 1], dash: [4, 3], sysDash: [3, 1], lgDash: [8, 3],
    dashDot: [4, 3, 1, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDot: [3, 1, 1, 1] };
  return (map[kind] || [4, 3]).map((v) => v * u).join(' ');
}

function arrowHeads(path, line, defs) {
  for (const end of ['head', 'tail']) {
    if (!line[end]) continue;
    const id = 'm' + (++uid);
    const m = document.createElementNS(SVG, 'marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '5');
    m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '4');
    m.setAttribute('markerHeight', '4');
    m.setAttribute('orient', 'auto-start-reverse');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', line[end] === 'oval' ? 'M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z' : 'M0 0L10 5L0 10Z');
    p.setAttribute('fill', line.color);
    m.appendChild(p);
    defs.appendChild(m);
    path.setAttribute(end === 'head' ? 'marker-start' : 'marker-end', 'url(#' + id + ')');
  }
}

function roundRadius(el) {
  const a = el.adj && el.adj.adj != null ? el.adj.adj : 16667;
  return Math.min(el.w, el.h) * a / 100000;
}

// ---- preset geometry ---------------------------------------------------------

/** SVG path data for a preset shape, in a w x h box. */
export function geometry(prst, w, h, adj, custom) {
  const ss = Math.min(w, h);
  const A = (name, d) => (adj[name] != null ? adj[name] : d) / 100000;
  const P = (pts) => 'M' + pts.map((p) => r(p[0]) + ' ' + r(p[1])).join('L') + 'Z';
  const rect = P([[0, 0], [w, 0], [w, h], [0, h]]);
  const ellipse = (cx, cy, rx, ry) => 'M' + r(cx - rx) + ' ' + r(cy) +
    'A' + r(rx) + ' ' + r(ry) + ' 0 1 1 ' + r(cx + rx) + ' ' + r(cy) +
    'A' + r(rx) + ' ' + r(ry) + ' 0 1 1 ' + r(cx - rx) + ' ' + r(cy) + 'Z';
  const rounded = (rad) => {
    const k = Math.min(rad, w / 2, h / 2);
    return 'M' + r(k) + ' 0H' + r(w - k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 ' + r(w) + ' ' + r(k) +
      'V' + r(h - k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 ' + r(w - k) + ' ' + r(h) +
      'H' + r(k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 0 ' + r(h - k) +
      'V' + r(k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 ' + r(k) + ' 0Z';
  };
  switch (prst) {
    case 'custom': return { fill: custom || rect };
    case 'rect': case 'flowChartProcess': case 'snip1Rect': return { fill: rect };
    case 'roundRect': case 'flowChartAlternateProcess': return { fill: rounded(ss * A('adj', 16667)) };
    case 'round2SameRect': {
      const k = Math.min(ss * A('adj1', 16667), w / 2, h / 2);
      return { fill: 'M' + r(k) + ' 0H' + r(w - k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 ' + r(w) + ' ' + r(k) +
        'V' + r(h) + 'H0V' + r(k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 1 ' + r(k) + ' 0Z' };
    }
    case 'ellipse': case 'flowChartConnector': return { fill: ellipse(w / 2, h / 2, w / 2, h / 2) };
    case 'triangle': { const x = w * A('adj', 50000); return { fill: P([[x, 0], [w, h], [0, h]]) }; }
    case 'rtTriangle': return { fill: P([[0, 0], [w, h], [0, h]]) };
    case 'diamond': case 'flowChartDecision': return { fill: P([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) };
    case 'parallelogram': { const x = ss * A('adj', 25000); return { fill: P([[x, 0], [w, 0], [w - x, h], [0, h]]) }; }
    case 'trapezoid': { const x = ss * A('adj', 25000); return { fill: P([[x, 0], [w - x, 0], [w, h], [0, h]]) }; }
    case 'pentagon': case 'homePlate': { const x = w - ss * A('adj', 50000); return { fill: P([[0, 0], [x, 0], [w, h / 2], [x, h], [0, h]]) }; }
    case 'chevron': { const x = ss * A('adj', 50000); return { fill: P([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]]) }; }
    case 'hexagon': { const x = ss * A('adj', 25000); return { fill: P([[x, 0], [w - x, 0], [w, h / 2], [w - x, h], [x, h], [0, h / 2]]) }; }
    case 'octagon': {
      const x = ss * A('adj', 29289);
      return { fill: P([[x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x], [0, x]]) };
    }
    case 'plaque': {
      const k = ss * A('adj', 16667);
      return { fill: 'M' + r(k) + ' 0H' + r(w - k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 0 ' + r(w) + ' ' + r(k) +
        'V' + r(h - k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 0 ' + r(w - k) + ' ' + r(h) + 'H' + r(k) +
        'A' + r(k) + ' ' + r(k) + ' 0 0 0 0 ' + r(h - k) + 'V' + r(k) + 'A' + r(k) + ' ' + r(k) + ' 0 0 0 ' + r(k) + ' 0Z' };
    }
    case 'rightArrow': case 'leftArrow': case 'notchedRightArrow': {
      const sh = h * A('adj1', 50000) / 2, head = ss * A('adj2', 50000);
      const notch = prst === 'notchedRightArrow' ? (h / 2 - sh) * head / (h / 2) : 0;
      const pts = [[0, h / 2 - sh], [w - head, h / 2 - sh], [w - head, 0], [w, h / 2], [w - head, h],
        [w - head, h / 2 + sh], [0, h / 2 + sh]];
      if (notch) pts.push([notch, h / 2]);
      return { fill: P(prst === 'leftArrow' ? pts.map(([x, y]) => [w - x, y]) : pts) };
    }
    case 'upArrow': case 'downArrow': {
      const sw = w * A('adj1', 50000) / 2, head = ss * A('adj2', 50000);
      const pts = [[w / 2 - sw, h], [w / 2 - sw, head], [0, head], [w / 2, 0], [w, head], [w / 2 + sw, head], [w / 2 + sw, h]];
      return { fill: P(prst === 'downArrow' ? pts.map(([x, y]) => [x, h - y]) : pts) };
    }
    case 'leftRightArrow': {
      const sh = h * A('adj1', 50000) / 2, head = ss * A('adj2', 50000);
      return { fill: P([[0, h / 2], [head, 0], [head, h / 2 - sh], [w - head, h / 2 - sh], [w - head, 0], [w, h / 2],
        [w - head, h], [w - head, h / 2 + sh], [head, h / 2 + sh], [head, h]]) };
    }
    case 'quadArrow': {
      const a1 = ss * A('adj1', 22500) / 2, a2 = ss * A('adj2', 22500), a3 = ss * A('adj3', 22500);
      const cx = w / 2, cy = h / 2;
      return { fill: P([[0, cy], [a3, cy - a2], [a3, cy - a1], [cx - a1, cy - a1], [cx - a1, a3], [cx - a2, a3],
        [cx, 0], [cx + a2, a3], [cx + a1, a3], [cx + a1, cy - a1], [w - a3, cy - a1], [w - a3, cy - a2],
        [w, cy], [w - a3, cy + a2], [w - a3, cy + a1], [cx + a1, cy + a1], [cx + a1, h - a3], [cx + a2, h - a3],
        [cx, h], [cx - a2, h - a3], [cx - a1, h - a3], [cx - a1, cy + a1], [a3, cy + a1], [a3, cy + a2]]) };
    }
    case 'bevel': {
      const k = ss * A('adj', 12500);
      const inner = [[k, k], [w - k, k], [w - k, h - k], [k, h - k]];
      return {
        fill: rect,
        shades: [
          { d: P([[0, 0], [w, 0], inner[1], inner[0]]), light: 0.4 },
          { d: P([[0, 0], inner[0], inner[3], [0, h]]), light: 0.2 },
          { d: P([[w, 0], [w, h], inner[2], inner[1]]), dark: 0.2 },
          { d: P([[0, h], inner[3], inner[2], [w, h]]), dark: 0.4 }
        ]
      };
    }
    case 'can': case 'flowChartMagneticDisk': {
      const ry = ss * A('adj', 25000) / 2;
      return {
        fill: 'M0 ' + r(ry) + 'A' + r(w / 2) + ' ' + r(ry) + ' 0 0 1 ' + r(w) + ' ' + r(ry) + 'V' + r(h - ry) +
          'A' + r(w / 2) + ' ' + r(ry) + ' 0 0 1 0 ' + r(h - ry) + 'Z',
        shades: [{ d: ellipse(w / 2, ry, w / 2, ry), light: 0.25 }]
      };
    }
    case 'foldedCorner': {
      const k = ss * A('adj', 16667);
      return { fill: P([[0, 0], [w, 0], [w, h - k], [w - k, h], [0, h]]),
        shades: [{ d: P([[w, h - k], [w - k * 0.8, h - k * 0.8], [w - k, h]]), dark: 0.2 }] };
    }
    case 'donut': {
      const t = ss * A('adj', 25000);
      return { fill: ellipse(w / 2, h / 2, w / 2, h / 2) + ' ' + ellipse(w / 2, h / 2, w / 2 - t, h / 2 - t) };
    }
    case 'noSmoking': {
      const t = ss * A('adj', 18750);
      return { fill: ellipse(w / 2, h / 2, w / 2, h / 2) + ' ' + ellipse(w / 2, h / 2, w / 2 - t, h / 2 - t) +
        ' M' + r(w * 0.2) + ' ' + r(h * 0.15) + 'L' + r(w * 0.85) + ' ' + r(h * 0.8) +
        'L' + r(w * 0.8) + ' ' + r(h * 0.85) + 'L' + r(w * 0.15) + ' ' + r(h * 0.2) + 'Z' };
    }
    case 'chord': {
      return { fill: 'M' + r(w / 2 + w / 2 * Math.cos(-0.785)) + ' ' + r(h / 2 + h / 2 * Math.sin(-0.785)) +
        'A' + r(w / 2) + ' ' + r(h / 2) + ' 0 1 1 ' + r(w / 2 + w / 2 * Math.cos(1.57)) + ' ' + r(h) + 'Z' };
    }
    case 'flowChartSummingJunction': {
      const d = 0.3536;
      return { fill: ellipse(w / 2, h / 2, w / 2, h / 2) + 'M' + r(w * (0.5 - d)) + ' ' + r(h * (0.5 - d)) +
        'L' + r(w * (0.5 + d)) + ' ' + r(h * (0.5 + d)) + 'M' + r(w * (0.5 + d)) + ' ' + r(h * (0.5 - d)) +
        'L' + r(w * (0.5 - d)) + ' ' + r(h * (0.5 + d)) };
    }
    case 'flowChartPunchedTape': {
      const a = h * 0.1;
      return { fill: 'M0 ' + r(a) + 'Q' + r(w / 4) + ' ' + r(3 * a) + ' ' + r(w / 2) + ' ' + r(a) +
        'T' + r(w) + ' ' + r(a) + 'V' + r(h - a) + 'Q' + r(w * 3 / 4) + ' ' + r(h - 3 * a) + ' ' + r(w / 2) + ' ' + r(h - a) +
        'T0 ' + r(h - a) + 'Z' };
    }
    case 'star5': case 'star6': case 'star4': case 'star8': {
      const n = Number(prst.slice(4));
      const inner = prst === 'star5' ? 0.382 : prst === 'star4' ? 0.25 : prst === 'star6' ? 0.5 : 0.7;
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / n;
        const k = i % 2 ? inner : 1;
        pts.push([w / 2 + Math.cos(ang) * w / 2 * k, h / 2 + Math.sin(ang) * h / 2 * k]);
      }
      return { fill: P(pts) };
    }
    case 'heart': {
      return { fill: 'M' + r(w / 2) + ' ' + r(h * 0.25) + 'C' + r(w / 2) + ' 0 0 0 0 ' + r(h * 0.3) +
        'C0 ' + r(h * 0.6) + ' ' + r(w / 2) + ' ' + r(h * 0.8) + ' ' + r(w / 2) + ' ' + r(h) +
        'C' + r(w / 2) + ' ' + r(h * 0.8) + ' ' + r(w) + ' ' + r(h * 0.6) + ' ' + r(w) + ' ' + r(h * 0.3) +
        'C' + r(w) + ' 0 ' + r(w / 2) + ' 0 ' + r(w / 2) + ' ' + r(h * 0.25) + 'Z' };
    }
    case 'cloud': case 'cloudCallout': {
      // Puffs around an ellipse: close to PowerPoint's cloud at classroom distances.
      const puffs = 9;
      let d = '';
      for (let i = 0; i <= puffs; i++) {
        const ang = Math.PI + i * 2 * Math.PI / puffs;
        const x = w / 2 + Math.cos(ang) * w * 0.4, y = h / 2 + Math.sin(ang) * h * 0.36;
        if (i === 0) d += 'M' + r(x) + ' ' + r(y);
        else d += 'A' + r(w * 0.17) + ' ' + r(h * 0.2) + ' 0 0 1 ' + r(x) + ' ' + r(y);
      }
      return { fill: d + 'Z' };
    }
    case 'wedgeRectCallout': case 'wedgeRoundRectCallout': case 'wedgeEllipseCallout': {
      const tx = w / 2 + w * A('adj1', -20833), ty = h / 2 + h * A('adj2', 62500);
      const body = prst === 'wedgeEllipseCallout' ? ellipse(w / 2, h / 2, w / 2, h / 2)
        : prst === 'wedgeRoundRectCallout' ? rounded(ss * A('adj3', 16667)) : rect;
      const bx = Math.min(Math.max(tx, w * 0.2), w * 0.8);
      const by = ty > h ? h : ty < 0 ? 0 : h / 2;
      const tail = ty > h || ty < 0
        ? P([[bx - w * 0.08, by], [tx, ty], [bx + w * 0.08, by]])
        : P([[tx < 0 ? 0 : w, h / 2 - h * 0.1], [tx, ty], [tx < 0 ? 0 : w, h / 2 + h * 0.1]]);
      return { fill: body + ' ' + tail };
    }
    case 'line': case 'straightConnector1': case 'bentConnector2': case 'bentConnector3':
    case 'curvedConnector3':
      return { fill: 'M0 0L' + r(w) + ' ' + r(h), open: true };
    default:
      return { fill: rect };
  }
}

function r(v) { return Math.round(v * 100) / 100; }

// ---- text --------------------------------------------------------------------

function drawText(el, opts) {
  const t = el.text;
  const d = document.createElement('div');
  d.className = 'txt';
  const [l, tp, rt, b] = t.ins;
  d.style.padding = tp + 'px ' + rt + 'px ' + b + 'px ' + l + 'px';
  d.style.justifyContent = t.anchor === 'ctr' ? 'center' : t.anchor === 'b' ? 'flex-end' : 'flex-start';
  if (!t.wrap) d.classList.add('nowrap');
  for (const p of t.paras) {
    const pd = document.createElement('div');
    pd.className = 'p';
    if (p.algn) pd.style.textAlign = { ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[p.algn] || 'left';
    if (p.marL) pd.style.paddingLeft = p.marL + 'px';
    const lineK = 1.2 * (p.lnPct || 1);
    pd.style.lineHeight = p.lnPx ? p.lnPx + 'px' : String(lineK);
    if (p.before) pd.style.marginTop = p.before + 'px';
    if (p.after) pd.style.marginBottom = p.after + 'px';
    const size = (p.runs.find((x) => x.t) || p).sz || 18;
    pd.style.fontSize = size * PX_PER_PT + 'px';
    if (p.bullet) {
      const bu = document.createElement('span');
      bu.className = 'bu';
      bu.textContent = p.bullet.char;
      bu.style.color = p.bullet.color;
      bu.style.fontSize = p.bullet.sz * PX_PER_PT + 'px';
      if (p.bullet.font) bu.style.fontFamily = fontStack(p.bullet.font);
      const hang = p.indent < 0 ? -p.indent : 0;
      bu.style.width = hang + 'px';
      bu.style.marginLeft = (p.indent || 0) + 'px';
      pd.appendChild(bu);
    } else if (p.indent) {
      pd.style.textIndent = p.indent + 'px';
    }
    let any = false;
    for (const run of p.runs) {
      if (run.br) { pd.appendChild(document.createElement('br')); continue; }
      if (!run.t) continue;
      any = true;
      const s = document.createElement('span');
      s.textContent = run.caps ? run.t.toUpperCase() : run.t;
      s.style.fontFamily = fontStack(run.font);
      s.style.fontSize = run.sz * PX_PER_PT + 'px';
      s.style.color = run.color;
      if (run.b) s.style.fontWeight = '700';
      if (run.i) s.style.fontStyle = 'italic';
      const deco = [run.u ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ');
      if (deco) s.style.textDecoration = deco;
      if (run.smallCaps) s.style.fontVariant = 'small-caps';
      if (run.spc) s.style.letterSpacing = run.spc + 'px';
      if (run.highlight) s.style.backgroundColor = run.highlight;
      if (run.baseline) {
        s.style.verticalAlign = run.baseline > 0 ? 'super' : 'sub';
        s.style.fontSize = run.sz * PX_PER_PT * 0.66 + 'px';
      }
      if (run.link) makeLink(s, run.link, opts);
      pd.appendChild(s);
    }
    if (!any) {
      pd.style.fontFamily = fontStack(p.font);
      pd.appendChild(document.createTextNode('​'));
    }
    d.appendChild(pd);
  }
  return d;
}
