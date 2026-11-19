import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// The drawn share cards (app/og/…): 1200 × 630. The game itself behind them, one of its pictures in 3D (lib/og-bg,
// cropped by scripts/og-bg.py so the boats sit on the right), shaded from the left; over the shade the game's logo as
// large as the card allows (public/images/brand-icon.svg: the blue bar, UP / AND / DOWN on the dark square), then only
// what a link needs: what this is and its day, one big figure or name, and the one action. Sent as a JPEG, so with a
// picture behind it it stays small enough for WhatsApp (under 300 KB).
export const W = 1200, H = 630;
export const C = { ground: '#060d16', you: '#3db8ff', gold: '#f5c400', live: '#ff3b30', inkOn: '#04121e', ink2: 'rgba(255,255,255,0.86)' };
const FACE = 'Sofia Sans Condensed';
const M = 52; // the margin round the card
const LOGO = 196; // the logo's side
const LEFT = 660; // the words' width
export const URL_LABEL = 'sailupdown.com';

// the pictures behind the cards, by name (lib/og-bg/<name>.jpg)
export type Bg = 'drone' | 'fleet' | 'aerial' | 'start' | 'trim' | 'helm' | 'wind';

// Sofia Sans Condensed, the HUD's face, the logo and the pictures, read from disk (next.config.ts ships them with the
// /og functions) rather than over the network: the renderer lays out nothing without a font, so a slow server used to
// cost the card itself. Read once per instance.
let faces: Promise<{ name: string; data: Buffer; weight: 700 | 800; style: 'normal' }[]> | null = null;
const loadFaces = () => (faces ??= Promise.all(([700, 800] as const).map(async (weight) => (
  { name: FACE, data: await readFile(join(process.cwd(), 'lib/og-fonts', `SofiaSansCondensed-${weight}.ttf`)), weight, style: 'normal' as const }
))));
const uri = (type: string, b: Buffer) => `data:${type};base64,${b.toString('base64')}`;
let logo: Promise<string> | null = null;
const loadLogo = () => (logo ??= readFile(join(process.cwd(), 'public/images/brand-icon.svg')).then((b) => uri('image/svg+xml', b)));
const bgs = new Map<Bg, Promise<string>>();
const loadBg = (b: Bg) => {
  if (!bgs.has(b)) bgs.set(b, readFile(join(process.cwd(), 'lib/og-bg', `${b}.jpg`)).then((x) => uri('image/jpeg', x)));
  return bgs.get(b)!;
};

// the big figure: its label over it, and before it, when there is one, a plate (the place, as the leaderboard's).
// wrap: a page's name rather than a figure, sized to take up to two lines
export type Hero = { label: string; value: string; color?: string; plate?: { text: string; bg: string }; wrap?: boolean };
type Card = {
  bg: Bg;
  kind: string; // what this is (the race, the page), beside the logo
  tag?: { text: string; live?: boolean }; // over it: the day, with the red dot while it's on
  hero: Hero;
  call: string;
  lang?: string; // the card's language: Turkish capitals keep their dotted İ (CSS's uppercase here doesn't know the language)
};

export async function card({ bg, kind: kind0, tag: tag0, hero: hero0, call: call0, lang }: Card): Promise<Response> {
  const up = (s: string) => (lang === 'tr' ? s.toLocaleUpperCase('tr') : s);
  const kind = up(kind0), call = up(call0), tag = tag0 && { ...tag0, text: up(tag0.text) };
  const hero = { ...hero0, label: up(hero0.label), value: up(hero0.value) };
  const [fonts, logoUri, bgUri] = await Promise.all([loadFaces(), loadLogo(), loadBg(bg)]);
  const plateW = hero.plate ? 40 + hero.plate.text.length * 60 : 0;
  // a figure on one line; a name on two at most, the biggest size its words still break into two lines at (a capital
  // takes about 0.56 of the size, a Cyrillic one a little more than a Latin)
  const fits = (sz: number) => {
    const per = (LEFT - plateW) / (sz * 0.56);
    let lines = 1, line = 0;
    for (const w of hero.value.split(' ')) {
      if (w.length > per) return false;
      if (line && line + 1 + w.length > per) { lines++; line = w.length; } else line += (line ? 1 : 0) + w.length;
    }
    return lines <= 2;
  };
  let size = Math.min(140, Math.floor((LEFT - plateW) / (Math.max(hero.value.length, 3) * 0.52)));
  if (hero.wrap) { size = 100; while (size > 48 && !fits(size)) size -= 4; }
  const label = { fontSize: 22, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: C.ink2 };
  const png = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: FACE, color: '#fff', backgroundColor: C.ground }}>
        {/* the game behind, and the shade the words sit on */}
        <img src={bgUri} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', backgroundImage: 'linear-gradient(90deg, rgba(6,13,22,0.94) 0%, rgba(6,13,22,0.86) 34%, rgba(6,13,22,0.35) 62%, rgba(6,13,22,0) 82%)' }} />
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: W, height: 200, display: 'flex', backgroundImage: 'linear-gradient(0deg, rgba(6,13,22,0.6) 0%, rgba(6,13,22,0) 100%)' }} />

        <div style={{ position: 'absolute', left: M, top: M, bottom: M, width: LEFT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* the logo, large, and beside it what this card is and its day */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30 }}>
            <img src={logoUri} width={LOGO} height={LOGO} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 6, maxWidth: LEFT - LOGO - 30 }}>
              {tag ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1 }}>
                  {tag.live ? <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: C.live }} /> : null}
                  {tag.text}
                </div>
              ) : null}
              <div style={{ display: 'flex', ...label, lineHeight: 1.25 }}>{kind}</div>
            </div>
          </div>

          {/* the one big figure, or the page's name */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', ...label }}>{hero.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 14 }}>
              {hero.plate ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: Math.round(size * 0.8), padding: '0 20px', background: hero.plate.bg, color: C.inkOn, fontSize: Math.round(size * 0.52), fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{hero.plate.text}</div>
              ) : null}
              <div style={{ display: 'flex', fontSize: size, fontWeight: 700, lineHeight: hero.wrap ? 0.92 : 0.86, letterSpacing: 1, textTransform: 'uppercase', color: hero.color || '#fff' }}>{hero.value}</div>
            </div>
          </div>

          {/* the one action, a blue block, and where it goes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: '0 28px', background: C.you, color: C.inkOn, fontSize: 27, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase' }}>{`${call} →`}</div>
            <div style={{ display: 'flex', ...label, fontSize: 21, letterSpacing: 2 }}>{URL_LABEL}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { 'content-type': 'image/jpeg' } });
}
