/* The studio's sections: every app and tool, grouped by what it's for. The hub (/studio/)
   shows them, and every tool's page has its section's bar at the top (nav.js). A tool lives at
   /studio/<id>/. An app is a page of the site itself: img is its icon, or icon an emoji. */
export const SECTIONS = [
  {
    id: 'musician-maker', name: 'Musician Maker', tint: '#5E7D4F',
    apps: [{ name: 'Musician Maker', href: '/musician-maker/', img: '/musician-maker/icon.svg' }],
    tools: [
      { id: 'games', name: 'Game workshop', icon: '🎮' },
      { id: 'groove', name: 'Groove Lab', icon: '🥁' },
      { id: 'shop', name: 'Avatar shop', icon: '🛍️' },
    ],
  },
  {
    id: 'teaching', name: 'Teaching', tint: '#B4853A',
    apps: [
      { name: 'Class', href: '/class/', img: '/class/icons/icon-192.png' },
      { name: 'Planner', href: '/class/#/plan', icon: '🗓️' },
    ],
    tools: [
      { id: 'lessons', name: 'Lesson pages', icon: '📒' },
      { id: 'pictures', name: 'Picture library', icon: '🖼️' },
    ],
  },
  {
    id: 'recording', name: 'Recording', tint: '#C46A5A',
    tools: [
      { id: 'record', name: 'Voice recorder', icon: '🎙️' },
      { id: 'sounds', name: 'Sounds', icon: '🔊' },
      { id: 'cues', name: 'Video cue sheets', icon: '🎬' },
    ],
  },
  {
    id: 'songburner', name: 'Song Burner', tint: '#C8582E',
    apps: [{ name: 'Song Burner', href: '/songburner/', img: '/songburner/icons/icon-192.png' }],
    tools: [{ id: 'songburner', name: 'Testers and defaults', icon: '👥' }],
  },
  {
    id: 'website', name: 'Website', tint: '#4A7896',
    apps: [{ name: 'Radio', href: '/radio/', icon: '📻' }],
    tools: [
      { id: 'home', name: 'Homepage', icon: '🏠' },
      { id: 'radio', name: 'Radio stations', icon: '📡' },
    ],
  },
];

export const toolHref = (t) => `/studio/${t.id}/`;
export const LOGO = '/assets/logo/option-f-notes-badge-icon.svg';
