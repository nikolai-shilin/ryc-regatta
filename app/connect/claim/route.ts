import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { CODE_RE } from '@/lib/code';

// A friend who raced a 1-on-1 signed out keeps the race by signing in after it (components/duel-keep.tsx):
//   POST /connect/claim { code, seed, token } → { kept: boolean }
// token is the one her screen sent with its join (kept on her result record); only its SHA-256 goes to the database, whose
// regatta_duel_claim sets her account on that race when it has none and isn't the host's. The account is the session's.
// A race kept so is in her history, never the rating. Only from this site's own pages, as /connect/log.
const no = () => Response.json({ kept: false });
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return no();
  const key = process.env.DUEL_LOG_KEY;
  if (!key) return no();
  let body: { code?: unknown; seed?: unknown; token?: unknown };
  try { body = JSON.parse(await request.text()); } catch { return no(); }
  const { code, seed, token } = body ?? {};
  if (typeof code !== 'string' || !CODE_RE.test(code) || !Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 100000
    || typeof token !== 'string' || !/^[0-9a-f]{32,64}$/i.test(token)) return no();
  try {
    const supabase = await supabaseServer();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return no();
    const { data, error } = await supabase.rpc('regatta_duel_claim', { p_key: key, p_code: code, p_seed: seed, p_hash: createHash('sha256').update(token).digest('hex'), p_user: user.id });
    return Response.json({ kept: !error && data === true });
  } catch { return no(); }
}
