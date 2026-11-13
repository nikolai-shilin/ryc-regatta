// The player's boat: its colours, sail number and logo. The boat page (/boat) saves it in localStorage 'regatta-boat',
// where the game reads it for your yacht at the start of every race (public/game/yacht.js, lookFrom / playerLook).

export type Logo = 'ryc' | 'custom' | 'none';
export type Boat = {
  preset?: string;
  hull: string; stripe: string;          // the topsides and the stripe under the sheer (and the boot-top)
  cloth: string; laminate: boolean;      // the mainsail and jib: their colour, and laminate (fibres, a sheen) or Dacron
  ink: string;                           // the sail number and, for the club's logo, the logo on the main
  kite: string;                          // the gennaker: one colour
  crew: string; pants: string;           // the team: jackets and trousers
  logo: Logo; logoImg?: string;          // the logo on the main and the bows; logoImg: your own picture as a data: URL
                                         // ('custom' without one shows DEFAULT_LOGO)
  nat: string; num: string;              // the letters (shown without a logo) and the number on the main
};

export const BOAT_KEY = 'regatta-boat';
// the picture 'Yours' shows until you upload one: the RYC Rentals Bot badge (public/game/yacht.js has the same path)
export const DEFAULT_LOGO = '/images/ryc-rentals-bot.png';

export type Preset = { id: string; en: string; ru: string; boat: Omit<Boat, 'logo' | 'logoImg' | 'nat' | 'num' | 'preset'> };

// one-colour schemes: the hull, the gennaker and the team jackets in one colour, on white sails, with a stripe and a
// sail number that show up against it. Picking one keeps your number and logo.
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
};
function mono(id: string, en: string, ru: string, c: string, dark = false): Preset {
  const stripe = light(c) ? '#1d1d1d' : '#ffffff';
  const cloth = dark ? '#2a2c30' : '#f4f2ea';
  return { id, en, ru, boat: { hull: c, stripe, cloth, laminate: dark, ink: dark || light(c) ? stripe : c, kite: c, crew: c, pants: dark ? c : '#262a31' } };
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

// the club's own colours: the boat you start with, and what Reset brings back
export const DEFAULT_BOAT: Boat = {
  hull: '#f4f3ef', stripe: '#16325c', cloth: '#f4f2ea', laminate: false, ink: '#16325c', kite: '#16325c',
  crew: '#16325c', pants: '#262a31', logo: 'ryc', nat: 'RYC', num: '1',
};

// the colours to choose from: the presets' own, so every colour a preset (or the club's boat) sets, its team's jackets
// and trousers among them, is one of the swatches and can be picked again
const PALETTE = PRESETS.map((p) => p.boat.hull);
const uniq = (l: string[]) => [...new Set(l.map((c) => c.toLowerCase()))];
// what shows on a hull or a sail: pure white and near-black (in place of the White and Black hulls' own shades), then the palette
const MARKS = uniq(['#ffffff', '#1d1d1d', ...PALETTE.filter((c) => !['#f4f3ef', '#1c1f24'].includes(c))]);
export const SWATCHES = {
  hull: PALETTE,
  stripe: MARKS,
  cloth: uniq([...PRESETS.map((p) => p.boat.cloth), '#ebe3cd', '#dfe4e8', '#868c93', '#3a3d42']),
  ink: MARKS,
  kite: PALETTE,
  crew: PALETTE,
  pants: uniq([...PRESETS.map((p) => p.boat.pants), '#16325c', '#f4f3ef', '#b9bec4']),
};

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function readBoat(): Boat {
  try {
    const b = JSON.parse(localStorage.getItem(BOAT_KEY) || 'null');
    if (!b || typeof b !== 'object') return { ...DEFAULT_BOAT };
    const out: Boat = { ...DEFAULT_BOAT, preset: typeof b.preset === 'string' ? b.preset : undefined };
    for (const k of ['hull', 'stripe', 'cloth', 'ink', 'crew', 'pants'] as const) if (isHex(b[k])) out[k] = b[k];
    const kite = Array.isArray(b.kite) ? b.kite[0] : b.kite; // saved before the gennaker went one colour: its top panel
    if (isHex(kite)) out.kite = kite;
    out.laminate = !!b.laminate;
    if (b.logo === 'ryc' || b.logo === 'none' || b.logo === 'custom') out.logo = b.logo;
    if (typeof b.logoImg === 'string' && b.logoImg.startsWith('data:image/')) out.logoImg = b.logoImg;
    if (typeof b.nat === 'string') out.nat = b.nat;
    if (typeof b.num === 'string') out.num = b.num;
    return out;
  } catch {
    return { ...DEFAULT_BOAT };
  }
}

// false when the browser wouldn't keep it (a full or blocked storage)
export function saveBoat(b: Boat): boolean {
  try { localStorage.setItem(BOAT_KEY, JSON.stringify(b)); return true; } catch { return false; }
}

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
