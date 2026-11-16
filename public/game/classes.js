// The yachts you can race: the JPK 1050 offshore racer (the default), the Bavaria 46
// cruiser, the J/70 and RS21 sportboats, the Laser (ILCA) single-handed dinghy, the Optimist children's pram and the AC75 foiling monohull. A race is one-design: every boat in it is the same class, so the class is chosen for
// the page, as the venue is (venues.js pageVenue): ?boat= in the address wins; a free race sails what its set-up chose
// (localStorage 'regatta', yacht); today's race the day's (dailyYacht, below); every other page the JPK 1050.
// lib/yachts.ts has the same ids and the words the site shows about them.

// a polar: knots by true wind speed (tws, the columns) and true wind angle (twa, the rows); beat: the close-hauled
// angle and beatV the speed there, for each tws
const TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
const TWA = [52, 60, 75, 90, 110, 120, 135, 150, 165, 180];

export const CLASSES = {
  // the JPK 1050: JPK Composites' 34-foot offshore racer (Jacques Valer and Jean-Baptiste Dejeanty, 2025), built for
  // IRC and two-handed racing — a scow-inspired hull with a wide transom and twin rudders, a T-keel, a tiller, a carbon
  // rig with a square-top main, a gennaker on a fixed bowsprit and a code zero. Some 3.5 tonnes: quicker to get going
  // and to lose way than a heavier 40-footer, and from about 16 knots of wind she planes on the reaches and runs.
  // She sails to the ORC certificate of SOLENN (FRA 53516, 2026, GPH 581.4): its speeds at each angle; close-hauled,
  // its beat angle (10 knots' smoothed to 40°) at its beat VMG; 165° and 180° from its downwind VMGs there.
  jpk1050: {
    id: 'jpk1050', loa: 10.45, beam: 3.54, drawnL: 10.45, crew: 4,
    kite: true, zero: true, reef: true, j3: true,
    tau: 4.5, coast: 32, hullV: 12, heelK: 1, awsK: 1, heelShow: 1, courseK: 1, lineK: 1, startK: 1,
    tws: TWS, twa: TWA,
    beat: [45.8, 43, 40.4, 40, 39.2, 38.5, 38.4, 39.2, 40],
    beatV: [3.92, 5.22, 6.01, 6.53, 6.71, 6.77, 6.84, 6.94, 7.0],
    v: [
      [4.28, 4.61, 4.86, 4.77, 4.44, 4.3, 3.81, 3.15, 2.35, 1.97],
      [5.78, 6.06, 6.26, 6.17, 6.16, 6.03, 5.38, 4.53, 3.56, 2.99],
      [6.74, 6.96, 7.1, 7.12, 7.25, 7.16, 6.68, 5.68, 4.67, 3.97],
      [7.23, 7.43, 7.6, 7.71, 7.95, 7.86, 7.46, 6.7, 5.66, 4.87],
      [7.43, 7.69, 8.01, 8.18, 8.56, 8.58, 8.12, 7.43, 6.58, 5.71],
      [7.53, 7.82, 8.28, 8.52, 9.03, 9.44, 8.9, 8.01, 7.28, 6.46],
      [7.61, 7.92, 8.42, 8.92, 9.69, 10.23, 9.96, 8.64, 7.77, 7.03],
      [7.71, 8.04, 8.64, 9.42, 10.99, 11.74, 12.8, 10.56, 8.84, 7.94],
      [7.74, 8.11, 8.81, 9.95, 11.84, 13.41, 15.25, 14.62, 10.21, 8.95],
    ],
  },
  // the Bavaria 46: the Farr-designed Cruiser 46, the charter fleets' boat — some fourteen tonnes as she sails, a
  // furling genoa and an in-mast furling main, a cruising gennaker tacked to a short sprit at the bow. Slow to get
  // going and slow to lose way; a reef (a few turns of the main rolled away) for a blow, no code zero and no J3. Her
  // courses are the JPK 1050's length, laid 1.3 times as wide (the line, the room at the marks) for a fleet of 14 m
  // boats that turn and stop slowly.
  bavaria46: {
    id: 'bavaria46', loa: 14.27, beam: 4.35, drawnL: 14.27, crew: 5,
    kite: true, zero: false, reef: true, j3: false,
    tau: 7, coast: 50, hullV: 8.6, heelK: 1.1, awsK: 1, heelShow: 1, courseK: 1, lineK: 1.3, startK: 1.3,
    tws: TWS, twa: TWA,
    // the median of 29 ORC Club certificates of the Farr-designed Cruiser 46 (data.orc.org, 2026), all with a
    // gennaker; 4 and 24 knots extended from 6 and 20
    beat: [49, 47.1, 45.7, 44.1, 43.0, 41.9, 41.3, 41.2, 41.5],
    beatV: [2.9, 4.16, 5.15, 5.85, 6.41, 6.83, 7.11, 7.29, 7.35],
    v: [
      [3.05, 3.3, 3.45, 3.7, 3.8, 3.7, 3.3, 2.8, 2.45, 2.25],
      [4.48, 4.85, 5.08, 5.45, 5.63, 5.47, 4.86, 4.09, 3.6, 3.3],
      [5.61, 5.98, 6.23, 6.73, 6.96, 6.78, 6.15, 5.28, 4.65, 4.25],
      [6.44, 6.8, 7.08, 7.66, 7.9, 7.75, 7.2, 6.3, 5.6, 5.1],
      [7.08, 7.42, 7.69, 8.24, 8.46, 8.36, 7.96, 7.16, 6.4, 5.85],
      [7.56, 7.86, 8.1, 8.56, 8.88, 8.81, 8.48, 7.83, 7.1, 6.5],
      [7.88, 8.15, 8.4, 8.72, 9.26, 9.23, 8.9, 8.3, 7.8, 7.2],
      [8.1, 8.41, 8.79, 8.96, 9.81, 10.06, 9.78, 9.01, 8.4, 7.7],
      [8.2, 8.55, 8.95, 9.15, 10.2, 10.6, 10.5, 9.7, 9.0, 8.3],
    ],
  },
  // the J/70: a 22-foot sportboat with a retractable bowsprit and an asymmetric spinnaker, sailed by three to five and
  // hiked hard; light (some 800 kg with her crew), quick to accelerate and to lose way, and planing off the wind from
  // about 12 knots
  j70: {
    id: 'j70', loa: 6.93, beam: 2.25, drawnL: 6.93, crew: 4,
    kite: true, zero: false, reef: false, j3: false,
    tau: 2.6, coast: 18, hullV: 15, heelK: 1.1, awsK: 1, heelShow: 1, courseK: 0.8, lineK: 0.8, startK: 0.8,
    tws: TWS, twa: TWA,
    beat: [45, 43, 41, 40, 39.5, 39.5, 40, 41, 42],
    beatV: [3.3, 4.4, 5.2, 5.7, 6.0, 6.15, 6.25, 6.4, 6.45],
    v: [ // a row per tws, a speed per twa above
      [3.9, 4.2, 4.4, 4.4, 4.3, 4.2, 3.7, 3.1, 2.7, 2.4],
      [5.1, 5.4, 5.7, 5.8, 5.8, 5.7, 5.2, 4.4, 3.8, 3.4],
      [5.9, 6.2, 6.5, 6.7, 6.9, 6.8, 6.4, 5.6, 4.9, 4.4],
      [6.4, 6.7, 7.0, 7.3, 7.7, 7.7, 7.4, 6.6, 5.9, 5.4],
      [6.6, 6.95, 7.4, 7.8, 8.6, 8.7, 8.3, 7.4, 6.8, 6.3],
      [6.75, 7.1, 7.7, 8.4, 9.8, 10.0, 9.4, 8.2, 7.6, 7.0],
      [6.85, 7.2, 8.0, 9.2, 11.0, 11.4, 10.8, 9.2, 8.5, 7.8],
      [7.0, 7.4, 8.6, 10.6, 13.0, 13.6, 13.4, 11.6, 10.6, 9.6],
      [7.1, 7.6, 9.2, 11.8, 14.6, 15.4, 15.6, 14.0, 12.8, 11.6],
    ],
  },
  // the RS21: RS Sailing's 21-foot one-design keelboat — a wide-open cockpit, a lifting bulb keel, a sprit and a big
  // gennaker, raced by two to four. A little lighter (about 650 kg) and a touch slower upwind than the J/70, quicker to
  // plane off the wind in a moderate breeze
  rs21: {
    id: 'rs21', loa: 6.67, beam: 2.2, drawnL: 6.67, crew: 3,
    kite: true, zero: false, reef: false, j3: false,
    tau: 2.4, coast: 17, hullV: 15, heelK: 1.15, awsK: 1, heelShow: 1, courseK: 0.8, lineK: 0.8, startK: 0.8,
    tws: TWS, twa: TWA,
    beat: [45, 43.5, 41.5, 40.5, 40, 40, 40.5, 41.5, 42.5],
    beatV: [3.2, 4.3, 5.1, 5.55, 5.85, 6.0, 6.1, 6.25, 6.3],
    v: [
      [3.8, 4.1, 4.3, 4.35, 4.3, 4.2, 3.7, 3.1, 2.7, 2.4],
      [5.0, 5.3, 5.6, 5.75, 5.8, 5.7, 5.25, 4.45, 3.85, 3.4],
      [5.8, 6.1, 6.45, 6.7, 7.0, 6.95, 6.55, 5.7, 5.0, 4.5],
      [6.25, 6.55, 6.95, 7.35, 7.95, 8.0, 7.7, 6.8, 6.05, 5.5],
      [6.45, 6.8, 7.35, 7.95, 9.0, 9.2, 8.8, 7.7, 7.0, 6.4],
      [6.6, 6.95, 7.65, 8.6, 10.2, 10.5, 9.9, 8.5, 7.8, 7.1],
      [6.7, 7.05, 7.95, 9.3, 11.3, 11.8, 11.2, 9.5, 8.7, 7.9],
      [6.85, 7.25, 8.5, 10.6, 13.1, 13.8, 13.6, 11.8, 10.7, 9.7],
      [6.9, 7.4, 9.0, 11.7, 14.5, 15.3, 15.5, 14.0, 12.8, 11.6],
    ],
  },
  // the Laser (ILCA 7): the 14-foot single-handed Olympic dinghy — one sail on an unstayed mast, no jib (jib: false: one
  // sheet, never split), no kite. Some 60 kg of hull and one sailor hiking: she stops in a tack and goes again at once,
  // and from about 12 knots planes on the reaches. Slow upwind beside the keelboats: her courses are laid 0.6 times as
  // long.
  laser: {
    id: 'laser', loa: 4.19, beam: 1.39, drawnL: 4.19, crew: 1,
    kite: false, zero: false, reef: false, j3: false, jib: false,
    tau: 1.8, coast: 11, hullV: 13, heelK: 1.2, awsK: 1, heelShow: 1, courseK: 0.6, lineK: 0.6, startK: 0.6,
    tws: TWS, twa: TWA,
    // from measured speeds: GPS tracks of World Cup and Olympic races (Pan & Sun 2022), the tank-validated VPP of
    // Day (2017) and Binns' measured polars (2002) — upwind VMG some 3.2 kn in 8 knots, 3.7 in 12; downwind she surfs
    beat: [44, 43, 41.5, 41, 41, 42, 43, 44, 45],
    beatV: [2.75, 3.65, 4.35, 4.8, 4.95, 5.1, 5.2, 5.3, 5.25],
    v: [
      [3.0, 3.15, 3.3, 3.35, 3.25, 3.15, 2.95, 2.7, 2.5, 2.4],
      [3.95, 4.15, 4.35, 4.45, 4.4, 4.25, 4.0, 3.7, 3.45, 3.35],
      [4.65, 4.9, 5.2, 5.4, 5.4, 5.3, 5.0, 4.75, 4.45, 4.3],
      [5.1, 5.4, 5.85, 6.3, 6.5, 6.35, 5.9, 5.5, 5.2, 5.0],
      [5.35, 5.7, 6.3, 7.2, 7.5, 7.3, 6.9, 6.6, 6.2, 6.0],
      [5.5, 5.9, 6.8, 8.1, 8.6, 8.4, 7.9, 7.4, 6.9, 6.6],
      [5.6, 6.05, 7.3, 9.0, 9.7, 9.5, 8.9, 8.3, 7.6, 7.2],
      [5.7, 6.2, 8.0, 10.3, 11.4, 11.2, 10.5, 9.6, 8.7, 8.2],
      [5.7, 6.25, 8.4, 11.0, 12.6, 12.5, 11.8, 10.8, 9.8, 9.2],
    ],
  },
  // the Optimist: the 2.3 m single-handed pram most racing sailors learn in, raced up to the age of 15 — a flat-floored
  // box with a transom at the bow too, one spritsail on a short unstayed mast, no jib (jib: false: one sheet) and no
  // kite. Some 35 kg of hull and a child aboard: she stops in a tack and goes again at once, slow but nimble. A short
  // waterline holds her to about 3 knots upwind and 5–6 on a broad reach in a blow, where her sailor, overpowered,
  // eases and hikes to keep her flat; she lifts onto a plane only on the biggest reaching gusts. Her courses are laid
  // 0.3 times as long, as many of her lengths as the Laser's are of hers; her start line as long as the Laser's (a
  // fleet of them starts in a crowd, and the computer skippers need the room to come through it).
  optimist: {
    id: 'optimist', loa: 2.31, beam: 1.13, drawnL: 2.31, crew: 1,
    kite: false, zero: false, reef: false, j3: false, jib: false,
    tau: 1.4, coast: 6, hullV: 4.2, heelK: 1.1, awsK: 1, heelShow: 1, courseK: 0.3, lineK: 0.6, startK: 0.6,
    tws: TWS, twa: TWA,
    // a displacement hull 2.2 m on the waterline: upwind VMG some 2.1 kn in 8 knots, 2.3 in 12, falling off as she is
    // overpowered; downwind no faster than her hull lets her, but for a reach in a breeze
    beat: [47, 46, 45, 45, 45, 46, 47, 48, 50],
    beatV: [1.85, 2.5, 2.95, 3.2, 3.3, 3.3, 3.3, 3.15, 2.95],
    v: [
      [2.0, 2.15, 2.3, 2.3, 2.2, 2.1, 1.9, 1.7, 1.5, 1.4],
      [2.7, 2.85, 3.0, 3.05, 2.95, 2.85, 2.6, 2.3, 2.1, 2.0],
      [3.15, 3.3, 3.5, 3.6, 3.55, 3.45, 3.2, 2.9, 2.65, 2.55],
      [3.4, 3.55, 3.8, 3.95, 4.0, 3.9, 3.65, 3.35, 3.1, 3.0],
      [3.5, 3.7, 4.0, 4.25, 4.4, 4.35, 4.1, 3.75, 3.45, 3.35],
      [3.55, 3.75, 4.1, 4.5, 4.8, 4.75, 4.5, 4.1, 3.8, 3.65],
      [3.55, 3.75, 4.15, 4.7, 5.2, 5.15, 4.9, 4.45, 4.1, 3.95],
      [3.4, 3.65, 4.1, 4.9, 5.7, 5.7, 5.4, 4.9, 4.5, 4.3],
      [3.2, 3.5, 4.0, 4.9, 5.9, 6.0, 5.7, 5.2, 4.8, 4.5],
    ],
  },
  // the AC75: the America's Cup's 75-foot foiling monohull. Two canting foil arms lift her clear of the water from
  // about 9 knots of boat speed, and then she sails at three times the wind's speed and more, the apparent wind always
  // ahead: no spinnaker, only the double-skinned main and a jib. Off her foils (slow out of a tack, a stop, light air)
  // she is a heavy displacement boat until she builds the speed to take off again. Courses for her are laid longer.
  ac75: {
    id: 'ac75', loa: 20.7, beam: 5.0, drawnL: 20.7, crew: 8, // the rule's hull length: no bowsprit since the 37th Cup
    kite: false, zero: false, reef: false, j3: false,
    tau: 3.2, coast: 420, hullV: 60, heelK: 0.35, awsK: 2.6, heelShow: 0.45, courseK: 2.5, lineK: 1.8, startK: 4,
    foil: { takeoff: 9, land: 6.5, dispCoast: 30, disp: [[28, 0], [40, 1.3], [60, 1.55], [90, 1.9], [120, 1.8], [150, 1.3], [180, 0.9]] },
    tws: TWS, twa: TWA,
    beat: [48, 46, 44, 43, 42, 42, 42, 43, 44],
    beatV: [14, 22, 28, 32, 35, 37, 39, 41, 42],
    v: [
      [15, 16, 17, 17, 17, 16, 15, 12, 9, 7],
      [24, 26, 28, 28, 28, 27, 25, 21, 16, 13],
      [30, 32, 34, 35, 35, 34, 32, 28, 22, 18],
      [34, 36, 38, 39, 40, 39, 37, 33, 27, 22],
      [37, 39, 41, 42, 43, 42, 40, 36, 30, 25],
      [39, 41, 43, 44, 45, 44, 42, 38, 32, 27],
      [41, 43, 45, 46, 47, 46, 44, 40, 34, 29],
      [43, 45, 47, 48, 49, 48, 46, 42, 36, 31],
      [44, 46, 48, 49, 50, 49, 47, 43, 37, 32],
    ],
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const DEFAULT_CLASS = 'jpk1050';
export const classById = (id) => CLASSES[id] || CLASSES[DEFAULT_CLASS];

// Today's race's yacht, a new one every day: from the day each joins today's races (DAILY_YACHTS) the days go round
// them in a shuffled order, every one of them in turn and never the same two days running; the days before the first
// joined, the JPK 1050. A class not in DAILY_YACHTS sails only free races. lib/race.ts dailyYacht does the
// same, and npm test keeps the two in step.
// The AC75 joins on 18 November: she sails a course in under half the JPK 1050's time, and the scores server
// (api/game.mjs in the iyt-test repo) checks her times against her own share of its floor (YACHT_FLOOR) from then on.
// npm test sails every one of them well above the floor the server keeps for her.
export const DAILY_YACHTS = { jpk1050: '2026-11-16', bavaria46: '2026-11-16', j70: '2026-11-16', rs21: '2026-11-16', laser: '2026-11-16', ac75: '2026-11-18' };
const dayN = (s) => Math.floor(Date.parse(s) / 864e5);
export const YACHT_ROUNDS = [...new Set(Object.values(DAILY_YACHTS).map(dayN))].sort((a, b) => a - b)
  .map((n0) => ({ n0, ids: Object.keys(DAILY_YACHTS).filter((id) => dayN(DAILY_YACHTS[id]) <= n0) }));
function yachtRound(ids, k) {
  let s = ((k + 1) * 69069 + 4111) >>> 0 || 1; // the venues' generator (venues.js), seeded on its own
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function yachtOn(n) {
  if (n < YACHT_ROUNDS[0].n0) return DEFAULT_CLASS;
  let e = YACHT_ROUNDS.length - 1; while (e > 0 && n < YACHT_ROUNDS[e].n0) e--;
  const { n0, ids } = YACHT_ROUNDS[e], len = ids.length, k = Math.floor((n - n0) / len), a = yachtRound(ids, k);
  if (len > 1 && a[0] === (k > 0 ? yachtRound(ids, k - 1)[len - 1] : yachtOn(n0 - 1))) [a[0], a[1]] = [a[1], a[0]];
  return a[n - n0 - k * len];
}
export const dailyYacht = (date = new Date()) => yachtOn(dayN(date.toISOString().slice(0, 10)));

export function pageClass() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('boat')) return classById(q.get('boat'));
    if (q.get('race') === 'free') return classById(JSON.parse(localStorage.getItem('regatta') || '{}').yacht);
    if (/^\/play/.test(location.pathname) && !q.get('drill')) return classById(dailyYacht()); // a drill: the JPK 1050
  } catch (e) {}
  return CLASSES[DEFAULT_CLASS];
}
export const CLS = pageClass();
