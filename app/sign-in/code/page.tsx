import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLang } from '@/lib/i18n';
import { safeNext } from '@/lib/next-path';
import { AuthShell } from '@/components/auth-shell';
import { CodeForm } from '@/components/sign-in-forms';

export const metadata: Metadata = { title: 'Enter the code' };

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
