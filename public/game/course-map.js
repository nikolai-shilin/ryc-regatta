// The course map's pure parts (main.js draws it on its canvas): its colours, the broadcast's tokens, and where the
// boats' labels go without covering each other or the boats. test/ui.test.mjs.

// the tokens the map draws in (public/ui/tokens.css), with their values for when the page can't give them
export const MAP_TOKENS = {
  buoy: ['--buoy', '#ff7a1a'], you: ['--you', '#3db8ff'], gold: ['--gold', '#f5c400'], live: ['--live', '#ff3b30'],
  inkOn: ['--ink-on', '#04121e'], ink: ['--ink', '#ffffff'], panel: ['--panel', 'rgba(5, 10, 18, 0.88)'],
  w06: ['--w-06', 'rgba(255, 255, 255, 0.06)'], w10: ['--w-10', 'rgba(255, 255, 255, 0.1)'], w14: ['--w-14', 'rgba(255, 255, 255, 0.14)'],
  w25: ['--w-25', 'rgba(255, 255, 255, 0.25)'], w35: ['--w-35', 'rgba(255, 255, 255, 0.35)'], w50: ['--w-50', 'rgba(255, 255, 255, 0.5)'],
  w62: ['--w-62', 'rgba(255, 255, 255, 0.62)'], w78: ['--w-78', 'rgba(255, 255, 255, 0.78)'], w90: ['--w-90', 'rgba(255, 255, 255, 0.9)'],
  cond: ['--cond', "'Sofia Sans Condensed', 'Arial Narrow', sans-serif"],
};
// the map's palette, read once (a canvas can't use CSS variables): `read` gives a variable's value, '' when unset
export function mapPalette(read = () => '') {
  const o = {};
  for (const [k, [v, fall]] of Object.entries(MAP_TOKENS)) o[k] = String(read(v) || '').trim() || fall;
  return o;
}

// labels beside dots: each item {x, y, w, h} (its dot's centre, its label's size), in the order they matter. A label
// goes to the right of its dot, else to the left, inside the map, clear of the labels already placed, of the `blocked`
// boxes and of every dot in `dots`; where it fits nowhere, it's left out (null)
export function placeLabels(items, { size, gap = 9, dot = 6, dots = [], blocked = [] }) {
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const taken = [...blocked], round = dots.map((d) => ({ x: d.x - dot, y: d.y - dot, w: 2 * dot, h: 2 * dot }));
  return items.map((it) => {
    for (const x of [it.x + gap, it.x - gap - it.w]) {
      const r = { x, y: it.y - it.h / 2, w: it.w, h: it.h };
      if (r.x < 0 || r.y < 0 || r.x + r.w > size || r.y + r.h > size) continue;
      if (taken.some((b) => hit(r, b)) || round.some((b) => hit(r, b))) continue;
      taken.push(r);
      return r;
    }
    return null;
  });
}
