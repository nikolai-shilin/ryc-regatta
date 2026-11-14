import { NextResponse } from 'next/server';

// The ad on every boat's jib, as an admin sets it on /admin (the row 'jib_ad' in public.regatta_settings, the picture in
// the public Supabase bucket regatta-ads). The game (public/game/yacht.js, jibAd) is static and has no Supabase client,
// so it asks here. Cached at the CDN for a minute, so a new logo is on the water a minute or so after it is saved.
//
//   GET /sponsor → { jib: 'https://…/regatta-ads/…png' }, { jib: '/images/ryc-sponsor.svg' } or { jib: null }
export const revalidate = 60;

export async function GET() {
  let jib: string | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/regatta_settings?key=eq.jib_ad&select=value`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 60, tags: ['sponsor'] },
    });
    const rows = r.ok ? await r.json() : [];
    const url = rows?.[0]?.value?.url;
    // a picture an admin uploaded, or one of the site's own (the sample: /images/ryc-sponsor.svg, the club's logo)
    const uploaded = typeof url === 'string' && url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/regatta-ads/`);
    const ours = typeof url === 'string' && /^\/images\/[\w.-]+\.(svg|png|jpe?g|webp)$/.test(url);
    if (uploaded || ours) jib = url;
  } catch {
    // no ad: the jib stays plain
  }
  return NextResponse.json({ jib }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' } });
}
