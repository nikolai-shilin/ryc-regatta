import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { parseReport, toRow } from '@/lib/duel-log';

// Where the 1-on-1 race's game reports its races (public/game/match-ui.js posts here, on the same origin, so the player's
// session cookie comes along):
//   POST /connect/log { kind: 'start' | 'join' | 'end', … } → always 204
// The game never waits on it, so every path answers 204: a report that is refused, dropped, limited or lost to the
// database is told no differently from one that was written. The account is the session's, never the body's; the write
// token (the host's proof that a race is hers) is hashed here and only the hash goes to the database.
const RATE_LIMIT = 60, RATE_WINDOW_MS = 10 * 60e3, MAX_BODY = 4096;
const seen = new Map<string, [number, number]>(); // address → [count, window start]
const done = () => new Response(null, { status: 204 });
// A failure is told to the server's log by its code alone (a Postgres code such as 42501, or a Node one): never the report,
// the key, a token or a name, and a code that isn't a short plain word is just 'error'.
const codeOf = (e: unknown) => { const c = (e as { code?: unknown } | null)?.code; return typeof c === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(c) ? c : 'error'; };
let warned = false; // the missing key, told once by this instance

export async function POST(request: NextRequest) {
  // only from this site's own pages (as app/auth/telegram does): a browser always sends Origin on a cross-site POST
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).host : ''; } catch {}
  if (origin && host !== (request.headers.get('host') || request.nextUrl.host)) return done();

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '?', now = Date.now();
  const s = seen.get(ip);
  if (s && now - s[1] < RATE_WINDOW_MS) { if (++s[0] > RATE_LIMIT) return done(); }
  else { seen.set(ip, [1, now]); if (seen.size > 5000) seen.clear(); }

  const key = process.env.DUEL_LOG_KEY;
  if (!key) {
    if (!warned && process.env.VERCEL_ENV === 'production') { warned = true; console.warn('duel-log: DUEL_LOG_KEY is not set, so no 1-on-1 race is recorded'); }
    return done();
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY) return done();
  let report;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY) return done();
    report = parseReport(JSON.parse(text));
  } catch { return done(); }
  if (!report) return done();

  try {
    const supabase = await supabaseServer();
    let userId: string | null = null;
    if (report.kind !== 'end') {
      try { userId = (await supabase.auth.getUser()).data.user?.id ?? null; } catch { /* a session that fails to load: a guest */ }
    }
    const hash = 'token' in report ? createHash('sha256').update(report.token).digest('hex') : null;
    const { error } = await supabase.rpc('regatta_duel_log', { p_key: key, p_report: toRow(report, userId, hash) });
    if (error) console.error('duel-log', codeOf(error));
  } catch (e) { console.error('duel-log', codeOf(e)); /* the report is lost; the game goes on */ }
  return done();
}
