/* Slide audio: Kyle's recordings, made in layers (voice, instrument...) in the studio's voice
   recorder (/studio/record/, Slide audio) and kept with the Class app's files on the website.
   Each is a record in the library store (id 'audio-…', kind 'audio'), so sync.js brings it and
   its layers' sound files to every device:
   { id, kind: 'audio', name, song, bpm, countIn, click, created, updated,
     layers: [{ id, name, media, seconds, nudge (ms), vol (0 to 1) }] }
   A slide plays one through a Recording widget (widgets.js, kind 'player', el.track). They are
   Kyle's own: tagged classroom, never on the public site. The sub view gets the ones its decks
   play, with the sub key (subApi in worker/index.js). */

import * as store from './store.js';
import { useTracks } from './widgets.js';

export const isTrack = (r) => !!r && r.kind === 'audio' && Array.isArray(r.layers);

export async function listTracks() {
  return (await store.listLibrary()).filter(isTrack)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}

useTracks({
  async get(id) {
    const rec = await store.getLibrary(id);
    return isTrack(rec) ? rec : null;
  },
  async blob(hash) {
    const [m] = await store.getMedia([hash]);
    return m ? m.blob : null;
  }
});

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** In the editor: the recording a Recording widget plays. The slide's song's recordings come
    first. Resolves to the track, or null when backed out. */
export async function pickTrack(current, song) {
  const all = (await listTracks()).filter((t) => t.layers.some((l) => l.media));
  return new Promise((resolve) => {
    const make = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const box = make('div', 'wg-names');
    const card = make('div', 'wg-names-box wg-dialog');
    const pick = make('select', 'wg-names-title');
    const mine = song ? all.filter((t) => norm(t.song) === norm(song)) : [];
    const rest = all.filter((t) => !mine.includes(t));
    const option = (t) => {
      const o = make('option', null, t.name + (t.song && t.song !== t.name ? ' · ' + t.song : '') + ' (' + t.layers.filter((l) => l.media).map((l) => l.name).join(', ') + ')');
      o.value = t.id;
      o.selected = t.id === current;
      return o;
    };
    if (mine.length && rest.length) {
      const g1 = make('optgroup');
      g1.label = song;
      g1.append(...mine.map(option));
      const g2 = make('optgroup');
      g2.label = 'All';
      g2.append(...rest.map(option));
      pick.append(g1, g2);
    } else {
      pick.append(...[...mine, ...rest].map(option));
    }
    if (!all.length) {
      const o = make('option', null, 'No recordings yet');
      o.value = '';
      pick.append(o);
      pick.disabled = true;
    }
    const ok = make('button', 'btn', 'Done');
    ok.disabled = !all.length;
    const cancel = make('button', 'btn quiet', 'Cancel');
    const bar = make('div', 'wg-names-row');
    bar.append(make('span', 'spacer'), cancel, ok);
    card.append(pick, bar);
    box.append(card);
    (document.fullscreenElement || document.body).append(box);
    pick.focus();
    const done = (v) => { box.remove(); resolve(v); };
    const chosen = () => all.find((t) => t.id === pick.value) || null;
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', () => done(chosen()));
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter' && all.length) done(chosen());
    });
  });
}
