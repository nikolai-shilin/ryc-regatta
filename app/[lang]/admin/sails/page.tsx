import type { LangParams } from '@/lib/i18n';
import { VENUES } from '@/lib/venues';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { SailPresets, type Pic, type SailColors, type SetMap } from '@/components/admin-sails';

export const generateMetadata = adminTitle('sails');

// the jibs' and gennakers' colours as saved, each kept only when it's one the game takes
const HEX = /^#[0-9a-f]{6}$/i;
// (a venue's own can also set the jib back to following its ad, 'auto', and the gennaker to each boat's own, 'own'; a
// gennaker saved as bands, when it could be striped, is its first colour)
const colors = (v?: { jib?: unknown; kite?: unknown } | null, venue = false): SailColors | null => {
  const out: SailColors = {};
  if (v?.jib === 'own' || (venue && v?.jib === 'auto') || (typeof v?.jib === 'string' && HEX.test(v.jib))) out.jib = v.jib as string;
  const kite = Array.isArray(v?.kite) ? v.kite[0] : v?.kite;
  if ((venue && kite === 'own') || (typeof kite === 'string' && HEX.test(kite))) out.kite = kite;
  return Object.keys(out).length ? out : null;
};
// the presets for sets of venues, kept as the game takes them: a name, the venues there are (each in the first
// set that has it), and the pictures and colours
const setMap = (v: unknown): SetMap => {
  const out: SetMap = {}, taken = new Set<string>();
  if (!v || typeof v !== 'object') return out;
  for (const [id, e] of Object.entries(v as Record<string, Record<string, unknown> | undefined>)) {
    if (!/^[a-z0-9]{1,24}$/.test(id) || !e || typeof e !== 'object') continue;
    const venues = VENUES.map((x) => x.id).filter((x) => Array.isArray(e.venues) && e.venues.includes(x) && !taken.has(x));
    venues.forEach((x) => taken.add(x));
    const o: SetMap[string] = { name: typeof e.name === 'string' && e.name.trim() ? e.name.trim().slice(0, 40) : id, venues };
    for (const k of ['jib', 'main', 'kite'] as const) { const p = picture(e[k] as { url?: unknown; path?: unknown } | undefined); if (p) o[k] = p; }
    const c = colors(e.colors as { jib?: unknown; kite?: unknown } | undefined, true);
    if (c) o.colors = c;
    out[id] = o;
  }
  return out;
};
// a sail's picture as saved in public.regatta_settings, or null for none
const picture = (v?: { url?: unknown; path?: unknown } | null): Pic | null =>
  typeof v?.url === 'string' && /^(https:\/\/|\/[^/])/.test(v.url) ? { url: v.url, path: typeof v.path === 'string' ? v.path : undefined } : null;

// The sails in the game (components/admin-sails.tsx): every venue's, the logo on every boat's mainsail
// (public.regatta_settings 'main_logo'), the ad on her jib ('jib_ad'), the logo on her gennaker ('kite_logo') and the
// colours the jibs and gennakers are dyed ('sail_colors'); and the presets for sets of venues with their own ('sail_sets').
// The table and the bucket take an admin's writes alone.
export default async function AdminSailsPage({ params }: LangParams) {
  const a = await adminLoad(params, async (sb) => {
    const [{ data: jibRow }, { data: mainRow }, { data: kiteRow }, { data: colorsRow }, { data: setsRow }] = await Promise.all([
      sb.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'main_logo').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'kite_logo').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'sail_colors').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'sail_sets').maybeSingle(),
    ]);
    return {
      every: { jib: picture(jibRow?.value), main: picture(mainRow?.value), kite: picture(kiteRow?.value), colors: colors(colorsRow?.value) },
      sets: setMap(setsRow?.value),
    };
  });
  return (
    <AdminShell {...a} page="sails">
      {a.data && <SailPresets lang={a.lang} every={a.data.every} sets={a.data.sets} />}
    </AdminShell>
  );
}
