/* PowerPoint (.pptx) to deck converter.

   Turns a .pptx (for example a Google Slides deck downloaded as PowerPoint)
   into the app's own deck format: plain objects with every position in
   pixels on a 960 x 540 stage, and pictures pulled out as separate files
   keyed by a hash of their bytes, so a picture used on fifty slides is
   stored once.

   Runs in the browser. Pass a DOMParser in `opts.DOMParser` to run it
   elsewhere (the tests do this under Node). */

import { openZip } from './zip.js';
import { markDeck } from './marks.js';

const STAGE_W = 960;
const PX_PER_PT = 960 / 720;               // a 10 in slide is 720 pt wide

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
               svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };

export async function convertPptx(buffer, opts = {}) {
  const Parser = opts.DOMParser || globalThis.DOMParser;
  const zip = await openZip(buffer);
  const parse = (s) => new Parser().parseFromString(s, 'application/xml');
  const partCache = new Map();
  const media = new Map();                 // hash -> { bytes, type, name }
  const mediaByPath = new Map();           // zip path -> hash
  const warnings = [];

  async function part(path) {
    if (!partCache.has(path)) {
      const text = await zip.text(path);
      partCache.set(path, text ? { doc: parse(text), rels: await relsOf(path) } : null);
    }
    return partCache.get(path);
  }

  async function relsOf(path) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    const relPath = dir + '/_rels/' + path.slice(dir.length + 1) + '.rels';
    const text = await zip.text(relPath);
    const out = {};
    if (!text) return out;
    for (const r of kids(parse(text).documentElement, 'Relationship')) {
      const target = r.getAttribute('Target');
      const external = r.getAttribute('TargetMode') === 'External';
      out[r.getAttribute('Id')] = {
        type: r.getAttribute('Type').split('/').pop(),
        target: external ? target : resolvePath(dir, target),
        external
      };
    }
    return out;
  }

  async function mediaFor(path) {
    if (mediaByPath.has(path)) return mediaByPath.get(path);
    const bytes = await zip.bytes(path);
    if (!bytes) return null;
    const ext = path.split('.').pop().toLowerCase();
    const type = MIME[ext];
    if (!type) {
      warnings.push('Skipped a picture in a format browsers cannot show (' + ext + ').');
      mediaByPath.set(path, null);
      return null;
    }
    const hash = await sha256(bytes);
    if (!media.has(hash)) media.set(hash, { bytes, type, name: path.split('/').pop() });
    mediaByPath.set(path, hash);
    return hash;
  }

  // ---- presentation ---------------------------------------------------

  const pres = await part('ppt/presentation.xml');
  if (!pres) throw new Error('This file is not a PowerPoint presentation.');
  const presEl = pres.doc.documentElement;
  const sz = first(presEl, 'sldSz');
  const cx = num(sz && sz.getAttribute('cx'), 9144000);
  const cy = num(sz && sz.getAttribute('cy'), 5143500);
  const emu = cx / STAGE_W;                 // EMU per stage pixel
  const stageH = Math.round(cy / emu);
  const px = (v) => num(v, 0) / emu;
  const defaultTextStyle = first(presEl, 'defaultTextStyle');

  const slidePaths = [];
  for (const id of kids(first(presEl, 'sldIdLst'), 'sldId')) {
    const rel = pres.rels[id.getAttribute('r:id')];
    if (rel) slidePaths.push(rel.target);
  }
  const slideIndex = new Map(slidePaths.map((p, i) => [p, i]));

  // ---- theme ----------------------------------------------------------

  async function themeFor(masterPath) {
    const m = await part(masterPath);
    const rel = Object.values(m.rels).find((r) => r.type === 'theme');
    const t = rel && await part(rel.target);
    const colors = {};
    const fonts = { major: 'Arial', minor: 'Arial' };
    if (t) {
      const scheme = deep(t.doc.documentElement, 'clrScheme');
      for (const c of kidsAll(scheme)) {
        const v = kidsAll(c)[0];
        if (v) colors[c.localName] = v.getAttribute('val') === undefined ? null
          : (v.localName === 'sysClr' ? v.getAttribute('lastClr') : v.getAttribute('val'));
      }
      const major = first(deep(t.doc.documentElement, 'majorFont'), 'latin');
      const minor = first(deep(t.doc.documentElement, 'minorFont'), 'latin');
      if (major) fonts.major = major.getAttribute('typeface');
      if (minor) fonts.minor = minor.getAttribute('typeface');
    }
    const map = {};
    const cm = first(m.doc.documentElement, 'clrMap');
    if (cm) for (const a of Array.from(cm.attributes)) map[a.name] = a.value;
    return { colors, fonts, map };
  }

  // ---- colors and fills ----------------------------------------------

  function colorOf(holder, ctx, phClr) {
    const c = holder && kidsAll(holder).find((k) =>
      ['srgbClr', 'schemeClr', 'prstClr', 'sysClr', 'scrgbClr', 'hslClr'].includes(k.localName));
    if (!c) return null;
    let hex = null;
    switch (c.localName) {
      case 'srgbClr': hex = c.getAttribute('val'); break;
      case 'sysClr': hex = c.getAttribute('lastClr') || '000000'; break;
      case 'prstClr': hex = PRESET_COLORS[c.getAttribute('val')] || '000000'; break;
      case 'schemeClr': {
        let key = c.getAttribute('val');
        if (key === 'phClr') { if (phClr) return modColor(phClr, c); key = 'tx1'; }
        if (ctx.theme.map[key]) key = ctx.theme.map[key];
        hex = ctx.theme.colors[key] || '000000';
        break;
      }
      case 'scrgbClr': {
        const f = (n) => Math.round(Math.min(1, num(c.getAttribute(n), 0) / 100000) * 255);
        hex = toHex(f('r'), f('g'), f('b'));
        break;
      }
      default: hex = '000000';
    }
    return modColor({ hex, a: 1 }, c);
  }

  function fillOf(spPr, ctx, styleEl) {
    const f = spPr && kidsAll(spPr).find((k) =>
      ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'].includes(k.localName));
    if (!f) {
      const ref = styleEl && first(styleEl, 'fillRef');
      if (ref && num(ref.getAttribute('idx'), 0) > 0) {
        const c = colorOf(ref, ctx);
        if (c) return { type: 'solid', color: css(c) };
      }
      return null;
    }
    return fillFrom(f, ctx);
  }

  function fillFrom(f, ctx) {
    switch (f.localName) {
      case 'noFill': return { type: 'none' };
      case 'solidFill': { const c = colorOf(f, ctx); return c ? { type: 'solid', color: css(c) } : null; }
      case 'pattFill': { const c = colorOf(first(f, 'fgClr'), ctx); return c ? { type: 'solid', color: css(c) } : null; }
      case 'grpFill': return ctx.groupFill || null;
      case 'gradFill': {
        const stops = kids(first(f, 'gsLst'), 'gs').map((gs) => ({
          pos: num(gs.getAttribute('pos'), 0) / 1000,
          color: css(colorOf(gs, ctx) || { hex: '000000', a: 1 })
        })).sort((a, b) => a.pos - b.pos);
        const lin = first(f, 'lin');
        const path = first(f, 'path');
        if (path && !lin) return { type: 'radial', stops };
        return { type: 'linear', angle: lin ? num(lin.getAttribute('ang'), 0) / 60000 : 90, stops };
      }
      case 'blipFill': return { type: 'image', blip: f };
      default: return null;
    }
  }

  async function finishFill(fill, ctx) {
    if (!fill || fill.type !== 'image') return fill;
    const blip = first(fill.blip, 'blip');
    const rel = blip && ctx.rels[blip.getAttribute('r:embed')];
    const hash = rel && !rel.external ? await mediaFor(rel.target) : null;
    if (!hash) return null;
    const out = { type: 'image', media: hash };
    const tile = first(fill.blip, 'tile');
    if (tile) out.tile = true;
    const alpha = first(blip, 'alphaModFix');
    if (attr(alpha, 'amt')) out.alpha = num(alpha.getAttribute('amt'), 100000) / 100000;
    return out;
  }

  function lineOf(spPr, ctx, styleEl, fallbackNone) {
    const ln = spPr && first(spPr, 'ln');
    let color = null;
    let width = attr(ln, 'w') != null ? px(attr(ln, 'w')) : null;
    if (ln) {
      if (first(ln, 'noFill')) return null;
      const sf = first(ln, 'solidFill');
      if (sf) color = colorOf(sf, ctx);
      const gf = first(ln, 'gradFill');
      if (!color && gf) color = colorOf(first(first(gf, 'gsLst'), 'gs'), ctx);
    }
    if (!color) {
      const ref = styleEl && first(styleEl, 'lnRef');
      if (ref && num(ref.getAttribute('idx'), 0) > 0) color = colorOf(ref, ctx);
      else if (!ln || fallbackNone) return null;
    }
    if (!color) return null;
    const dash = ln && first(ln, 'prstDash');
    const out = { color: css(color), width: width == null ? 1 : Math.max(width, 0.5) };
    if (dash && dash.getAttribute('val') !== 'solid') out.dash = dash.getAttribute('val');
    const head = ln && first(ln, 'headEnd');
    const tail = ln && first(ln, 'tailEnd');
    if (attr(head, 'type') && attr(head, 'type') !== 'none') out.head = head.getAttribute('type');
    if (attr(tail, 'type') && attr(tail, 'type') !== 'none') out.tail = tail.getAttribute('type');
    return out;
  }

  // ---- text -----------------------------------------------------------

  // A text "level style" chain: list of lstStyle-like elements, most general first.
  function levelProps(chain, lvl) {
    const ppr = {};
    const rpr = {};
    for (const style of chain) {
      if (!style) continue;
      const l = first(style, 'lvl' + (lvl + 1) + 'pPr') || (lvl === 0 ? first(style, 'defPPr') : null);
      if (!l) continue;
      Object.assign(ppr, pprFields(l));
      const d = first(l, 'defRPr');
      if (d) Object.assign(rpr, rprFields(d));
    }
    return { ppr, rpr };
  }

  function pprFields(el) {
    const o = {};
    const a = (n) => attr(el, n);
    if (a('algn')) o.algn = a('algn');
    if (a('marL') != null) o.marL = px(a('marL'));
    if (a('indent') != null) o.indent = px(a('indent'));
    const ls = first(el, 'lnSpc');
    if (ls) {
      const pct = first(ls, 'spcPct');
      const pts = first(ls, 'spcPts');
      if (pct) o.lnPct = num(pct.getAttribute('val'), 100000) / 100000;
      if (pts) o.lnPx = num(pts.getAttribute('val'), 0) / 100 * PX_PER_PT;
    }
    for (const [tag, key] of [['spcBef', 'before'], ['spcAft', 'after']]) {
      const s = first(el, tag);
      if (!s) continue;
      const pts = first(s, 'spcPts');
      const pct = first(s, 'spcPct');
      if (pts) o[key] = num(pts.getAttribute('val'), 0) / 100 * PX_PER_PT;
      else if (pct) o[key + 'Pct'] = num(pct.getAttribute('val'), 0) / 100000;
    }
    if (first(el, 'buNone')) o.bullet = null;
    const ch = first(el, 'buChar');
    if (ch) o.bullet = { char: ch.getAttribute('char') };
    const an = first(el, 'buAutoNum');
    if (an) o.bullet = { auto: an.getAttribute('type'), start: num(an.getAttribute('startAt'), 1) };
    const bf = first(el, 'buFont');
    if (bf) o.buFont = bf.getAttribute('typeface');
    const bc = first(el, 'buClr');
    if (bc) o.buClr = bc;
    const bs = first(el, 'buSzPct');
    if (bs) o.buSz = num(bs.getAttribute('val'), 100000) / 100000;
    return o;
  }

  function rprFields(el) {
    const o = {};
    const a = (n) => attr(el, n);
    if (a('sz')) o.sz = num(a('sz'), 1800) / 100;
    if (a('b') != null) o.b = a('b') === '1' || a('b') === 'true';
    if (a('i') != null) o.i = a('i') === '1' || a('i') === 'true';
    if (a('u') != null) o.u = a('u') !== 'none';
    if (a('strike') != null) o.strike = a('strike') !== 'noStrike';
    if (a('cap') != null) o.cap = a('cap');
    if (a('baseline') != null) o.baseline = num(a('baseline'), 0) / 1000;
    if (a('spc') != null) o.spc = num(a('spc'), 0) / 100 * PX_PER_PT;
    const sf = first(el, 'solidFill');
    if (sf) o.colorEl = sf;
    const hl = first(el, 'highlight');
    if (hl) o.highlightEl = hl;
    const latin = first(el, 'latin');
    if (attr(latin, 'typeface')) o.font = attr(latin, 'typeface');
    const link = first(el, 'hlinkClick');
    if (link) o.linkEl = link;
    return o;
  }

  function textOf(txBody, chain, ctx) {
    if (!txBody) return null;
    const bodyPr = first(txBody, 'bodyPr');
    const b = (n, d) => attr(bodyPr, n) != null ? attr(bodyPr, n) : d;
    const fullChain = chain.concat([first(txBody, 'lstStyle')]);
    const auto = bodyPr && first(bodyPr, 'normAutofit');
    const scale = auto ? num(auto.getAttribute('fontScale'), 100000) / 100000 : 1;
    const lnRed = auto ? num(auto.getAttribute('lnSpcReduction'), 0) / 100000 : 0;
    const text = {
      anchor: b('anchor', 't'),
      ins: [px(b('lIns', 91440)), px(b('tIns', 45720)), px(b('rIns', 91440)), px(b('bIns', 45720))],
      wrap: b('wrap', 'square') !== 'none',
      paras: []
    };
    if (b('vert', 'horz') !== 'horz') text.vert = b('vert');
    if (bodyPr && first(bodyPr, 'spAutoFit')) text.grow = true;
    const autoNum = {};
    let hasText = false;
    for (const p of kids(txBody, 'p')) {
      const pPr = first(p, 'pPr');
      const lvl = pPr ? num(pPr.getAttribute('lvl'), 0) : 0;
      const base = levelProps(fullChain, lvl);
      const ppr = Object.assign({}, base.ppr, pPr ? pprFields(pPr) : {});
      const para = { runs: [] };
      if (ppr.algn && ppr.algn !== 'l') para.algn = ppr.algn;
      if (ppr.marL) para.marL = ppr.marL;
      if (ppr.indent) para.indent = ppr.indent;
      if (ppr.lnPct && ppr.lnPct !== 1 || lnRed) para.lnPct = (ppr.lnPct || 1) - lnRed;
      if (ppr.lnPx) para.lnPx = ppr.lnPx;
      if (ppr.before) para.before = ppr.before;
      if (ppr.after) para.after = ppr.after;

      const runStyle = (rPr) => {
        const r = Object.assign({}, base.rpr, rPr ? rprFields(rPr) : {});
        const out = {};
        out.sz = (r.sz || 18) * scale;
        if (r.b) out.b = true;
        if (r.i) out.i = true;
        if (r.u) out.u = true;
        if (r.strike) out.strike = true;
        if (r.cap === 'all') out.caps = true;
        if (r.cap === 'small') out.smallCaps = true;
        if (r.baseline) out.baseline = r.baseline;
        if (r.spc) out.spc = r.spc;
        const color = r.colorEl ? colorOf(r.colorEl, ctx) : null;
        out.color = css(color || ctx.textColor || { hex: '000000', a: 1 });
        if (r.highlightEl) { const h = colorOf(r.highlightEl, ctx); if (h) out.highlight = css(h); }
        out.font = fontName(r.font || ctx.theme.fonts.minor, ctx);
        if (r.linkEl) {
          const l = linkOf(r.linkEl, ctx);
          if (l) out.link = l;
        }
        return out;
      };

      for (const k of kidsAll(p)) {
        if (k.localName === 'r' || k.localName === 'fld') {
          const t = first(k, 't');
          const s = t ? t.textContent : '';
          const run = runStyle(first(k, 'rPr'));
          run.t = s;
          if (s) hasText = true;
          para.runs.push(run);
        } else if (k.localName === 'br') {
          const run = runStyle(first(k, 'rPr'));
          run.br = true;
          para.runs.push(run);
        }
      }
      const end = runStyle(first(p, 'endParaRPr'));
      para.sz = end.sz;
      if (!para.runs.length) para.font = end.font;

      if (ppr.bullet && para.runs.some((r) => r.t)) {
        const first0 = para.runs.find((r) => r.t) || end;
        const bu = { color: ppr.buClr ? css(colorOf(ppr.buClr, ctx)) : first0.color,
                     sz: first0.sz * (ppr.buSz || 1) };
        if (ppr.buFont && !/^\+/.test(ppr.buFont)) bu.font = fontName(ppr.buFont, ctx);
        if (ppr.bullet.char) bu.char = ppr.bullet.char;
        else {
          const key = lvl + ':' + ppr.bullet.auto;
          autoNum[key] = autoNum[key] ? autoNum[key] + 1 : ppr.bullet.start;
          bu.char = numberLabel(ppr.bullet.auto, autoNum[key]);
        }
        para.bullet = bu;
      } else {
        for (const key of Object.keys(autoNum)) if (key.startsWith(lvl + ':')) delete autoNum[key];
      }
      text.paras.push(para);
    }
    return hasText ? text : null;
  }

  function fontName(face, ctx) {
    if (!face) return 'Arial';
    if (face === '+mj-lt' || face === '+mj-ea' || face === '+mj-cs') return ctx.theme.fonts.major;
    if (face.startsWith('+')) return ctx.theme.fonts.minor;
    return face;
  }

  function linkOf(el, ctx) {
    const action = el.getAttribute('action') || '';
    const rel = ctx.rels[el.getAttribute('r:id')];
    if (action.includes('hlinkshowjump')) {
      const m = action.match(/jump=(\w+)/);
      return m ? { jump: m[1].replace('slide', '') } : null;     // next, previous, first, last
    }
    if (action.includes('hlinksldjump')) {
      if (!rel) return null;
      const i = slideIndex.get(rel.target);
      return i === undefined ? null : { slide: i };
    }
    if (rel && rel.external && /^(https?:|mailto:)/i.test(rel.target)) return { url: rel.target };
    return null;
  }

  // ---- shapes ---------------------------------------------------------

  function xfrmOf(el) {
    const x = el && first(el, 'xfrm');
    if (!x) return null;
    const off = first(x, 'off');
    const ext = first(x, 'ext');
    const o = {
      x: num(off && off.getAttribute('x'), 0), y: num(off && off.getAttribute('y'), 0),
      w: num(ext && ext.getAttribute('cx'), 0), h: num(ext && ext.getAttribute('cy'), 0),
      rot: num(x.getAttribute('rot'), 0) / 60000,
      flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1'
    };
    const chOff = first(x, 'chOff');
    const chExt = first(x, 'chExt');
    if (chOff && chExt) {
      o.chX = num(chOff.getAttribute('x'), 0); o.chY = num(chOff.getAttribute('y'), 0);
      o.chW = num(chExt.getAttribute('cx'), 0); o.chH = num(chExt.getAttribute('cy'), 0);
    }
    return o;
  }

  function placeholderOf(el) {
    const nv = kidsAll(el).find((k) => /^nv/.test(k.localName));
    const nvPr = nv && first(nv, 'nvPr');
    const ph = nvPr && first(nvPr, 'ph');
    if (!ph) return null;
    return { type: attr(ph, 'type') || 'body', idx: attr(ph, 'idx') };
  }

  function findPh(tree, ph) {
    if (!tree) return null;
    const all = [];
    (function walk(node) {
      for (const k of kidsAll(node)) {
        if (k.localName === 'sp' || k.localName === 'pic') all.push(k);
        else if (k.localName === 'grpSp') walk(k);
      }
    })(tree);
    const withPh = all.map((el) => ({ el, ph: placeholderOf(el) })).filter((x) => x.ph);
    const same = (a, b) => a === b || (a === 'ctrTitle' && b === 'title') || (a === 'title' && b === 'ctrTitle')
      || (a === 'subTitle' && b === 'body') || (a === 'obj' && b === 'body');
    let hit = ph.idx != null ? withPh.find((x) => x.ph.idx === ph.idx && same(x.ph.type, ph.type)) : null;
    if (!hit && ph.idx != null) hit = withPh.find((x) => x.ph.idx === ph.idx);
    if (!hit) hit = withPh.find((x) => x.ph.type === ph.type);
    if (!hit) hit = withPh.find((x) => same(ph.type, x.ph.type));
    return hit ? hit.el : null;
  }

  function masterStyleFor(ph, ctx) {
    const tx = ctx.masterTxStyles;
    if (!ph) return defaultTextStyle;
    if (ph.type === 'title' || ph.type === 'ctrTitle') return tx && first(tx, 'titleStyle');
    if (['body', 'subTitle', 'obj'].includes(ph.type)) return tx && first(tx, 'bodyStyle');
    return tx && first(tx, 'otherStyle');
  }

  // Map a child rectangle through every enclosing group into stage pixels.
  function place(xf, groups) {
    let x = xf.x, y = xf.y, w = xf.w, h = xf.h;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      const sx = g.chW ? g.w / g.chW : 1;
      const sy = g.chH ? g.h / g.chH : 1;
      x = g.x + (x - (g.chX || 0)) * sx;
      y = g.y + (y - (g.chY || 0)) * sy;
      w *= sx; h *= sy;
    }
    return { x: round(x / emu), y: round(y / emu), w: round(w / emu), h: round(h / emu) };
  }

  async function shapesOf(tree, ctx, groups, out, inherited) {
    for (const el of kidsAll(tree)) {
      const name = el.localName;
      if (name === 'grpSp') {
        const gp = first(el, 'grpSpPr');
        const xf = xfrmOf(gp);
        const gctx = Object.assign({}, ctx);
        const gf = gp && kidsAll(gp).find((k) => /Fill$/.test(k.localName) && k.localName !== 'grpFill');
        if (gf) gctx.groupFill = await finishFill(fillFrom(gf, ctx), ctx);
        const link = clickOf(el, ctx) || inherited;
        await shapesOf(el, gctx, xf ? groups.concat([xf]) : groups, out, link);
      } else if (name === 'sp' || name === 'pic' || name === 'cxnSp') {
        const shape = await shapeOf(el, ctx, groups);
        if (!shape) continue;
        if (!shape.link && inherited) shape.link = inherited;
        out.push(shape);
      } else if (name === 'graphicFrame') {
        warnings.push('A table or chart was left out of slide ' + (ctx.slideNo || '?') + '.');
      } else if (name === 'AlternateContent') {
        const fb = first(el, 'Fallback');
        if (fb) await shapesOf(fb, ctx, groups, out, inherited);
      }
    }
  }

  function clickOf(el, ctx) {
    const nv = kidsAll(el).find((k) => /^nv/.test(k.localName));
    const c = nv && first(nv, 'cNvPr');
    const h = c && first(c, 'hlinkClick');
    return h ? linkOf(h, ctx) : null;
  }

  async function shapeOf(el, ctx, groups) {
    const ph = placeholderOf(el);
    const spPr = first(el, 'spPr');
    const styleEl = first(el, 'style');
    let xf = xfrmOf(spPr);
    let layoutEl = null, masterEl = null;
    if (ph && ctx.layoutTree) {
      layoutEl = findPh(ctx.layoutTree, ph);
      masterEl = findPh(ctx.masterTree, ph);
      if (!xf) xf = xfrmOf(first(layoutEl, 'spPr')) || xfrmOf(first(masterEl, 'spPr'));
    }
    if (!xf) return null;
    if (ph && ph.type === 'sldNum' && ctx.isLayer) return null;    // footers
    const box = place(xf, groups);
    const shape = { t: el.localName === 'pic' ? 'pic' : 'sp', ...box };
    if (xf.rot) shape.rot = round(xf.rot);
    if (xf.flipH) shape.flipH = true;
    if (xf.flipV) shape.flipV = true;

    const geomEl = spPr && (first(spPr, 'prstGeom') || first(spPr, 'custGeom'));
    if (geomEl && geomEl.localName === 'prstGeom') {
      shape.geom = geomEl.getAttribute('prst');
      const adj = kids(first(geomEl, 'avLst'), 'gd').map((g) => {
        const m = String(g.getAttribute('fmla')).match(/val\s+(-?\d+)/);
        return [g.getAttribute('name'), m ? Number(m[1]) : 0];
      });
      if (adj.length) shape.adj = Object.fromEntries(adj);
    } else if (geomEl) {
      shape.geom = 'custom';
      shape.path = customPath(geomEl, box);
    } else {
      shape.geom = 'rect';
    }
    if (el.localName === 'cxnSp') shape.geom = shape.geom === 'rect' ? 'line' : shape.geom;

    const link = clickOf(el, ctx);
    if (link) shape.link = link;
    const descr = (() => {
      const nv = kidsAll(el).find((k) => /^nv/.test(k.localName));
      const c = nv && first(nv, 'cNvPr');
      return c ? (c.getAttribute('descr') || c.getAttribute('title') || '') : '';
    })();
    if (descr) shape.alt = descr;

    if (el.localName === 'pic') {
      const bf = first(el, 'blipFill');
      const blip = bf && first(bf, 'blip');
      const rel = blip && ctx.rels[blip.getAttribute('r:embed')];
      const hash = rel && !rel.external ? await mediaFor(rel.target) : null;
      if (!hash) return null;
      shape.media = hash;
      const src = first(bf, 'srcRect');
      if (src) {
        const c = ['l', 't', 'r', 'b'].map((k) => num(src.getAttribute(k), 0) / 100000);
        if (c.some((v) => v)) shape.crop = c;
      }
      const alpha = first(blip, 'alphaModFix');
      if (attr(alpha, 'amt')) shape.alpha = num(alpha.getAttribute('amt'), 100000) / 100000;
      const line = lineOf(spPr, ctx, styleEl, true);
      if (line) shape.line = line;
      return shape;
    }

    const fill = await finishFill(fillOf(spPr, ctx, styleEl) ||
      (layoutEl ? fillOf(first(layoutEl, 'spPr'), ctx) : null), ctx);
    if (fill && fill.type !== 'none') shape.fill = fill;
    const line = lineOf(spPr, ctx, styleEl) || (layoutEl ? lineOf(first(layoutEl, 'spPr'), ctx) : null);
    if (line) shape.line = line;

    const fontRef = styleEl && first(styleEl, 'fontRef');
    const tctx = fontRef && colorOf(fontRef, ctx) ? Object.assign({}, ctx, { textColor: colorOf(fontRef, ctx) }) : ctx;
    const chain = [masterStyleFor(ph, ctx)];
    if (masterEl) chain.push(first(first(masterEl, 'txBody'), 'lstStyle'));
    if (layoutEl) chain.push(first(first(layoutEl, 'txBody'), 'lstStyle'));
    let txBody = first(el, 'txBody');
    if (txBody && layoutEl && first(txBody, 'bodyPr') && !first(txBody, 'bodyPr').attributes.length) {
      const lb = first(first(layoutEl, 'txBody'), 'bodyPr');
      if (lb) txBody = mergeBodyPr(txBody, lb);
    }
    const text = textOf(txBody, chain, tctx);
    if (text) shape.text = text;
    if (!shape.fill && !shape.line && !shape.text && !shape.link) return null;
    return shape;
  }

  function mergeBodyPr(txBody, layoutBodyPr) {
    const clone = txBody.cloneNode(true);
    const bp = first(clone, 'bodyPr');
    for (const a of Array.from(layoutBodyPr.attributes)) bp.setAttribute(a.name, a.value);
    return clone;
  }

  function customPath(geom, box) {
    const out = [];
    for (const path of kids(first(geom, 'pathLst'), 'path')) {
      const pw = num(path.getAttribute('w'), 0) || 1;
      const ph = num(path.getAttribute('h'), 0) || 1;
      const sx = box.w / pw, sy = box.h / ph;
      const pt = (p) => round(num(p.getAttribute('x'), 0) * sx) + ' ' + round(num(p.getAttribute('y'), 0) * sy);
      for (const c of kidsAll(path)) {
        const pts = kids(c, 'pt');
        if (c.localName === 'moveTo') out.push('M' + pt(pts[0]));
        else if (c.localName === 'lnTo') out.push('L' + pt(pts[0]));
        else if (c.localName === 'cubicBezTo') out.push('C' + pts.map(pt).join(' '));
        else if (c.localName === 'quadBezTo') out.push('Q' + pts.map(pt).join(' '));
        else if (c.localName === 'close') out.push('Z');
      }
    }
    return out.join(' ');
  }

  async function backgroundOf(doc, ctx) {
    const bg = first(first(doc.documentElement, 'cSld'), 'bg');
    if (!bg) return null;
    const bgPr = first(bg, 'bgPr');
    if (bgPr) {
      const f = kidsAll(bgPr).find((k) => /Fill$/.test(k.localName));
      return f ? finishFill(fillFrom(f, ctx), ctx) : null;
    }
    const ref = first(bg, 'bgRef');
    if (ref) {
      const c = colorOf(ref, ctx);
      return c ? { type: 'solid', color: css(c) } : null;
    }
    return null;
  }

  // ---- slides ---------------------------------------------------------

  const layers = new Map();                // layout path -> { bg, shapes, ctx parts }

  async function layerFor(layoutPath) {
    if (layers.has(layoutPath)) return layers.get(layoutPath);
    const layout = await part(layoutPath);
    const masterRel = Object.values(layout.rels).find((r) => r.type === 'slideMaster');
    const master = await part(masterRel.target);
    const theme = await themeFor(masterRel.target);
    const masterEl = master.doc.documentElement;
    const layoutEl = layout.doc.documentElement;
    const base = {
      theme, masterTxStyles: first(masterEl, 'txStyles'),
      layoutTree: first(first(layoutEl, 'cSld'), 'spTree'),
      masterTree: first(first(masterEl, 'cSld'), 'spTree')
    };
    const mctx = Object.assign({}, base, { rels: master.rels, isLayer: true, layoutTree: null });
    const lctx = Object.assign({}, base, { rels: layout.rels, isLayer: true, layoutTree: null });
    const shapes = [];
    // Only decoration is drawn from the master and layout; their placeholders are prompts.
    const masterShapes = layoutEl.getAttribute('showMasterSp') === '0' ? []
      : await decorOnly(base.masterTree, mctx);
    const layoutShapes = await decorOnly(base.layoutTree, lctx);
    shapes.push(...masterShapes, ...layoutShapes);
    const bg = await backgroundOf(layout.doc, lctx) || await backgroundOf(master.doc, mctx);
    const out = { base, bg, shapes };
    layers.set(layoutPath, out);
    return out;
  }

  async function decorOnly(tree, ctx) {
    const out = [];
    if (!tree) return out;
    const plain = tree.cloneNode(true);
    for (const k of kidsAll(plain)) if (placeholderOf(k)) plain.removeChild(k);
    await shapesOf(plain, ctx, [], out);
    return out;
  }

  const slides = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i];
    const s = await part(path);
    if (!s) continue;
    const layoutRel = Object.values(s.rels).find((r) => r.type === 'slideLayout');
    const layer = await layerFor(layoutRel.target);
    const ctx = Object.assign({}, layer.base, { rels: s.rels, slideNo: i + 1 });
    const root = s.doc.documentElement;
    const slide = { els: [] };
    slide.bg = await backgroundOf(s.doc, ctx) || layer.bg || { type: 'solid', color: '#ffffff' };
    if (root.getAttribute('showMasterSp') !== '0') slide.els.push(...layer.shapes);
    await shapesOf(first(first(root, 'cSld'), 'spTree'), ctx, [], slide.els);
    if (root.getAttribute('show') === '0') slide.hidden = true;
    const notesRel = Object.values(s.rels).find((r) => r.type === 'notesSlide');
    if (notesRel) {
      const n = await part(notesRel.target);
      const body = n && findPh(first(first(n.doc.documentElement, 'cSld'), 'spTree'), { type: 'body' });
      const txt = body ? kids(first(body, 'txBody'), 'p').map((p) => p.textContent).join('\n').trim() : '';
      if (txt) slide.notes = txt;
      // Google Slides names each notes shape "...;<page id>:notes", which is
      // how links between Google decks name their target slide.
      for (const c of n ? deepAll(n.doc.documentElement, 'cNvPr') : []) {
        const m = String(c.getAttribute('name')).match(/;([\w-]+):notes$/);
        if (m) { slide.gid = m[1]; break; }
      }
    }
    slide.title = guessTitle(slide);
    slides.push(slide);
  }

  const googleId = resolveGoogleLinks(slides);
  return {
    deck: markDeck({ w: STAGE_W, h: stageH, slides, googleId, warnings: [...new Set(warnings)] }),
    media
  };
}

