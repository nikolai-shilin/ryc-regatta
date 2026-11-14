import { NextResponse } from 'next/server';

// What an admin sets on /admin, from public.regatta_settings: the ad on every boat's jib (the row 'jib_ad', the picture
// in the public Supabase bucket regatta-ads) and the words on the banner the light plane tows over the course (the row
// 'plane_banner'). The game (public/game/sponsor.js) is static and has no Supabase client, so it asks here. Cached at
// the CDN for a minute, and dropped at once when an admin saves (app/[lang]/admin/actions.ts).
//
//   GET /sponsor → { jib: 'https://…/regatta-ads/…png' | null, banner: ['first words', 'second words'?] | null }
export const revalidate = 60;

const BANNER_MAX = 40; // characters in each half of the banner

export async function GET() {
  let jib: string | null = null, banner: string[] | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/regatta_settings?key=in.(jib_ad,plane_banner)&select=key,value`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 60, tags: ['sponsor'] },
    });
    const rows: { key: string; value: Record<string, unknown> }[] = r.ok ? await r.json() : [];
    const val = (k: string) => rows.find((row) => row.key === k)?.value;
    const url = val('jib_ad')?.url;
    if (typeof url === 'string' && url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/regatta-ads/`)) jib = url;
    const lines = val('plane_banner')?.lines;
    if (Array.isArray(lines)) {
      const clean = lines.filter((l): l is string => typeof l === 'string').map((l) => l.trim().slice(0, BANNER_MAX)).filter(Boolean).slice(0, 2);
      if (clean.length) banner = clean;
    }
  } catch {
    // nothing set: the jib stays plain and the banner keeps the game's own words
  }
  return NextResponse.json({ jib, banner }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' } });
}
