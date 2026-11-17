import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, supabaseServer } from '@/lib/supabase/server';
import { BackLink } from '@/components/back-link';
import { SiteHead } from '@/components/site-chrome';
import { AdminForm, BannerForm } from '@/components/admin-form';
import { AdminSchedule } from '@/components/admin-schedule';
import { AdminStats, STAT_DAYS, type Stats } from '@/components/admin-stats';
import { AdminInsight, type Insight } from '@/components/admin-insight';
import { todayTop } from '@/lib/today';

export const generateMetadata = titled('Admin', 'Админка', { index: false });

// The site's admin: today's race and the days after it (components/admin-schedule.tsx), the ad on every boat's jib and the words on the banner the plane tows over the course, and the game in numbers: how the players race and how the game runs on their devices over the last ?days= (components/admin-stats.tsx, from the database's regatta_admin_stats, which answers an admin alone), and how they like it: why races are left, whether they come back, their ratings, how far a visit gets, what they set, how hard it is (components/admin-insight.tsx, regatta_admin_insight). Who is an admin is the list public.regatta_admins (by email), which
// only the database's owner edits; the table and the bucket only take an admin's writes (row-level security), so this
// page only hides the form from everyone else.
export default async function AdminPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const [{ lang, t }, account, today, q] = await Promise.all([getT(params), getAccount(), todayTop(), searchParams]);
  const days = (STAT_DAYS as readonly number[]).includes(Number(q.days)) ? Number(q.days) : 30;
  let admin = false, jib: { url: string; path?: string } | null = null, banner: string[] | null = null, stats: Stats | null = null, statsErr: string | null = null, insight: Insight | null = null, insightErr: string | null = null;
  if (account) {
    const supabase = await supabaseServer();
    const [{ data: isAdmin }, { data: row }, { data: bannerRow }] = await Promise.all([
      supabase.rpc('is_regatta_admin'),
      supabase.from('regatta_settings').select('value').eq('key', 'jib_ad').maybeSingle(),
      supabase.from('regatta_settings').select('value').eq('key', 'plane_banner').maybeSingle(),
    ]);
    admin = isAdmin === true;
    if (admin) {
      const [st, ins] = await Promise.all([supabase.rpc('regatta_admin_stats', { days }), supabase.rpc('regatta_admin_insight', { days })]);
      stats = st.error ? null : (st.data as Stats); statsErr = st.error ? st.error.message : null;
      insight = ins.error ? null : (ins.data as Insight); insightErr = ins.error ? ins.error.message : null;
    }
    const lines = bannerRow?.value?.lines;
    banner = Array.isArray(lines) ? lines.filter((l: unknown): l is string => typeof l === 'string') : null;
    jib = typeof row?.value?.url === 'string' ? { url: row.value.url, path: typeof row.value.path === 'string' ? row.value.path : undefined } : null;
  }
  return (
    <div className="scr app bc" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} page="settings" />
      <div className="lay page">
        <div className="aph">
          <div className="aph-top">
            <BackLink className="round round-s round-muted" href="/settings" label={t('Back to settings', 'Назад в настройки')} />
            <span className="kicker">{t('Admin', 'Админка')}</span>
          </div>
          <h1 className="aph-h">{t('The race, the ads and the numbers', 'Гонка, реклама и цифры')}</h1>
          <p className="aph-p">{t('Today’s race and the week ahead; the logo every boat carries on her jib, and the words on the banner the plane tows over the course; how the players race and how the game runs on their devices.', 'Гонка дня и неделя вперёд; логотип на стакселе каждой яхты и слова на баннере, который самолёт проносит над дистанцией; как игроки гоняются и как игра работает на их устройствах.')}</p>
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
          <>
            <AdminSchedule lang={lang} today={today} />
            <AdminStats lang={lang} days={days} stats={stats} error={statsErr} />
            <AdminInsight lang={lang} data={insight} error={insightErr} />
            <AdminForm lang={lang} current={jib} />
            <BannerForm lang={lang} current={banner} />
          </>
        )}
      </div>
    </div>
  );
}
