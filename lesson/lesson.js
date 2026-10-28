/* A private lesson student's page. Everything on it comes from the link
   (see codec.js); checkmarks are kept only in this browser. */

import { decodeLesson, formatDate } from './codec.js';

const main = document.getElementById('page');

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null));
  return e;
}

async function keyFor(hash) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash));
  return `lesson:${[...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function loadChecks(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

function saveChecks(key, checks) {
  try { localStorage.setItem(key, JSON.stringify(checks)); } catch { /* private window: checks just don't stay */ }
}

function checkbox(checks, key, id, label) {
  const box = el('input', { type: 'checkbox', checked: !!checks[id] });
  box.setAttribute('aria-label', label);
  box.addEventListener('change', () => { checks[id] = box.checked; saveChecks(key, checks); });
  return box;
}

/* Seven practice days, starting the day after the lesson. */
function practiceDays(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const start = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date();
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1 + i));
}

async function show() {
  const header = el('header', {}, el('img', { src: '/assets/logo/option-f-notes-badge-icon.svg', alt: 'Mr. Washburn Music' }));
  const hash = location.hash.slice(1);
  let page = null;
  if (hash) { try { page = await decodeLesson(hash); } catch { page = null; } }
  if (!page) { main.replaceChildren(header); return; }

  document.title = `${page.n || 'Lesson'} · Mr. Washburn Music`;
  const key = await keyFor(hash);
  const checks = loadChecks(key);

  header.append(el('div', {},
    el('h1', { textContent: page.n }),
    el('p', { textContent: [page.i, formatDate(page.d)].filter(Boolean).join(' · ') }),
  ));

  const days = el('div', { className: 'days' }, ...practiceDays(page.d).map((d, i) => {
    const name = d.toLocaleDateString(undefined, { weekday: 'long' });
    return el('label', { title: name }, checkbox(checks, key, `day${i}`, name), name.slice(0, 2));
  }));

  const list = el('ol', {}, ...page.t.map(([title, detail, link], i) => el('li', {},
    checkbox(checks, key, `item${i}`, title || `Item ${i + 1}`),
    el('strong', { textContent: title }),
    detail ? el('p', { textContent: detail }) : null,
    link ? el('a', { href: link, textContent: new URL(link).hostname.replace(/^www\./, ''), target: '_blank', rel: 'noopener noreferrer' }) : null,
  )));

  main.replaceChildren(...[header, days, list, page.m ? el('p', { className: 'note', textContent: page.m }) : null].filter(Boolean));
}

window.addEventListener('hashchange', show);
show();
