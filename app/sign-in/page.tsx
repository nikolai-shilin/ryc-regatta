import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';
import { todayTop } from '@/lib/today';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/sign-in-forms';
import { clock } from '@/components/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ lang, t }, sp, account, today] = await Promise.all([getT(), searchParams, getAccount(), todayTop()]);
  const next = safeNext(sp.next);
  if (account) redirect(next);
  const top = (today?.top || []).slice(0, 2).map((r) => `${r.name || t('Guest', 'Гость')} ${clock(r.s)}`);
  const caption = (
    <>
      <span className="chip chip-s" style={{ alignSelf: 'flex-start', background: 'rgba(8,14,20,0.55)', color: '#fff' }}>{t('Today’s fastest', 'Самые быстрые сегодня')}</span>
      <span className="small on-photo" style={{ maxWidth: 280 }}>{[...top, t('you?', 'ты?')].join(' · ')}</span>
    </>
  );
  return (
    <AuthShell lang={lang} caption={caption}>
      <SignInForm lang={lang} next={next} failed={!!sp.error} />
    </AuthShell>
  );
}
