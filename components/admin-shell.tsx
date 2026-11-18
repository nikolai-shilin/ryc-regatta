import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import type { Lang, T } from '@/lib/lang';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, supabaseServer, type Account } from '@/lib/supabase/server';
import { BackLink } from './back-link';
import { SiteHead } from './site-chrome';
import { IconArrow, IconClock, IconCrew, IconDevice, IconFlag, IconImage, IconTrophy } from './ui';

// The site's admin, a page for each thing an admin comes to do (app/[lang]/admin/*): see the race the players sail
// today and the week ahead; set the ads in the game; see whether players come and stay; whether the game is fun and
// fair; and whether it runs well on their devices. /admin itself lists them. Who is an admin is the list
// public.regatta_admins (by email), which only the database's owner edits; the settings and the bucket only take an
// admin's writes and the numbers answer an admin alone (row-level security, regatta_admin_stats and _insight), so these
// pages only hide what they show from everyone else.
export const ADMIN_PAGES = [
  { id: 'race', Icon: IconFlag, name: ['Race', 'Гонка'], h: ['Today’s race and the week ahead', 'Гонка дня и неделя вперёд'],
    goal: ['What every player sails today, and what comes on each of the next seven days.', 'Что все игроки проходят сегодня и что ждёт их в каждый из следующих семи дней.'] },
  { id: 'ads', Icon: IconImage, name: ['Ads', 'Реклама'], h: ['The ads in the game', 'Реклама в игре'],
    goal: ['The logos every boat carries on her mainsail and her jib, and the words on the banner the plane tows over the course.', 'Логотипы на гроте и стакселе каждой яхты и слова на баннере, который самолёт проносит над дистанцией.'] },
  { id: 'players', Icon: IconCrew, name: ['Players', 'Игроки'], h: ['Do they come and stay', 'Приходят ли и остаются'],
    goal: ['Who plays, how far a visit gets from opening the game to a finish, and whether the players come back.', 'Кто играет, как далеко заходит визит, от открытия игры до финиша, и возвращаются ли игроки.'] },
  { id: 'game', Icon: IconTrophy, name: ['The game', 'Игра'], h: ['Is it fun and fair', 'Интересно ли и честно'],
    goal: ['How the races go by yacht, wind, venue and course; how hard they are as a player learns; why races are left; what the players say and what they set.', 'Как идут гонки по яхтам, ветру, месту и дистанции; насколько они сложны по мере опыта; почему их бросают; что говорят игроки и что выставляют.'] },
  { id: 'tech', Icon: IconDevice, name: ['Performance', 'Производительность'], h: ['Does it run well', 'Хорошо ли работает'],
    goal: ['How the game runs on the players’ devices: the frame rate and the stalls, the loads that fail, the errors on the page.', 'Как игра работает на устройствах игроков: частота кадров и рывки, неудачные загрузки, ошибки на странице.'] },
  { id: 'logs', Icon: IconClock, name: ['Logs', 'Журнал'], h: ['What went wrong, and for whom', 'Что пошло не так и у кого'],
    goal: ['The players who hit a problem, and each one’s visits and races in full, to see what happened to them.', 'Игроки, столкнувшиеся с проблемой, и все их визиты и гонки в подробностях, чтобы понять, что с ними случилось.'] },
] as const;
export type AdminPage = (typeof ADMIN_PAGES)[number]['id'];
const pageOf = (id: AdminPage) => ADMIN_PAGES.find((p) => p.id === id)!;

// the numbers are over the last 7, 30 or 90 days (?days=), 30 when not said
export const STAT_DAYS = [7, 30, 90] as const;
export const pickDays = (q?: string) => ((STAT_DAYS as readonly number[]).includes(Number(q)) ? Number(q) : 30);
const DATA: AdminPage[] = ['players', 'game', 'tech', 'logs'];

export const adminTitle = (id?: AdminPage) => (id ? titled(`Admin · ${pageOf(id).name[0]}`, `Админка · ${pageOf(id).name[1]}`, { index: false }) : titled('Admin', 'Админка', { index: false }));

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;
// Who is reading, whether they are an admin, and what the page loads for one: the load goes with the admin check, not
// after it, and its data is kept for an admin alone.
export async function adminLoad<D = null>(params: LangParams['params'], load?: (sb: Supabase) => Promise<D>) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  if (!account) return { lang, t, account, admin: false, data: null };
  const supabase = await supabaseServer();
  const [{ data: isAdmin }, data] = await Promise.all([supabase.rpc('is_regatta_admin'), load ? load(supabase) : Promise.resolve(null)]);
  const admin = isAdmin === true;
  return { lang, t, account, admin, data: admin ? data : null };
}

