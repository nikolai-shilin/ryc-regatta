// Regatta: what the site's admin has put up (/admin, which /sponsor serves): the logo on every jib (yacht.js) and the
// words on the plane's banner (plane.js). Asked for once a page; no answer, the game's own defaults.
//   → { jib: 'https://…png' | null, banner: ['first words', 'second words'?] | null }
let promise = null;
export function sponsor() {
  if (!promise) promise = fetch('/sponsor').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return promise;
}
