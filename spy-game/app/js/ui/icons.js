// Custom line icon set: 24×24 grid, 1.75 stroke, round caps. One style for the whole app.
// The same markup is pushed to Figma (icon/* components), so keep the two in sync.
const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const p = (d) => `<path d="${d}"/>`;

export const ICONS = {
  back: p('M5 12h14M13 6l6 6-6 6'),
  next: p('M19 12H5M11 6l-6 6 6 6'),
  close: p('M6 6l12 12M18 6L6 18'),
  plus: p('M12 5v14M5 12h14'),
  minus: p('M5 12h14'),
  check: p('M5 12.5l4.5 4.5L19 7'),
  trash: p('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
  timer: c(12, 13, 7) + p('M12 13V9.5M10 2.5h4M18.5 6.5L20 5'),
  eye: p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z') + c(12, 12, 3),
  share: c(18, 5, 2.5) + c(6, 12, 2.5) + c(18, 19, 2.5) + p('M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4'),
  download: p('M12 4v11M7 10l5 5 5-5M5 20h14'),
  trophy: p('M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4'),
  card: p('M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z'),
  wifiOff: p('M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.4M19 12.9a10 10 0 0 0-2.5-1.8M2 9.3a15 15 0 0 1 4.4-2.8M22 9.3A15 15 0 0 0 11 5.1M12 20h.01'),
  globe: c(12, 12, 9) + p('M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z'),
  user: c(12, 8, 4) + p('M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6'),
  users: c(9, 8, 3.5) + p('M2.5 20c.9-3.4 3.4-5.2 6.5-5.2s5.6 1.8 6.5 5.2M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.9c1.8.7 3 2.3 3.5 5.1'),
  lock: '<rect x="5" y="11" width="14" height="10" rx="1"/>' + p('M8 11V8a4 4 0 0 1 8 0v3'),
  play: p('M8 5l11 7-11 7z'),
  pause: p('M8 5v14M16 5v14'),
  sound: p('M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'),
  mute: p('M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6'),
  refresh: p('M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 4v4.5h-4.5'),
  crown: p('M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z'),
  copy: '<rect x="8" y="8" width="12" height="12" rx="1"/>' + p('M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'),
  sliders: p('M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1') + c(15, 6, 2) + c(9, 12, 2) + c(17, 18, 2),
  fingerprint: p('M12 11v3.5c0 2.2-.6 4.3-1.7 6M8.5 9.6A3.5 3.5 0 0 1 15.5 11v1.5M15.5 15.5c-.2 1.8-.7 3.5-1.5 5M5.4 16.5A11 11 0 0 0 6 12a6 6 0 0 1 9.6-4.8M18 9.5c.3.8.5 1.6.5 2.5 0 1.3-.1 2.6-.4 3.9M3.6 12.5a8.4 8.4 0 0 1 2.2-7.3M8.2 2.9A9 9 0 0 1 20.4 8'),
  spy: p('M3 11h18M6 11l1.5-6.2a1 1 0 0 1 1.3-.7L12 5.2l3.2-1.1a1 1 0 0 1 1.3.7L18 11M10.3 16h3.4') + c(7.5, 16, 2.8) + c(16.5, 16, 2.8),
  clip: p('M16.5 6.5l-7.8 7.8a2 2 0 0 0 2.8 2.8l8-8a4 4 0 0 0-5.6-5.6l-8.3 8.3a6 6 0 0 0 8.5 8.5l6.4-6.4'),
  qr: p('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2'),
  link: p('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),
  list: p('M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01'),
  edit: p('M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4'),
  // pack icons
  bag: p('M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2'),
  pin: p('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z') + c(12, 9.5, 2.5),
  book: p('M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5zM4 20a2 2 0 0 0 2 2h13v-4M8 7h7'),
  rings: c(9, 14, 5) + c(15, 14, 5) + p('M7.5 6L9 3.5 10.5 6'),
  ball: c(12, 12, 9) + p('M12 7.5l4 2.9-1.5 4.7h-5L8 10.4zM12 3v4.5M16 10.4l4.3-1.4M14.5 15.1l2.7 3.8M9.5 15.1l-2.7 3.8M8 10.4L3.7 9'),
  plane: p('M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V9l8 4.5V16l-8-2.5v4.5l2.5 2V22L12 21l-4 1v-2l2.5-2v-4.5l-8 2.5v-2.5l8-4.5z'),
  tool: p('M3 8h18v11H3zM8.5 8V5.5h7V8M3 13h18'),
  pot: p('M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6zM2 10h2M20 10h2M9 6.5c0-1 1-1.5 1-2.5M14 6.5c0-1 1-1.5 1-2.5'),
  lantern: p('M10 2h4M12 2v2M8 4h8l1 3H7zM7 7c-1 3-1 8 0 11h10c1-3 1-8 0-11M8 18l-1 3h10l-1-3M12 10v5'),
  dallah: p('M9 3h4M11 3v2M7 21h10M8 21c-1.5-4 0-9 2-12h2c2.5 3 3.5 8 2 12M14 11l5-3-1 4-3.5 2'),
  pyramid: p('M2 20h20L12 4zM12 4l3 16M8.5 13.5h7.5'),
  film: '<rect x="3" y="4" width="18" height="16" rx="1"/>' + p('M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4'),
  paw: c(7, 9.5, 1.8) + c(10.5, 6, 1.8) + c(14.5, 6, 1.8) + c(18, 9.5, 1.8) + p('M12 11c-3 0-6 4.5-6 7 0 1.5 1 2 2.2 2 1.5 0 2.4-.8 3.8-.8s2.3.8 3.8.8c1.2 0 2.2-.5 2.2-2 0-2.5-3-7-6-7z'),
  house: p('M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5'),
};

export function icon(name, { size = 24, label = '' } = {}) {
  const body = ICONS[name] || ICONS.card;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ic ic-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}
