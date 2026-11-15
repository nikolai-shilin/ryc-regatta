// Who is signed in, as the header's avatar and the footer's account link show it, read in the browser.
//
// The pages are built once per language and served from the CDN (app/[lang]), so the server can't put your initials
// in them. The session is in the sb-…-auth-token cookie (@supabase/ssr, readable by scripts; chunked as .0, .1… when
// long), and it carries the user: the ranking name (user_metadata.display_name) and the address. This reads it, with
// no Supabase client (guests never download one), and marks <html>: data-me, and the initials and the name as the CSS
// strings --me-ini and --me-name. styles/ryc.css then shows .if-me or .if-guest, and the initials and the name.
//
// It runs twice: inline in <head> (app/[lang]/layout.tsx, as its own source, so it must not use anything from outside
// itself), before the first paint, so a signed-in page never flashes the guest's icon; and from <Me /> after every
// navigation and refresh in the app, for signing in and out without a page load. useWho (components/me.tsx) reads the
// same cookie for the parts of a page that say more than the initials.

// The session's user as the cookie holds it: the ranking name, the address (none for a Telegram player, whose is made
// up) and how they signed in; null for a guest. Self-contained as applyMe is: the head script inlines its source too.
export type MeUser = { name: string; email: string; provider: 'google' | 'telegram' | 'email' | string };
export function readMe(): MeUser | null {
  try {
    const parts: string[] = [], re = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.(\d+))?=([^;]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(document.cookie))) parts[m[1] ? +m[1] : 0] = decodeURIComponent(m[2]);
    const raw = parts.join('');
    if (!raw) return null;
    const b64 = (s: string) => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(u);
    };
    const session = JSON.parse(raw.indexOf('base64-') === 0 ? b64(raw.slice(7)) : raw);
    // the user as the session keeps it (updated in place when the name changes), else the access token's claims
    const user = session.user || JSON.parse(b64(session.access_token.split('.')[1]));
    const md = user.user_metadata || {}, am = user.app_metadata || {}, tg = !!am.telegram_id;
    // as getAccount in lib/supabase/server.ts: a Telegram player's address is made up, never shown
    return { name: String(md.display_name || ''), email: tg ? '' : String(user.email || ''), provider: tg ? 'telegram' : String(am.provider || 'email') };
  } catch (e) {
    return null;
  }
}

// read: readMe, passed in by the head script (which inlines both sources); in the app the default
export function applyMe(read: () => MeUser | null = readMe) {
  let ini = '', name = '';
  const me = read();
  if (me) {
    name = me.name || me.email;
    const w = name.trim().split(/[\s.@]+/).filter(Boolean);
    ini = ((w[0] ? w[0][0] : '') + (w[1] ? w[1][0] : '')).toUpperCase() || '·';
  }
  const d = document.documentElement, css = (v: string) => '"' + v.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, ' ') + '"';
  if (ini) {
    d.setAttribute('data-me', '');
    d.style.setProperty('--me-ini', css(ini));
    d.style.setProperty('--me-name', css(name));
  } else {
    d.removeAttribute('data-me');
    d.style.removeProperty('--me-ini');
    d.style.removeProperty('--me-name');
  }
}
