import { redirect } from 'next/navigation';
import { getLang, titled } from '@/lib/i18n';
import { safeNext } from '@/lib/next-path';
import { AuthShell } from '@/components/auth-shell';
import { CodeForm } from '@/components/sign-in-forms';

export const generateMetadata = titled('Enter the code', 'Введи код', { index: false });

export default async function Code({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const [lang, sp] = await Promise.all([getLang(), searchParams]);
  const next = safeNext(sp.next);
  if (!sp.email) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return (
    <AuthShell lang={lang}>
      <CodeForm lang={lang} email={sp.email} next={next} />
    </AuthShell>
  );
}
