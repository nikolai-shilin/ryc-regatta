import { redirect } from 'next/navigation';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';
import { todayTop } from '@/lib/today';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/sign-in-forms';
import { clock } from '@/components/ui';

export const generateMetadata = titled('Sign in', 'Вход', { index: false });

export default async function SignIn({ params, searchParams }: LangParams & { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ lang, t }, sp, account, today] = await Promise.all([getT(params), searchParams, getAccount(), todayTop()]);
  const next = safeNext(sp.next);
  if (account) redirect(next);
  const top = (today?.top || []).slice(0, 3);
  // why sign in: today's fastest, and a place for you among them
  const aside = (
    <>
      <span className="bt-kick">{t('Account', 'Аккаунт')}</span>
      <div className="au-today">
        <span className="lbl">{t('Today’s fastest', 'Самые быстрые сегодня')}</span>
        <ol>
          {top.map((r, i) => <li key={i}><span className="au-n">{i + 1}</span><span className="au-nm">{r.name || t('No name', 'Без имени')}</span><span className="au-t">{clock(r.s)}</span></li>)}
          <li className="me"><span className="au-n">·</span><span className="au-nm">{t('You?', 'Ты?')}</span><span className="au-t" /></li>
        </ol>
      </div>
    </>
  );
  return (
    <AuthShell lang={lang} back={next} aside={aside}>
      <SignInForm lang={lang} next={next} failed={!!sp.error} />
    </AuthShell>
  );
}
