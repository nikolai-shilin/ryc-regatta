import type { LangParams } from '@/lib/i18n';
import { AdminHub, AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';

export const generateMetadata = adminTitle();

// The site's admin: a page for each thing an admin comes to do (components/admin-shell.tsx ADMIN_PAGES), listed here.
export default async function AdminPage({ params }: LangParams) {
  const a = await adminLoad(params);
  return <AdminShell {...a}><AdminHub lang={a.lang} /></AdminShell>;
}
