/* The studio's hub: each section (sections.js) with its apps and tools. */
import { SECTIONS, toolHref } from './sections.js';
import { h } from './dom.js';

const list = document.getElementById('sections');
list.replaceChildren(...SECTIONS.map((s) => {
  const sec = h('section', { class: 'sec', id: s.id, 'aria-labelledby': `${s.id}-name` },
    h('h2', { id: `${s.id}-name` }, s.name),
    h('ul', {},
      (s.apps || []).map((a) => h('li', {}, h('a', { class: 'app', href: a.href },
        a.img ? h('img', { src: a.img, alt: '' }) : h('span', { class: 'glyph', 'aria-hidden': 'true' }, a.icon),
        h('span', { class: 'name' }, a.name),
        h('span', { class: 'go', 'aria-hidden': 'true' }, '↗')))),
      s.tools.map((t) => h('li', {}, h('a', { class: 'tool', href: toolHref(t) },
        h('span', { class: 'glyph', 'aria-hidden': 'true' }, t.icon),
        h('span', { class: 'name' }, t.name))))));
  sec.style.setProperty('--tint', s.tint);
  return sec;
}));
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
