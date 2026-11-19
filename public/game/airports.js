// Regatta: the airports close enough to a race course for their traffic to come over it. Numbers only (no three.js,
// nothing fetched), so the picture (airliners.js) and the tests can both ask.
//
// Close means within 25 km of the course, the last miles of an approach or the first of a climb. A venue that isn't
// here has no airport with airliners that near (Kiel, Newport, Enoshima, Lake Garda…) and sees none.
// runways: [lat, lon, lat, lon], the two ends of each, from OpenStreetMap: the longest, and one crossing it if the
// airport has a long one. wide: long-haul traffic comes here too, not only the narrow-bodies.
export const CLOSE = 25000; // metres

export const AIRPORTS = {
  gocek: { code: 'DLM', name: 'Dalaman', wide: false, runways: [[36.70021, 28.78807, 36.72612, 28.79688]] },
  cowes: { code: 'SOU', name: 'Southampton', wide: false, runways: [[50.95718, -1.35295, 50.9436, -1.36052]] },
  sydney: { code: 'SYD', name: 'Sydney', wide: true, runways: [[-33.93012, 151.17177, -33.96426, 151.18065], [-33.94375, 151.16364, -33.9378, 151.18885]] },
  antigua: { code: 'ANU', name: 'V. C. Bird', wide: true, runways: [[17.1312, -61.80201, 17.14181, -61.78409]] },
  auckland: { code: 'AKL', name: 'Auckland', wide: true, runways: [[-37.01632, 174.77078, -37.00666, 174.80577]] },
  'san-francisco': { code: 'SFO', name: 'San Francisco', wide: true, runways: [[37.61393, -122.35809, 37.62874, -122.3934], [37.60769, -122.38013, 37.62732, -122.36714]] },
  valencia: { code: 'VLC', name: 'Valencia', wide: false, runways: [[39.48477, -0.4697, 39.49637, -0.50013]] },
  barcelona: { code: 'BCN', name: 'Barcelona', wide: true, runways: [[41.30573, 2.10376, 41.29484, 2.07193], [41.30928, 2.09466, 41.28778, 2.08485]] },
  palma: { code: 'PMI', name: 'Palma', wide: false, runways: [[39.56217, 2.74251, 39.54715, 2.71076]] },
  bermuda: { code: 'BDA', name: 'L. F. Wade', wide: false, runways: [[32.36637, -64.69223, 32.3614, -64.66332]] },
  marseille: { code: 'MRS', name: 'Marseille Provence', wide: false, runways: [[43.44703, 5.20036, 43.43141, 5.2226]] },
  rio: { code: 'SDU', name: 'Santos Dumont', wide: false, runways: [[-22.91649, -43.16244, -22.9046, -43.16321]] },
  'st-petersburg': { code: 'LED', name: 'Pulkovo', wide: false, runways: [[59.79991, 30.21842, 59.79034, 30.2828]] },
  batumi: { code: 'BUS', name: 'Batumi', wide: false, runways: [[41.617, 41.58893, 41.60235, 41.61149]] },
  scheveningen: { code: 'RTM', name: 'Rotterdam The Hague', wide: false, runways: [[51.96186, 4.45271, 51.95304, 4.43065]] },
  'cape-town': { code: 'CPT', name: 'Cape Town', wide: true, runways: [[-33.98775, 18.6089, -33.95984, 18.60005]] },
  athens: { code: 'ATH', name: 'Athens', wide: true, runways: [[37.92592, 23.94551, 37.95037, 23.96879]] },
  sochi: { code: 'AER', name: 'Sochi', wide: false, runways: [[43.43948, 39.92585, 43.45048, 39.95804], [43.43434, 39.94461, 43.45401, 39.95941]] },
  melbourne: { code: 'MEL', name: 'Melbourne', wide: true, runways: [[-37.65319, 144.83491, -37.68574, 144.84098], [-37.66077, 144.82224, -37.66226, 144.84807]] },
  'gold-coast': { code: 'OOL', name: 'Gold Coast', wide: false, runways: [[-28.15652, 153.50071, -28.17256, 153.51092]] },
  'new-york': { code: 'EWR', name: 'Newark', wide: true, runways: [[40.68054, -74.17238, 40.69785, -74.16137], [40.70126, -74.15739, 40.7028, -74.1807]] },
  naples: { code: 'NAP', name: 'Naples', wide: false, runways: [[40.88168, 14.28155, 40.89139, 14.30213]] },
  'los-angeles': { code: 'LGB', name: 'Long Beach', wide: false, runways: [[33.80695, -118.13825, 33.82616, -118.1615]] },
  dubai: { code: 'DXB', name: 'Dubai', wide: true, runways: [[25.23592, 55.39486, 25.2562, 55.35829]] },
  miami: { code: 'MIA', name: 'Miami', wide: true, runways: [[25.7877, -80.27614, 25.78627, -80.31071], [25.79929, -80.3023, 25.78791, -80.28004]] },
  split: { code: 'SPU', name: 'Split', wide: false, runways: [[43.53203, 16.28549, 43.5451, 16.30899]] },
  monaco: { code: 'NCE', name: 'Nice', wide: true, runways: [[43.64674, 7.2025, 43.66559, 7.22843]] },
  'sint-maarten': { code: 'SXM', name: 'Princess Juliana', wide: true, runways: [[18.03952, -63.11876, 18.04245, -63.09822]] },
  'tbilisi-sea': { code: 'TBS', name: 'Tbilisi', wide: false, runways: [[41.6780596, 44.9398557, 41.6582654, 44.964827]] },
  malta: { code: 'MLA', name: 'Malta', wide: false, runways: [[35.83514, 14.50519, 35.85642, 14.47885]] },
  'saint-malo': { code: 'DNR', name: 'Dinard', wide: false, runways: [[48.598, -2.08267, 48.57875, -2.0776]] },
  hobart: { code: 'HBA', name: 'Hobart', wide: false, runways: [[-42.82822, 147.50103, -42.84558, 147.52458]] },
  'lake-geneva': { code: 'GVA', name: 'Geneva', wide: true, runways: [[46.2504, 6.12708, 46.22565, 6.09077]] },
  'san-diego': { code: 'SAN', name: 'San Diego', wide: true, runways: [[32.73, -117.17498, 32.73713, -117.20437]] },
  cork: { code: 'ORK', name: 'Cork', wide: false, runways: [[51.83227, -8.48579, 51.85027, -8.49644]] },
  chicago: { code: 'MDW', name: 'Midway', wide: false, runways: [[41.77917, -87.75932, 41.792, -87.74307]] },
  helsinki: { code: 'HEL', name: 'Helsinki', wide: true, runways: [[60.30949, 24.93241, 60.33066, 24.97903], [60.30712, 24.98827, 60.33023, 24.96455]] },
  gdynia: { code: 'GDN', name: 'Gdańsk', wide: false, runways: [[54.37129, 18.4917, 54.38105, 18.45213]] },
  tivat: { code: 'TIV', name: 'Tivat', wide: false, runways: [[42.4131, 18.71334, 42.39624, 18.73321]] },
  singapore: { code: 'SIN', name: 'Changi', wide: true, runways: [[1.32239, 103.99984, 1.35618, 104.01411]] },
  muscat: { code: 'MCT', name: 'Muscat', wide: true, runways: [[23.59168, 58.26699, 23.59493, 58.30731]] },
  'buenos-aires': { code: 'AEP', name: 'Aeroparque', wide: false, runways: [[-34.55227, -58.42829, -34.56569, -58.40419]] },
  busan: { code: 'PUS', name: 'Gimhae', wide: true, runways: [[35.16519, 128.93882, 35.19642, 128.93479]] },
};

