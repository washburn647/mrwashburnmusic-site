/* The bar at the top of every studio tool: the hub, and the other tools and apps of the tool's
   section (sections.js). It sits outside the tool's own page (main#app), so redraws keep it. */
import { SECTIONS, toolHref, LOGO } from './sections.js';
import { h } from './dom.js';

const here = location.pathname.split('/')[2];
const sec = SECTIONS.find((s) => s.tools.some((t) => t.id === here));
if (sec) {
  const nav = h('nav', { class: 'studio-nav', 'aria-label': 'Studio' },
    h('a', { class: 'sn-home', href: '/studio/' }, h('img', { src: LOGO, alt: '' }), 'Studio'),
    h('a', { class: 'sn-sec', href: `/studio/#${sec.id}` }, sec.name),
    h('span', { class: 'sn-tools' }, sec.tools.map((t) => h('a', { href: toolHref(t), 'aria-current': t.id === here ? 'page' : null },
      h('span', { 'aria-hidden': 'true' }, t.icon), t.name))),
    (sec.apps || []).length ? h('span', { class: 'sn-apps' }, sec.apps.map((a) => h('a', { href: a.href, title: a.name, 'aria-label': a.name },
      a.img ? h('img', { src: a.img, alt: '' }) : h('span', { 'aria-hidden': 'true' }, a.icon)))) : null);
  nav.style.setProperty('--tint', sec.tint);
  document.body.prepend(nav);
}
