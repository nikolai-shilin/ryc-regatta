// The yachts you can race: the club's 40-footer (the default, and the only one in today's race), the J/70 and RS21
// sportboats and the AC75 foiling monohull. A race is one-design: every boat in it is the same class, so the class is chosen for
// the page, as the venue is (venues.js pageVenue): ?boat= in the address wins; a free race sails what its set-up chose
// (localStorage 'regatta', yacht); today's race, and every other page, the club's 40-footer.
// lib/yachts.ts has the same ids and the words the site shows about them.

// a polar: knots by true wind speed (tws, the columns) and true wind angle (twa, the rows); beat: the close-hauled
// angle and beatV the speed there, for each tws
const TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
const TWA = [52, 60, 75, 90, 110, 120, 135, 150, 165, 180];

export const CLASSES = {
  // a 40-foot racer-cruiser, sailing to a Beneteau First 40.7's measured polar (sim.js keeps its own table: this
  // class leaves the game exactly as it was)
  club40: {
    id: 'club40', loa: 12.2, beam: 3.7, drawnL: 10.4, crew: 4,
    kite: true, zero: true, reef: true, j3: true,
    tau: 6, coast: 40, hullV: 8, heelK: 1, awsK: 1, heelShow: 1, courseK: 1, lineK: 1, startK: 1,
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
  // the AC75: the America's Cup's 75-foot foiling monohull. Two canting foil arms lift her clear of the water from
  // about 9 knots of boat speed, and then she sails at three times the wind's speed and more, the apparent wind always
  // ahead: no spinnaker, only the double-skinned main and a jib. Off her foils (slow out of a tack, a stop, light air)
  // she is a heavy displacement boat until she builds the speed to take off again. Courses for her are laid longer.
  ac75: {
    id: 'ac75', loa: 22.86, beam: 5.0, drawnL: 22.86, crew: 8,
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
export const DEFAULT_CLASS = 'club40';
export const classById = (id) => CLASSES[id] || CLASSES[DEFAULT_CLASS];

export function pageClass() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('boat')) return classById(q.get('boat'));
    if (q.get('race') === 'free') return classById(JSON.parse(localStorage.getItem('regatta') || '{}').yacht);
  } catch (e) {}
  return CLASSES[DEFAULT_CLASS];
}
export const CLS = pageClass();