const GLIDE = Math.tan(3 * Math.PI / 180); // the approach's three degrees
const CLIMB = 0.085; // a climb out's gradient, about five degrees
const FINAL = 8000; // metres of straight-in final, from the fix an arrival is making for down to the runway
const OUT = 3000; // metres past the runway's end before a departure turns on course
export const HALF = 8000; // metres of her track either side of the course (the camera's far plane is 9 km)
export const STEP = 100; // metres between the heights of her profile
const STEEP = 0.09, CLEAR = 170; // the steepest she changes height, and the metres she keeps over the land
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const airportOf = (id) => AIRPORTS[id] || null;

// (lat, lon) → metres in the land's frame (blender/venues.py to_xz): from its origin, turned by `turn` so the venue's
// prevailing wind comes from −z
export function frameOf({ origin: [lat0, lon0], turn }) {
  const th = turn * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), mLat = 110574, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return (lat, lon) => {
    const x = (lon - lon0) * mLon, z = -(lat - lat0) * mLat;
    return { x: x * co + z * si, z: z * co - x * si };
  };
}

// the runway in use: of each one's two directions, the one pointing most nearly into the wind, which in the land's frame
// blows from −z. T: where they touch down; E: its far end; f: the way they land and take off
export function runwayInUse(runways, frame) {
  let best = null;
  for (const [a, b, c, d] of runways) {
    const p = frame(a, b), q = frame(c, d), L = Math.hypot(q.x - p.x, q.z - p.z);
    for (const [T, E] of [[p, q], [q, p]]) {
      const f = { x: (E.x - T.x) / L, z: (E.z - T.z) / L };
      if (!best || -f.z > -best.f.z) best = { T, E, f, L };
    }
  }
  return best;
}