// ---- helpers ------------------------------------------------------------

const GOOGLE_SLIDE_LINK = /docs\.google\.com\/presentation\/d\/([\w-]+)[^#]*(?:#slide=id\.([\w-]+))?/;

/* Google decks link to their own slides with full web addresses. Turn the
   ones that point inside this deck into slide jumps, and mark the ones that
   point at another Google deck so the app can open that deck if it has it.
   Returns this deck's Google id, when its own links give it away. */
function resolveGoogleLinks(slides) {
  const byGid = new Map();
  slides.forEach((s, i) => { if (s.gid) byGid.set(s.gid, i); });
  const links = [];
  for (const s of slides) {
    for (const el of s.els) {
      if (el.link) links.push(el.link);
      if (el.text) for (const p of el.text.paras) for (const r of p.runs) if (r.link) links.push(r.link);
    }
  }
  let own = null;
  for (const l of links) {
    const m = l.url && l.url.match(GOOGLE_SLIDE_LINK);
    if (m && m[2] && byGid.has(m[2])) { own = m[1]; break; }
  }
  for (const l of links) {
    const m = l.url && l.url.match(GOOGLE_SLIDE_LINK);
    if (!m) continue;
    if (m[1] === own && (!m[2] || byGid.has(m[2]))) {
      l.slide = m[2] ? byGid.get(m[2]) : 0;
      delete l.url;
    } else {
      l.gdoc = m[1];
      if (m[2]) l.gslide = m[2];
    }
  }
  return own;
}

export function guessTitle(slide) {
  // The biggest text on the slide reads as its title.
  let best = null;
  for (const el of slide.els) {
    if (!el.text) continue;
    for (const p of el.text.paras) {
      const t = p.runs.map((r) => r.t || ' ').join('').trim();
      if (!t || t.length > 60) continue;
      const sz = Math.max(...p.runs.map((r) => r.sz || 0));
      if (!best || sz > best.sz) best = { t, sz };
    }
  }
  return best ? best.t : '';
}

function numberLabel(type, n) {
  const roman = (v) => {
    const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'],
      [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let s = '';
    for (const [k, r] of m) while (v >= k) { s += r; v -= k; }
    return s;
  };
  const alpha = (v) => String.fromCharCode(96 + ((v - 1) % 26) + 1);
  let label = String(n);
  if (/^alphaLc/.test(type)) label = alpha(n);
  else if (/^alphaUc/.test(type)) label = alpha(n).toUpperCase();
  else if (/^romanLc/.test(type)) label = roman(n);
  else if (/^romanUc/.test(type)) label = roman(n).toUpperCase();
  if (/ParenBoth$/.test(type)) return '(' + label + ')';
  if (/ParenR$/.test(type)) return label + ')';
  if (/Period$/.test(type)) return label + '.';
  return label;
}

function modColor(c, el) {
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(c.hex.slice(i, i + 2), 16));
  let a = c.a;
  for (const m of kidsAll(el)) {
    const v = num(m.getAttribute('val'), 0) / 100000;
    switch (m.localName) {
      case 'alpha': a = v; break;
      case 'alphaMod': a *= v; break;
      case 'lumMod': case 'lumOff': {
        const [h, s, l] = rgbToHsl(r, g, b);
        const nl = m.localName === 'lumMod' ? l * v : l + v;
        [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, nl)));
        break;
      }
      case 'satMod': {
        const [h, s, l] = rgbToHsl(r, g, b);
        [r, g, b] = hslToRgb(h, Math.max(0, Math.min(1, s * v)), l);
        break;
      }
      case 'tint': [r, g, b] = [r, g, b].map((x) => x + (255 - x) * (1 - v)); break;
      case 'shade': [r, g, b] = [r, g, b].map((x) => x * v); break;
      default: break;
    }
  }
  return { hex: toHex(r, g, b), a };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function toHex(r, g, b) {
  return [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}

function css(c) {
  if (!c) return null;
  if (c.a >= 0.999) return '#' + c.hex.toLowerCase();
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.hex.slice(i, i + 2), 16));
  return 'rgba(' + r + ',' + g + ',' + b + ',' + round(c.a) + ')';
}

function resolvePath(dir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dir.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

// null when the attribute is absent (some XML parsers return '' instead).
function attr(el, name) {
  return el && el.hasAttribute(name) ? el.getAttribute(name) : null;
}

function kidsAll(el) {
  const out = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n);
  return out;
}

function kids(el, name) {
  return kidsAll(el).filter((k) => k.localName === name);
}

function first(el, name) {
  if (!el) return null;
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && n.localName === name) return n;
  return null;
}

// First descendant with this local name, depth first.
function deep(el, name) {
  for (const k of kidsAll(el)) {
    if (k.localName === name) return k;
    const hit = deep(k, name);
    if (hit) return hit;
  }
  return null;
}

function deepAll(el, name, out = []) {
  for (const k of kidsAll(el)) {
    if (k.localName === name) out.push(k);
    deepAll(k, name, out);
  }
  return out;
}

function num(v, d) {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

const PRESET_COLORS = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00',
  gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080', ltGray: 'D3D3D3', dkGray: 'A9A9A9'
};
