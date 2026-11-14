import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, supabaseServer } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { SiteHead } from '@/components/site-chrome';
import { AdminForm } from '@/components/admin-form';

export const generateMetadata = titled('Admin', 'Админка', { index: false });

// The site's admin: the ad on every boat's jib. Who is an admin is the list public.regatta_admins (by email), which
// only the database's owner edits; the table and the bucket only take an admin's writes (row-level security), so this
// page only hides the form from everyone else.
export default async function AdminPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  let admin = false, jib: { url: string; path?: string } | null = null;
  if (account) {
    const supabase = await supabaseServer();
    const [{ data: isAdmin }, { data: row }] = await Promise.all([
      supabase.rpc('is_regatta_admin'),
      supabase.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
    ]);
    admin = isAdmin === true;
    jib = typeof row?.value?.url === 'string' ? { url: row.value.url, path: typeof row.value.path === 'string' ? row.value.path : undefined } : null;
  }
  return (
    <div className="scr app bc" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} page="settings" />
      <div className="lay page">
        <div className="aph">
          <div className="aph-top">
            <Link className="round round-s round-muted" href="/settings" aria-label={t('Back to settings', 'Назад в настройки')}><IconBack /></Link>
            <span className="kicker">{t('Admin', 'Админка')}</span>
          </div>
          <h1 className="aph-h">{t('The ad on the jib', 'Реклама на стакселе')}</h1>
        </div>
        {!account ? (
          <div className="acct acct-row">
            <div className="acct-guest">
              <span className="srow-k">{t('Sign in as an admin', 'Войдите как администратор')}</span>
              <span className="small">{t('With the email on the admin list', 'С почтой из списка администраторов')}</span>
            </div>
            <Link className="pill pill-xs" href="/sign-in?next=/admin"><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
          </div>
        ) : !admin ? (
          <p className="hint">{t(`${account.email || account.name} is not on the admin list.`, `${account.email || account.name} нет в списке администраторов.`)}</p>
        ) : (
          <AdminForm lang={lang} current={jib} />
        )}
      </div>
    </div>
  );
}