// a pass over the course at `at`: in, making for the fix on the runway's final; out, from the end of the climb-out.
// dir: the way she flies over the course. flown: metres from there to the touchdown, or from the start of her take-off
// run to there. height: metres over the course, what those metres give, within what still shows from the water
export function route(kind, rw, at) {
  const inbound = kind === 'in';
  const fix = inbound ? { x: rw.T.x - rw.f.x * FINAL, z: rw.T.z - rw.f.z * FINAL } : { x: rw.E.x + rw.f.x * OUT, z: rw.E.z + rw.f.z * OUT };
  const dx = inbound ? fix.x - at.x : at.x - fix.x, dz = inbound ? fix.z - at.z : at.z - fix.z, d = Math.hypot(dx, dz);
  const dir = d > 1500 ? { x: dx / d, z: dz / d } : { x: rw.f.x, z: rw.f.z }; // the course right under the fix: straight along the runway's line
  const flown = inbound ? d + FINAL : rw.L + OUT + d;
  return { dir, flown, height: inbound ? clamp(flown * GLIDE, 300, 520) : clamp(flown * CLIMB, 320, 650) };
}

// her height along the track through (x0, z0), every STEP metres from s = −HALF to HALF: coming down or going up through
// the height H of this pass, clear of the land under her (ground(x, z)), and changing no steeper than she can. Null when
// the hills would hold her too high over the course
export function flightProfile(kind, H, x0, z0, f, ground) {
  const n = Math.ceil(2 * HALF / STEP) + 1, a = new Float32Array(n), mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const s = (i - mid) * STEP, base = kind === 'in' ? clamp(H - 0.035 * s, 180, H + 280) : clamp(H + 0.07 * s, 200, H + 520);
    const g = ground(x0 + f.x * s, z0 + f.z * s);
    a[i] = g > 0 ? Math.max(base, g + CLEAR) : base;
  }
  for (let i = 1; i < n; i++) a[i] = Math.max(a[i], a[i - 1] - STEEP * STEP);
  for (let i = n - 2; i >= 0; i--) a[i] = Math.max(a[i], a[i + 1] - STEEP * STEP);
  return a[mid] > Math.max(H + 320, 850) ? null : a;
}

// seconds to the next pass: rare, five to nine minutes or so, the closer the airport the sooner
export const gapFor = (metres, r = Math.random()) => (300 + metres / 100) * (0.7 + 0.6 * r);
