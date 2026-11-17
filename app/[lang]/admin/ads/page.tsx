import type { LangParams } from '@/lib/i18n';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { AdminForm, BannerForm } from '@/components/admin-form';

export const generateMetadata = adminTitle('ads');

// The ads in the game (components/admin-form.tsx): the logo on every boat's jib (public.regatta_settings 'jib_ad') and
// the words on the banner the plane tows over the course ('plane_banner'). The table and the bucket take an admin's
// writes alone.
export default async function AdminAdsPage({ params }: LangParams) {
  const a = await adminLoad(params, async (sb) => {
    const [{ data: jibRow }, { data: bannerRow }] = await Promise.all([
      sb.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
      sb.from('regatta_settings').select('value').eq('key', 'plane_banner').maybeSingle(),
    ]);
    const lines = bannerRow?.value?.lines, v = jibRow?.value;
    return {
      jib: typeof v?.url === 'string' ? { url: v.url as string, path: typeof v.path === 'string' ? (v.path as string) : undefined } : null,
      banner: Array.isArray(lines) ? lines.filter((l: unknown): l is string => typeof l === 'string') : null,
    };
  });
  return (
    <AdminShell {...a} page="ads">
      <AdminForm lang={a.lang} current={a.data?.jib ?? null} />
      <BannerForm lang={a.lang} current={a.data?.banner ?? null} />
    </AdminShell>
  );
}
