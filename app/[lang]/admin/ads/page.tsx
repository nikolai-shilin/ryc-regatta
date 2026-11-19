import type { LangParams } from '@/lib/i18n';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { BannerForm } from '@/components/admin-form';

export const generateMetadata = adminTitle('ads');

// The ads in the game that aren't on the sails (those are /admin/sails): the words on the banner the plane tows over the
// course (public.regatta_settings 'plane_banner'). The table takes an admin's writes alone.
export default async function AdminAdsPage({ params }: LangParams) {
  const a = await adminLoad(params, async (sb) => {
    const { data: bannerRow } = await sb.from('regatta_settings').select('value').eq('key', 'plane_banner').maybeSingle();
    const lines = bannerRow?.value?.lines;
    return { banner: Array.isArray(lines) ? lines.filter((l: unknown): l is string => typeof l === 'string') : null };
  });
  return (
    <AdminShell {...a} page="ads">
      <BannerForm lang={a.lang} current={a.data?.banner ?? null} />
    </AdminShell>
  );
}
