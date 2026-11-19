import type { LangParams } from '@/lib/i18n';
import { VENUES } from '@/lib/venues';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { BannerForm, SailAdForm, SailColorForm, SetEditor, SetPicker, type Pic, type SailColors, type SetMap } from '@/components/admin-form';

export const generateMetadata = adminTitle('ads');

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
// the sets of venues with sails of their own, kept as the game takes them: a name, the venues there are (each in the first
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

// The ads in the game (components/admin-form.tsx): the logo on every boat's jib (public.regatta_settings 'jib_ad'), on
// every boat's mainsail ('main_logo') and on every gennaker ('kite_logo'), the colours every jib and gennaker is dyed
// ('sail_colors'), the sets of venues with their own of those ('sail_sets', chosen with ?set=), and the words on the banner the plane tows over the course ('plane_banner').
// The table and the bucket take an admin's writes alone.
export default async function AdminAdsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ set?: string }> }) {
  const asked = (await searchParams).set;
  const a = await adminLoad(params, async (sb) => {
    const [{ data: jibRow }, { data: mainRow }, { data: kiteRow }, { data: colorsRow }, { data: setsRow }, { data: bannerRow }] = await Promise.all([
      sb.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'main_logo').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'kite_logo').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'sail_colors').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'sail_sets').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'plane_banner').maybeSingle(),
    ]);
    const lines = bannerRow?.value?.lines;
    return {
      jib: picture(jibRow?.value),
      main: picture(mainRow?.value),
      kite: picture(kiteRow?.value),
      colors: colors(colorsRow?.value),
      sets: setMap(setsRow?.value),
      banner: Array.isArray(lines) ? lines.filter((l: unknown): l is string => typeof l === 'string') : null,
    };
  });
  const sets = a.data?.sets ?? {}, set = asked && sets[asked] ? asked : null;
  return (
    <AdminShell {...a} page="ads">
      {a.data && <SetPicker key={`p-${set}`} lang={a.lang} set={set} sets={sets} />}
      {set && <SetEditor key={`e-${set}-${JSON.stringify(sets[set])}`} lang={a.lang} set={set} sets={sets} />}
      {(['main', 'jib', 'kite'] as const).map((slot) => [
        <SailAdForm key={`${set}-${slot}`} lang={a.lang} slot={slot} set={set} sets={sets}
          current={set ? sets[set][slot] ?? null : a.data?.[slot] ?? null} inherited={set ? a.data?.[slot] ?? null : null} />,
        slot !== 'main' && <SailColorForm key={`${set}-${slot}-c`} lang={a.lang} slot={slot} set={set} sets={sets} current={a.data?.colors ?? null} />,
      ])}
      {!set && <BannerForm lang={a.lang} current={a.data?.banner ?? null} />}
    </AdminShell>
  );
}
