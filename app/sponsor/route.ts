import { NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues';

// What an admin sets on /admin, from public.regatta_settings: the ad on every boat's jib (the row 'jib_ad'), the logo
// on every boat's mainsail (the row 'main_logo') and the one on every gennaker (the row 'kite_logo'), each a picture in
// the public Supabase bucket regatta-ads or one of the site's own; the colours every jib and gennaker is dyed (the row
// 'sail_colors': the jib 'own', each boat's own cloth, or one colour, and when not set the ad's own ground; the
// gennaker one colour all over, when not set each boat's own); and the words on the banner the light plane
// tows over the course (the row 'plane_banner'). Those are for every venue; a set of venues can have pictures and
// colours of their own (the row 'sail_sets', { [set id]: { name, venues: [venue id, …], jib?, main?, kite?: { url },
// colors?: { jib?: 'auto' | 'own' | '#rrggbb', kite?: 'own' | '#rrggbb' } } }, a venue in one set at most), and what its
// set doesn't set a venue takes from every venue's. The game
// (public/game/sponsor.js) is static and has no Supabase client, so it asks here, naming the venue its race is at.
// Cached at the CDN for a minute, and dropped at once when an admin saves (app/[lang]/admin/actions.ts).
//
//   GET /sponsor?venue=gocek → { jib: 'https://…/regatta-ads/…png' | '/images/ryc-sponsor.svg' | null,
//                                main: 'https://…/regatta-ads/…png' | '/images/ryc-badge.svg' | null,
//                                kite: 'https://…/regatta-ads/…png' | '/flags/tr.svg' | null,
//                                colors: { jib: '#ae0000' | 'own' | null, kite: '#e30a17' | null },
//                                banner: ['first words', 'second words'?] | null }
export const revalidate = 60;

const BANNER_MAX = 40; // characters in each half of the banner
const HEX = /^#[0-9a-f]{6}$/i;
type Row = Record<string, unknown> | undefined;

// a picture an admin uploaded, or one of the site's own (the samples: /images/ryc-sponsor.svg, the club's logo; a flag)
function picture(v: Row) {
  const url = v?.url;
  if (typeof url !== 'string') return null;
  const uploaded = url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/regatta-ads/`);
  const ours = /^\/(images|flags)\/[\w.-]+\.(svg|png|jpe?g|webp)$/.test(url);
  return uploaded || ours ? url : null;
}
// a gennaker's colour, or null (one saved as bands, when it could be striped: its first)
function kiteColor(v: unknown) {
  const c = Array.isArray(v) ? v[0] : v;
  return typeof c === 'string' && HEX.test(c) ? c : null;
}
const jibColor = (v: unknown) => (v === 'own' || (typeof v === 'string' && HEX.test(v)) ? v : null);

export async function GET(request?: Request) {
  let jib: string | null = null, main: string | null = null, kite: string | null = null, banner: string[] | null = null;
  const colors: { jib: string | null; kite: string | null } = { jib: null, kite: null };
  const asked = request ? new URL(request.url).searchParams.get('venue') : null, venue = VENUES.find((v) => v.id === asked)?.id ?? null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/regatta_settings?key=in.(jib_ad,main_logo,kite_logo,sail_colors,sail_sets,plane_banner)&select=key,value`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 60, tags: ['sponsor'] }, signal: AbortSignal.timeout(6000),
    });
    const rows: { key: string; value: Record<string, unknown> }[] = r.ok ? await r.json() : [];
    const val = (k: string) => rows.find((row) => row.key === k)?.value;
    jib = picture(val('jib_ad'));
    main = picture(val('main_logo'));
    kite = picture(val('kite_logo'));
    const sc = val('sail_colors');
    colors.jib = jibColor(sc?.jib);
    colors.kite = kiteColor(sc?.kite);
    // the venue's set, over every venue's: a picture it has, a colour it sets ('auto' the jib following its ad again,
    // 'own' each boat's own)
    const sets = val('sail_sets'), here = venue && sets && typeof sets === 'object'
      ? (Object.values(sets) as Record<string, unknown>[]).find((x) => x && typeof x === 'object' && Array.isArray(x.venues) && x.venues.includes(venue)) as Record<string, Row> | undefined
      : undefined;
    if (here) {
      jib = picture(here.jib) ?? jib;
      main = picture(here.main) ?? main;
      kite = picture(here.kite) ?? kite;
      const c = here.colors;
      if (c?.jib === 'auto') colors.jib = null;
      else if (jibColor(c?.jib)) colors.jib = jibColor(c?.jib);
      if (c?.kite === 'own') colors.kite = null;
      else if (kiteColor(c?.kite)) colors.kite = kiteColor(c?.kite);
    }
    const lines = val('plane_banner')?.lines;
    if (Array.isArray(lines)) {
      const clean = lines.filter((l): l is string => typeof l === 'string').map((l) => l.trim().slice(0, BANNER_MAX)).filter(Boolean).slice(0, 2);
      if (clean.length) banner = clean;
    }
  } catch {
    // nothing set: the sails stay plain and the banner keeps the game's own words
  }
  return NextResponse.json({ jib, main, kite, colors, banner }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' } });
}
