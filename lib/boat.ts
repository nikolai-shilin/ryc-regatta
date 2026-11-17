import { findFlag } from './flags.ts'; // with its extension, so npm test's Node finds it too

// The player's boat: its colours (the gennaker's up to three), the bottom paint and the deck, her name, sail number, logo and flag. The boat page (/boat) saves it in localStorage 'regatta-boat',
// where the game reads it for your yacht at the start of every race (public/game/yacht.js, lookFrom / playerLook).
// A signed-in player's boat also lives in the account (user_metadata.boat, components/bests-sync.tsx), so it follows
// them to another device or address: localStorage is kept per address, and a new one starts with the default boat.

export type Logo = 'ryc' | 'custom' | 'none';
export type Deck = 'nonskid' | 'teak' | 'hull';
export type Boat = {
  preset?: string;
  hull: string;                          // the topsides, the stripe under the sheer and the boot-top all in one colour
  cloth: string; laminate: boolean;      // the mainsail and jib: their colour, and laminate (fibres, a sheen) or Dacron
  ink: string;                           // the sail number (and its letters, without a logo)
  kite: string;                          // the gennaker: its first colour
  kite2?: string; kite3?: string;        // and its second and third, for a gennaker in bands of two or three (none: one colour)
  bottom: string;                        // the antifouling under the waterline
  deck: Deck;                            // moulded non-skid (the class's own), teak planks, or non-skid in the hull's colour
  name?: string;                         // her name on both quarters, in letters that show up against the hull; none for no name
  crew: string; pants: string;           // the team: jackets and trousers
  logo: Logo; logoImg?: string;          // the logo on the main and the bows; logoImg: your own picture as a data: URL
                                         // ('custom' without one shows DEFAULT_LOGO)
  nat: string; num: string;              // the letters (shown without a logo) and the number on the main
  flag?: string;                         // the country flag on the main, high under the head (lib/flags.ts), or none
  at?: number;                           // when the player last changed her (ms); none on a boat saved before the sync
};

export const BOAT_KEY = 'regatta-boat';
// the picture 'Yours' shows until you upload one: the RYC Rentals Bot badge (public/game/yacht.js has the same path)
export const DEFAULT_LOGO = '/images/ryc-rentals-bot.png';

export type Preset = { id: string; en: string; ru: string; boat: Omit<Boat, 'logo' | 'logoImg' | 'nat' | 'num' | 'preset' | 'flag' | 'bottom' | 'deck' | 'name'> };

// one-colour schemes: the hull, the gennaker and the team jackets in one colour, on white sails, with a sail number
// that shows up against it. Picking one keeps your number and logo.
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
};
function mono(id: string, en: string, ru: string, c: string, dark = false): Preset {
  const mark = light(c) ? '#1d1d1d' : '#ffffff';
  const cloth = dark ? '#2a2c30' : '#f4f2ea';
  // a one-colour gennaker: kite2 and kite3 there, unset, so picking a preset clears them
  return { id, en, ru, boat: { hull: c, cloth, laminate: dark, ink: dark || light(c) ? mark : c, kite: c, kite2: undefined, kite3: undefined, crew: c, pants: dark ? c : '#262a31' } };
}
export const PRESETS: Preset[] = [
  mono('white', 'White', 'Белая', '#f4f3ef'),
  mono('silver', 'Silver', 'Серебро', '#b9bec4'),
  mono('black', 'Black', 'Чёрная', '#1c1f24', true),
  mono('navy', 'Navy', 'Тёмно-синяя', '#16325c'),
  mono('blue', 'Blue', 'Синяя', '#1f6fb2'),
  mono('teal', 'Teal', 'Бирюзовая', '#0f7c74'),
  mono('green', 'Green', 'Зелёная', '#1f6b45'),
  mono('yellow', 'Yellow', 'Жёлтая', '#f2c230'),
  mono('orange', 'Orange', 'Оранжевая', '#e8590c'),
  mono('red', 'Red', 'Красная', '#b0202b'),
  mono('pink', 'Pink', 'Розовая', '#e84393'),
  mono('purple', 'Purple', 'Фиолетовая', '#5b2a86'),
];

