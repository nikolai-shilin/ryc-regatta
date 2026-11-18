import type { LangParams } from '@/lib/i18n';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { BannerForm, SailAdForm } from '@/components/admin-form';

export const generateMetadata = adminTitle('ads');

// a sail's picture as saved in public.regatta_settings, or null for none
const picture = (v?: { url?: unknown; path?: unknown } | null) =>
  typeof v?.url === 'string' ? { url: v.url, path: typeof v.path === 'string' ? v.path : undefined } : null;

// The ads in the game (components/admin-form.tsx): the logo on every boat's jib (public.regatta_settings 'jib_ad') and
// on every boat's mainsail ('main_logo'), and the words on the banner the plane tows over the course ('plane_banner').
// The table and the bucket take an admin's writes alone.
export default async function AdminAdsPage({ params }: LangParams) {
  const a = await adminLoad(params, async (sb) => {
    const [{ data: jibRow }, { data: mainRow }, { data: bannerRow }] = await Promise.all([
      sb.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'main_logo').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'plane_banner').maybeSingle(),
    ]);
    const lines = bannerRow?.value?.lines;
    return {
      jib: picture(jibRow?.value),
      main: picture(mainRow?.value),
      banner: Array.isArray(lines) ? lines.filter((l: unknown): l is string => typeof l === 'string') : null,
    };
  });
  return (
    <AdminShell {...a} page="ads">
      <SailAdForm lang={a.lang} slot="main" current={a.data?.main ?? null} />
      <SailAdForm lang={a.lang} slot="jib" current={a.data?.jib ?? null} />
      <BannerForm lang={a.lang} current={a.data?.banner ?? null} />
    </AdminShell>
  );
}