// one of the database's sums for an admin over the last `days`, or why it didn't come
export async function adminRpc<D>(sb: Supabase, fn: 'regatta_admin_stats' | 'regatta_admin_insight' | 'regatta_admin_players' | 'regatta_admin_logs', days: number, more?: { person: string | null }): Promise<{ data: D | null; error: string | null }> {
  const r = await sb.rpc(fn, { days, ...more });
  return r.error ? { data: null, error: r.error.message } : { data: r.data as D, error: null };
}

const withDays = (path: string, days?: number) => (days && days !== 30 ? `${path}?days=${days}` : path);

export function AdminShell({ lang, t, account, admin, page, days, who, children }: {
  lang: Lang; t: T; account: Account; admin: boolean; page?: AdminPage; days?: number; who?: string | null; children: ReactNode;
}) {
  const L = lang === 'ru' ? 1 : 0, p = page ? pageOf(page) : null;
  const here = page ? `/admin/${page}` : '/admin';
  return (
    <div className="scr app bc" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} page="settings" />
      <div className="lay page">
        <div className="aph">
          <div className="aph-top">
            {p
              ? <BackLink className="round round-s round-muted" href="/admin" label={t('Back to the admin', 'Назад в админку')} />
              : <BackLink className="round round-s round-muted" href="/settings" label={t('Back to settings', 'Назад в настройки')} />}
            <span className="kicker">{p ? `${t('Admin', 'Админка')} · ${p.name[L]}` : t('Admin', 'Админка')}</span>
          </div>
          <h1 className="aph-h">{p ? p.h[L] : t('The race, the ads and the numbers', 'Гонка, реклама и цифры')}</h1>
          <p className="aph-p">{p ? p.goal[L] : t('A page for each thing you come here to do.', 'По странице на каждую задачу.')}</p>
          {admin && (
            <div className="adm-bar">
              <nav className="segc adm-nav" aria-label={t('Admin pages', 'Разделы админки')}>
                {ADMIN_PAGES.map((x) => (
                  <Link key={x.id} href={DATA.includes(x.id) ? withDays(`/admin/${x.id}`, days) : `/admin/${x.id}`}
                    className={x.id === page ? 'on' : undefined} aria-current={x.id === page ? 'page' : undefined}>{x.name[L]}</Link>
                ))}
              </nav>
              {page && DATA.includes(page) && days != null && (
                <nav className="adm-range" aria-label={t('Period', 'Период')}>
                  {STAT_DAYS.map((d) => (
                    <Link key={d} href={`${here}?days=${d}${who ? `&who=${encodeURIComponent(who)}` : ''}`} scroll={false} aria-current={d === days ? 'page' : undefined} className={d === days ? 'on' : undefined}>
                      {t(`${d} days`, `${d} дн.`)}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          )}
        </div>
        {!account ? (
          <div className="acct acct-row">
            <div className="acct-guest">
              <span className="srow-k">{t('Sign in as an admin', 'Войдите как администратор')}</span>
              <span className="small">{t('With the email on the admin list', 'С почтой из списка администраторов')}</span>
            </div>
            <Link className="pill pill-xs" href={`/sign-in?next=${here}`}><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
          </div>
        ) : !admin ? (
          <p className="hint">{t(`${account.email || account.name} is not on the admin list.`, `${account.email || account.name} нет в списке администраторов.`)}</p>
        ) : children}
      </div>
    </div>
  );
}

// /admin: the pages, each with what it is for
export function AdminHub({ lang }: { lang: Lang }) {
  const L = lang === 'ru' ? 1 : 0;
  return (
    <ul className="adm-hub">
      {ADMIN_PAGES.map(({ id, Icon, name, h, goal }) => (
        <li key={id}>
          <Link href={`/admin/${id}`} className="adm adm-hub-a">
            <span className="adm-k"><Icon /><span className="kicker">{name[L]}</span></span>
            <b className="adm-hub-h">{h[L]}</b>
            <span className="hint">{goal[L]}</span>
            <IconArrow />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// a block of numbers that didn't come: the database's error, or nothing in the period
export function AdminMissing({ title, Icon, error, t }: { title: string; Icon: ComponentType<{ s?: number }>; error?: string | null; t: T }) {
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><Icon /><span className="kicker">{title}</span></div>
      <p className="hint">{error ? t(`The numbers didn’t load: ${error}`, `Цифры не загрузились: ${error}`) : t('Nothing in this period.', 'За этот период ничего нет.')}</p>
    </div>
  );
}