// the boat you start with (and a signed-out player races in), and what Reset brings back: the club's own boat, all
// black (the Black preset's hull, laminate sails and jackets) with a black and white gennaker in two bands, black
// antifouling and the moulded non-skid deck, no logo, so the main carries RYC 1 in white. Your name, flag and number
// stay yours: she has none of them but the club's letters.
export const BOTTOM = '#5b1f24'; // the usual dark red antifouling, the first of its swatches
export const DEFAULT_BOAT: Boat = {
  ...PRESETS.find((p) => p.id === 'black')!.boat, kite2: '#f4f3ef', bottom: '#1c1f24', deck: 'nonskid', logo: 'none', nat: 'RYC', num: '1',
};
// a boat's name: letters of any alphabet, digits, spaces and a little punctuation, up to 16
export const NAME_MAX = 16;
export const cleanName = (v: string) => v.replace(/[^\p{L}\p{N} .'’&-]/gu, '').replace(/\s+/g, ' ').slice(0, NAME_MAX);

// the colours to choose from: the presets' own, so every colour a preset (or the club's boat) sets, its team's jackets
// and trousers among them, is one of the swatches and can be picked again
const PALETTE = PRESETS.map((p) => p.boat.hull);
const uniq = (l: string[]) => [...new Set(l.map((c) => c.toLowerCase()))];
// what shows on a hull or a sail: pure white and near-black (in place of the White and Black hulls' own shades), then the palette
const MARKS = uniq(['#ffffff', '#1d1d1d', ...PALETTE.filter((c) => !['#f4f3ef', '#1c1f24'].includes(c))]);
export const SWATCHES = {
  hull: PALETTE,
  cloth: uniq([...PRESETS.map((p) => p.boat.cloth), '#ebe3cd', '#dfe4e8', '#868c93', '#3a3d42']),
  ink: MARKS,
  kite: PALETTE, kite2: PALETTE, kite3: PALETTE,
  // the antifouling: the usual dark red, black, navy, blue, silver and white
  bottom: uniq([BOTTOM, '#1c1f24', '#16325c', '#1f6fb2', '#b9bec4', '#f4f3ef']),
  crew: PALETTE,
  pants: uniq([...PRESETS.map((p) => p.boat.pants), '#16325c', '#f4f3ef', '#b9bec4']),
};

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// a boat as saved (on this device or in the account), its unknown or broken parts filled in from the default; null for none
export function cleanBoat(b: unknown): Boat | null {
  if (!b || typeof b !== 'object') return null;
  const r = b as Record<string, unknown>;
  const out: Boat = { ...DEFAULT_BOAT, preset: typeof r.preset === 'string' ? r.preset : undefined };
  for (const k of ['hull', 'cloth', 'ink', 'crew', 'pants'] as const) if (isHex(r[k])) out[k] = r[k];
  const kite = Array.isArray(r.kite) ? r.kite[0] : r.kite; // saved before the gennaker went one colour: its top panel
  if (isHex(kite)) out.kite = kite;
  const more = [r.kite2, r.kite3].filter(isHex); // a third colour without a second moves up
  out.kite2 = more[0]; out.kite3 = more[1];
  if (isHex(r.bottom)) out.bottom = r.bottom;
  if (r.deck === 'nonskid' || r.deck === 'teak' || r.deck === 'hull') out.deck = r.deck;
  const name = typeof r.name === 'string' ? cleanName(r.name).trim() : '';
  if (name) out.name = name;
  if (typeof r.laminate === 'boolean') out.laminate = r.laminate;
  if (r.logo === 'ryc' || r.logo === 'none' || r.logo === 'custom') out.logo = r.logo;
  if (typeof r.logoImg === 'string' && r.logoImg.startsWith('data:image/')) out.logoImg = r.logoImg;
  if (typeof r.nat === 'string') out.nat = r.nat.slice(0, 3);
  if (typeof r.num === 'string') out.num = r.num.slice(0, 3);
  if (typeof r.flag === 'string' && findFlag(r.flag)) out.flag = r.flag;
  if (typeof r.at === 'number' && r.at > 0) out.at = r.at;
  return out;
}

export function readBoat(): Boat {
  try { return cleanBoat(JSON.parse(localStorage.getItem(BOAT_KEY) || 'null')) || { ...DEFAULT_BOAT }; }
  catch { return { ...DEFAULT_BOAT }; }
}

// what she looks like, without when she was saved or which preset she came from
const LOOK = ['hull', 'cloth', 'laminate', 'ink', 'kite', 'kite2', 'kite3', 'bottom', 'deck', 'name', 'crew', 'pants', 'logo', 'nat', 'num', 'flag'] as const;
const sameLook = (a: Boat, b: Boat) => LOOK.every((k) => a[k] === b[k]);

// The account's boat and this device's, made one: the one changed last wins. A boat the player changed carries the
// time (at); one with no time that still looks like the default is the boat page's first visit on this address, not
// a choice, so any boat in the account beats it, and it's never sent there. The picture of your own logo stays on the
// device (a data: URL of up to 480 px would swell the session cookie the metadata rides in): the account keeps only
// that the logo is yours, and a device without the picture shows DEFAULT_LOGO.
// Returns what to write: local for this device's localStorage, remote for user_metadata.boat; either may be absent.
export function mergeBoat(localRaw: unknown, remoteRaw: unknown, now = Date.now()): { local?: Boat; remote?: Boat } {
  const local = cleanBoat(localRaw), remote = cleanBoat(remoteRaw);
  const chosen = !!local && (!!local.at || !sameLook(local, DEFAULT_BOAT));
  const la = local?.at || 0, ra = remote?.at || 0;
  if (remote && (!chosen || ra > la)) {
    const { logoImg: _, ...r } = remote;
    const next: Boat = { ...r, ...(local?.logoImg ? { logoImg: local.logoImg } : {}) };
    return local && sameLook(local, next) && la === ra ? {} : { local: next };
  }
  if (local && chosen && (!remote || la > ra)) {
    const at = la || now, { logoImg: _, ...r } = local;
    return { remote: { ...r, at }, ...(la ? {} : { local: { ...local, at } }) };
  }
  return {};
}

// false when the browser wouldn't keep it (a full or blocked storage). A change the player made is stamped with its
// time, so the account sync knows it's the newest; a boat taken from the account keeps the time it had.
export function saveBoat(b: Boat, at: number | undefined = Date.now()): boolean {
  try { localStorage.setItem(BOAT_KEY, JSON.stringify({ ...b, at })); return true; } catch { return false; }
}
// told on this page when the sync brought the account's boat to this device, so the boat page shows it
export const BOAT_EVENT = 'regatta-boat';

// a picture the player chose, made small enough to keep: at most 480 px on its longer side, as a PNG (keeps transparency)
export function shrinkLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 480 / Math.max(img.naturalWidth || 480, img.naturalHeight || 480));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.naturalWidth || 480) * s)); c.height = Math.max(1, Math.round((img.naturalHeight || 240) * s));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}
