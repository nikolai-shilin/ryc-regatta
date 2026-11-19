// Regatta: what the site's admin has put up (/admin, which /sponsor serves): the logo on every jib, every mainsail and
// every gennaker, the colours every jib and gennaker is dyed (yacht.js), and the words on the plane's banner
// (plane.js). Asked for once a page; no answer, the game's own defaults. A race (/play, or any page given ?venue=)
// names its venue, which may have pictures and colours of its own; the site's other views of the boats (your boat's
// page, the home page's) show every venue's.
//   → { jib: 'https://…png' | null, main: 'https://…png' | null, kite: 'https://…png' | null,
//       colors: { jib: '#rrggbb' | 'own' | null, kite: '#rrggbb' | null }, banner: ['first words', 'second words'?] | null }
import { VENUE } from './venues.js';

// the venue a race on this page is at, or null for none
export function sponsorVenue() {
  try {
    return new URLSearchParams(location.search).get('venue') || /^\/play/.test(location.pathname) ? VENUE.id : null;
  } catch (e) {
    return null;
  }
}
let promise = null;
export function sponsor() {
  const venue = sponsorVenue();
  if (!promise) promise = fetch(venue ? `/sponsor?venue=${encodeURIComponent(venue)}` : '/sponsor').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return promise;
}
