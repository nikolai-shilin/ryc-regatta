import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { CODE_RE } from '@/lib/code';
import { isLang } from '@/lib/lang';
import { parseRating, ratingLine } from '@/lib/duel-rating';

// What a 1-on-1 race did to the signed-in sailor's rating, for the game's card after the race (public/game/match-ui.js
// tellRating) and the result page (components/duel-rating.tsx):
//   GET /connect/rating?code=K7M2QZ&seed=4242&lang=en → { status, …, line }
// status is rated, waiting (ask again in a few seconds), unrated (and why) or none (not signed in, not this sailor's race,
// a bad question). The sailor is the session's; the database answers only for a race they sailed
// (regatta_duel_rating). Never cached: the answer changes as the other screen's end comes in.
const json = (body: object) => Response.json(body, { headers: { 'cache-control': 'no-store' } });

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams, code = q.get('code') ?? '', s = q.get('seed') ?? '', seed = Number(s), lang = isLang(q.get('lang')) ? q.get('lang')! : 'en';
  if (!CODE_RE.test(code) || !/^\d{1,6}$/.test(s) || seed > 100000) return json({ status: 'none', line: null });
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('regatta_duel_rating', { p_code: code, p_seed: seed });
    if (error) return json({ status: 'none', line: null });
    const r = parseRating(data);
    return json({ ...r, line: ratingLine(r, lang as Parameters<typeof ratingLine>[1]) });
  } catch {
    return json({ status: 'none', line: null });
  }
}
