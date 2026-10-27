/* Small pieces the library, deck page and editor share. */

import { renderSlide } from './render.js';
import * as store from './store.js';

const urls = new Map();                   // media hash -> object URL, for this session

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

/** Load a deck's pictures; returns hash -> URL. */
export async function loadMedia(deck) {
  const need = store.mediaOf(deck).filter((h) => !urls.has(h));
  if (need.length) {
    const recs = await store.getMedia(need);
    recs.forEach((r, i) => { if (r) urls.set(need[i], URL.createObjectURL(r.blob)); });
  }
  return mediaUrl;
}

export function mediaUrl(hash) { return urls.get(hash) || ''; }

export function addMediaUrl(hash, blob) {
  if (!urls.has(hash)) urls.set(hash, URL.createObjectURL(blob));
}

// A slide drawn small. The stage is scaled to whatever width the card has.
const sizer = new ResizeObserver((entries) => {
  for (const e of entries) {
    const stage = e.target.firstChild;
    if (stage) stage.style.transform = 'scale(' + e.contentRect.width / stage.offsetWidth + ')';
  }
});

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    e.target._draw();
  }
}, { rootMargin: '400px' });

export function thumb(slide, deck, media) {
  const t = el('div', { class: 'thumb' });
  t._draw = () => {
    t.replaceChildren(renderSlide(slide, deck, { media }));
    sizer.observe(t);
  };
  lazy.observe(t);
  return t;
}
