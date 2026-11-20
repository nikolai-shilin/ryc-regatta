import { redirect } from 'next/navigation';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';
import { todayUtc } from '@/lib/day';
import { todayTop } from '@/lib/today';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/sign-in-forms';
import { clock } from '@/components/ui';

export const generateMetadata = titled('Sign in', 'Вход', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', { index: false });

export default async function SignIn({ params, searchParams }: LangParams & { searchParams: Promise<{ next?: string; error?: string; signup?: string }> }) {
  const [{ lang, t }, sp, account, today] = await Promise.all([getT(params), searchParams, getAccount(), todayTop()]);
  const next = safeNext(sp.next);
  if (account) redirect(next);
  const top = (today?.d === todayUtc() ? today.top : []).slice(0, 3); // (the plain API can still be on yesterday's)
  // why sign in: today's fastest, and a place for you among them
  const aside = (
    <>
      <span className="bt-kick">{t('Account', 'Аккаунт', 'Cuenta', 'Konto', 'Hesap', 'Compte', 'Account')}</span>
      <div className="au-today">
        <span className="lbl">{t('Today’s fastest', 'Самые быстрые сегодня', 'Los más rápidos de hoy', 'Die Schnellsten von heute', 'Günün en hızlıları', 'Les plus rapides du jour', 'I più veloci di oggi')}</span>
        <ol>
          {top.map((r, i) => <li key={i}><span className="au-n">{i + 1}</span><span className="au-nm">{r.name || t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız', 'Sans nom', 'Senza nome')}</span><span className="au-t">{clock(r.s)}</span></li>)}
          <li className="me"><span className="au-n">·</span><span className="au-nm">{t('You?', 'Ты?', '¿Tú?', 'Du?', 'Sen?', 'Toi ?', 'Sei tu?')}</span><span className="au-t" /></li>
        </ol>
      </div>
    </>
  );
  return (
    <AuthShell lang={lang} back={next} aside={aside}>
      <SignInForm lang={lang} next={next} failed={!!sp.error} signup={sp.signup === '1'} />
    </AuthShell>
  );
}
