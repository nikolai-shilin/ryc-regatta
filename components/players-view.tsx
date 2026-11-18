'use client';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { DEFAULT_BOAT, type Boat } from '@/lib/boat';
import { findFlag, flagSrc } from '@/lib/flags';
import { yachtOf, isYacht } from '@/lib/yachts';
import { VENUES } from '@/lib/venues';
import type { PlayerCard, PlayerList } from '@/lib/players';
import type { PassportShare } from '@/lib/passport-share';
import { passport as passportOf, streakOf } from '@/lib/log';
import { useCardKey } from '@/lib/card-key';
import { IconBack, IconArrow, IconCrew, IconSail, IconTrophy, IconKite } from './ui';
import { LoadBar, ScenePoster } from './skeleton';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';
import { FlagImg, NoFlag } from './flag';
import { passportShare, useLog } from './passport';
import { PassportBlock, type PassportFacts } from './passport-card';
import { ShareButton } from './share-sheet';
import '@/styles/players.css';

// The players: the game's own scene (/boat-view: a JPK 1050 on Lake Garda on a summer evening, the drone circling her)
// behind the page, as on /yachts and /boat, the players' table in the card on the right, a page at a time, the most
// points first (the rating's, every day of today's race added up). Picking one
// (?p=<k>, a navigation the server answers, so the address can be shared) dresses the yacht in their colours and turns
// the card to their numbers: the races, the wins and podiums, their passport, today's race, the yachts they sail, their
// boat. A player whose boat the site never kept (one who only races inside Telegram) is shown the boat everyone starts in.
// The passport's venues are the scores API's, so every card has them; the streak is kept in a player's own log
// (lib/log.ts), so only your own card shows it. The card also holds a passport shared as a link and, at ?me=1,
// what this device has for someone with no card yet (passport below); a player with a card is sent to it.

const href = (page: number, k?: string | null) => {
  const q = new URLSearchParams();
  if (page > 1) q.set('page', String(page));
  if (k) q.set('p', k);
  const s = q.toString();
  return s ? `/players?${s}` : '/players';
};

export function PlayersView({ lang, list, player, missing, back, passport }: {
  lang: Lang; list: PlayerList | null; player: PlayerCard | null; missing: boolean; back: ReactNode;
  passport?: { shared: PassportShare | null; path: string }; // a shared one, or (null) this device's
}) {
  const t = tx(lang);
  const router = useRouter();
  const log = useLog();
  const [myKey, askKey] = useCardKey();
  const mine = !!player && myKey === player.k;
  const own = !!passport && !passport.shared;
  useEffect(() => { if (player || own) askKey(); }); // asks once: the hook remembers
  useEffect(() => { if (own && myKey) router.replace(href(1, myKey)); }, [own, myKey, router]);
  const [pending, start] = useTransition();
  const [going, setGoing] = useState<string | null>(null); // the row clicked, while its card comes
  const [down, setDown] = useState(false);
  const [live, setLive] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const page = list?.page ?? 1;

  // the boat in the scene: the player's, over the default for whatever their account doesn't say; none picked, the default
  const boat: Boat = player?.boat ? { ...DEFAULT_BOAT, ...player.boat, preset: undefined } : DEFAULT_BOAT;
  const look = useRef({ boat, down }); look.current = { boat, down };

  const post = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  const inset = useCallback(() => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? ((H - st.top) / H) * 0.5 : 0 });
  }, [post]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') {
        post({ type: 'look', boat: look.current.boat }); post({ type: 'pose', down: look.current.down }); inset();
        // up before this page listened (it says live once): its canvas tells
        try { if (frame.current?.contentDocument?.querySelector('canvas.live')) setLive(true); } catch {}
      }
      if (e.data?.type === 'live') setLive(true);
    };
    addEventListener('message', on); addEventListener('resize', inset);
    const ro = new ResizeObserver(inset);
    for (const el of [card.current, info.current]) if (el) ro.observe(el);
    post({ type: 'hello' }); // in case the preview was up before this page listened: it answers ready again
    return () => { removeEventListener('message', on); removeEventListener('resize', inset); ro.disconnect(); };
  }, [inset, post]);
  const lookKey = JSON.stringify(boat);
  useEffect(() => { post({ type: 'look', boat: look.current.boat }); }, [lookKey, post]);
  useEffect(() => { post({ type: 'pose', down }); }, [down, post]);
  useEffect(() => { if (!pending) setGoing(null); }, [pending]);
  useEffect(() => { setDown(false); }, [player?.k]);
  useEffect(() => { card.current?.querySelector('.bt-body')?.scrollTo({ top: 0 }); }, [player?.k, page]); // a new page or player starts at the card's top

  const go = (to: string, k: string | null) => { setGoing(k); start(() => router.push(to, { scroll: false })); };

  // a number the API may not send yet (an answer cached from before it did) is a dash, not an error
  const num = (n: number | undefined) => (typeof n === 'number' ? n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB') : '–');
  const place = (p: number | null) => (p == null ? '–' : lang === 'ru' ? `${p}-е` : `${p}${p % 10 === 1 && p % 100 !== 11 ? 'st' : p % 10 === 2 && p % 100 !== 12 ? 'nd' : p % 10 === 3 && p % 100 !== 13 ? 'rd' : 'th'}`);
  const date = (s: string, year = true) => new Date(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', ...(year && { year: 'numeric' }), timeZone: 'UTC' });
  const races = (n: number) => (lang === 'ru' ? `${num(n)} ${ruPlural(n, ['гонка', 'гонки', 'гонок'])}` : `${num(n)} race${n === 1 ? '' : 's'}`);
  const nameOf = (x: { name: string | null }) => x.name || t('A player', 'Игрок');
  const yachtName = (id: string | null) => t(...yachtOf(isYacht(id) ? id : 'jpk1050').name);
  const flag = findFlag(boat.flag);

  // the passport on a player's card: the venues they have raced, and on your own what this device's log adds to them
  const known = new Set<string>(VENUES.map((v) => v.id));
  const cardFacts = (p: PlayerCard): PassportFacts => {
    const raced = new Set([...p.venues.map((v) => v.id).filter((id) => known.has(id)), ...(mine && log ? passportOf(log).raced : [])]);
    const st = mine && log ? streakOf(log.d) : null;
    return { raced, n: raced.size, counts: Object.fromEntries(p.venues.map((v) => [v.id, v.n])), streak: st };
  };
  // the passport in the link, or this device's
  const shared = passport?.shared;
  const passFacts: PassportFacts | null = shared
    ? { raced: new Set(VENUES.filter((_, i) => shared.raced[i]).map((v) => v.id)), n: shared.v, streak: { n: shared.s } }
    : own && log ? { raced: passportOf(log).raced, n: passportOf(log).n, streak: streakOf(log.d) } : null;
  const passTitle = shared ? (shared.n ? t(`${shared.n}’s passport`, `Паспорт: ${shared.n}`) : t('A sailor’s passport', 'Паспорт гонщика')) : t('Your player card', 'Твоя карточка игрока');
  const passN = passFacts?.n ?? 0, passS = passFacts?.streak?.n ?? 0;
  const shareBtn = (l: NonNullable<typeof log>) => <ShareButton lang={lang} data={() => passportShare(l, lang)} className="bt-show" title={t('Share your passport', 'Поделиться паспортом')} />;

  return (
    <div className="bt pl-view">
      <LoadBar label={t('Loading the boat', 'Загружаем яхту')} on={!live || pending} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src="/boat-view?wind=light" title={t('The player’s boat in 3D', 'Яхта игрока в 3D')}
        onLoad={() => post({ type: 'hello' })} />
      <ScenePoster label={t('Loading the boat', 'Загружаем яхту')} on={!live} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand /></div>
        <span className="bt-kick">{passport ? passTitle : t('The players', 'Игроки')}</span>
        {passport ? (<>
          <h1 className="bt-h">{passS >= 2 ? t(`${passS} days in a row`, `${passS} ${ruPlural(passS, ['день', 'дня', 'дней'])} подряд`) : t(`${passN} of ${VENUES.length} venues`, `${passN} из ${VENUES.length} акваторий`)}</h1>
          <p className="bt-p">{shared
            ? t(`Every day the race moves to another of ${VENUES.length} famous regatta venues, the same race for everyone. ${passN} raced so far. Can you get further?`, `Каждый день гонка переезжает на другую из ${VENUES.length} знаменитых регатных акваторий, и она у всех одна. Пройдено ${passN}. Сможешь дальше?`)
            : t('Your venues and streak on this device. Sign in and race to get on the players’ list.', 'Твои акватории и серия на этом устройстве. Войди и пройди гонку, чтобы попасть в список игроков.')}</p>
        </>) : player ? (<>
          <h1 className="bt-h bt-h-boat" key={player.k}>{/* eslint-disable-next-line @next/next/no-img-element */}{(() => { const f = findFlag(player.fl || undefined); return f ? <img className="bt-h-flag" src={flagSrc(f.code)} alt={t(f.en, f.ru)} /> : <NoFlag className="bt-h-flag" />; })()}<span>{nameOf(player)}</span></h1>
          <p className="bt-p">{player.boat
            ? <>{boat.name ? `${boat.name} · ` : null}{`${boat.nat} ${boat.num || '1'}`.trim()} · {t('Their colours on the JPK 1050. Drag to circle her.', 'Их цвета на JPK 1050. Тяни, чтобы облететь яхту.')}</>
            : t('Their colours aren’t kept online, so this is the boat everyone starts in. Drag to circle her.', 'Их цвета не сохранены онлайн, поэтому здесь яхта, с которой начинают все. Тяни, чтобы облететь её.')}</p>
        </>) : (<>
          <h1 className="bt-h">{t('The players', 'Игроки')}</h1>
          <p className="bt-p">{missing
            ? t('That player isn’t on the list any more. Pick one from the table to see their numbers and their boat.', 'Этого игрока больше нет в списке. Выбери игрока в таблице, чтобы увидеть его цифры и яхту.')
            : t('Everyone who races signed in, the most points first. Pick a player to see their numbers and their boat in their own colours.', 'Все, кто гоняется со входом в аккаунт, — больше всего очков сверху. Выбери игрока, чтобы увидеть его цифры и яхту в его цветах.')}</p>
        </>)}
      </div>

      <PauseCard lang={lang} back={passport ? passport.path : href(page, player?.k)} className="pl-card" cardRef={card} busy={pending}
        title={passport ? passTitle : player ? nameOf(player) : `${t('The players', 'Игроки')}${list ? ` · ${num(list.total)}` : ''}`} icon={player || passport ? undefined : <IconCrew s={14} />}
        note={!player && !passport && list && list.pages > 1 ? t(`Page ${page} of ${list.pages}`, `Страница ${page} из ${list.pages}`) : undefined}
        action={passport ? <a className="bt-go" href="/play?race=today">{t('Sail today’s race', 'Пройди гонку дня')}</a> : undefined}
        tools={player || passport ? <Link className="bt-mini" href={href(player ? page : 1)} scroll={false} onClick={(e) => { e.preventDefault(); go(href(player ? page : 1), null); }}><IconBack s={14} /><span>{t('All players', 'Все игроки')}</span></Link> : undefined}>
        {passport ? (<>
          {passFacts ? <PassportBlock lang={lang} facts={passFacts} mine={own} share={own && log && passFacts.n ? shareBtn(log) : undefined} /> : null}
          <div className="bt-rows">
            {own ? <Link className="bt-row if-guest" href={`/sign-in?next=${encodeURIComponent('/players?me=1')}`}><IconCrew s={18} /><span>{t('Sign in', 'Войти')}</span><span className="bt-row-m">{t('Keep it on every device', 'Сохрани на всех устройствах')}</span></Link> : null}
            <Link className="bt-row" href="/"><IconSail s={18} /><span>{t('What the game is', 'Что это за игра')}</span></Link>
          </div>
        </>) : player ? (<>
          <div className="bt-seg" role="radiogroup" aria-label={t('Point of sail', 'Курс')}>
            <button type="button" role="radio" aria-checked={!down} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд')}</button>
            <button type="button" role="radio" aria-checked={down} onClick={() => setDown(true)}>{t('Gennaker', 'Генакер')}</button>
          </div>

          <div className="fl-stats pl-stats">
            <div><span className="bt-sk">{t('Races', 'Гонок')}</span><b>{num(player.n)}</b></div>
            <div><span className="bt-sk">{t('Finished', 'Финиш')}</span><b>{player.n ? `${Math.round((100 * player.fin) / player.n)}%` : '–'}</b></div>
            <div><span className="bt-sk">{t('Wins', 'Побед')}</span><b>{num(player.wins)}</b></div>
            <div><span className="bt-sk">{t('Podiums', 'Подиумов')}</span><b>{num(player.podiums)}</b></div>
            <div><span className="bt-sk">{t('Days', 'Дней')}</span><b>{num(player.days)}</b></div>
            <div><span className="bt-sk">{t('Best place', 'Лучшее место')}</span><b>{place(player.best)}</b></div>
            <div><span className="bt-sk">DSQ</span><b>{player.dsq ? num(player.dsq) : '–'}</b></div>
            <div><span className="bt-sk">{t('Last race', 'Последняя')}</span><b className="pl-d">{date(player.last, false)}</b></div>
            <span className="bt-sv">{player.best && player.fleet ? t(`Best: ${place(player.best)} of ${player.fleet} boats. `, `Лучшее: ${player.best}-е из ${player.fleet}. `) : ''}{t(`Racing since ${date(player.first)}.`, `Гоняется с ${date(player.first)}.`)}</span>
          </div>

          <PassportBlock lang={lang} facts={cardFacts(player)} mine={mine} share={mine && log ? shareBtn(log) : undefined} />

          <div className="bt-g">
            <span className="bt-k"><IconTrophy s={14} />{t('Today’s race', 'Гонка дня')}</span>
            {player.daily.n ? (
              <dl className="yt-spec pl-spec">
                <div><dt>{t('Points', 'Очков')}</dt><dd>{num(player.pts)}</dd></div>
                <div><dt>{t('Days ranked', 'Дней в рейтинге')}</dt><dd>{num(player.daily.days)}</dd></div>
                <div><dt>{t('Days won', 'Дней первым')}</dt><dd>{num(player.daily.wins)}</dd></div>
                <div><dt>{t('Days in the top 3', 'Дней в топ-3')}</dt><dd>{num(player.daily.podiums)}</dd></div>
              </dl>
            ) : <p className="bt-hint">{t('Not sailed yet: every day a new race, the same for everyone.', 'Ещё не ходил: каждый день новая гонка, одна для всех.')}</p>}
          </div>

          <div className="bt-g">
            <span className="bt-k"><IconKite s={14} />{t('Their boat', 'Их яхта')}</span>
            {player.boat ? (
              <dl className="yt-spec pl-spec">
                {boat.name && <div><dt>{t('Name', 'Имя')}</dt><dd>{boat.name}</dd></div>}
                <div><dt>{t('Sail number', 'Номер')}</dt><dd>{`${boat.nat} ${boat.num || '1'}`.trim()}</dd></div>
                <div><dt>{t('Colours', 'Цвета')}</dt><dd className="pl-sws">
                  {[boat.hull, boat.cloth, boat.kite, boat.kite2, boat.kite3, boat.crew].filter(Boolean).map((c, i) => <i key={i} style={{ background: c }} />)}
                </dd></div>
                <div><dt>{t('Deck', 'Палуба')}</dt><dd>{boat.deck === 'teak' ? t('Teak', 'Тик') : boat.deck === 'hull' ? t('Hull colour', 'В цвет корпуса') : t('Non-skid', 'Нескользящая')}</dd></div>
                <div><dt>{t('Sails', 'Паруса')}</dt><dd>{boat.laminate ? t('Laminate', 'Ламинат') : t('Dacron', 'Дакрон')}</dd></div>
                <div><dt>{t('Flag', 'Флаг')}</dt><dd>{flag ? t(flag.en, flag.ru) : '–'}</dd></div>
              </dl>
            ) : <p className="bt-hint">{t('They race inside Telegram or haven’t changed their boat, so the site doesn’t keep their colours: the scene shows the boat everyone starts in.', 'Они гоняются в Telegram или не меняли яхту, поэтому сайт не хранит их цвета: в сцене яхта, с которой начинают все.')}</p>}
          </div>

          <div className="bt-g">
            <span className="bt-k"><IconSail s={14} />{t('Yachts they sail', 'На чём ходят')}</span>
            <dl className="yt-spec pl-spec">
              {player.yachts.slice(0, 6).map((y) => <div key={y.id}><dt>{yachtName(y.id)}</dt><dd>{races(y.n)}</dd></div>)}
            </dl>
          </div>

          <div className="bt-rows">
            <Link className="bt-row" href="/race/rating"><IconTrophy s={18} /><span>{t('The rating', 'Рейтинг')}</span><span className="bt-row-m">{t('Today and the month', 'День и месяц')}</span></Link>
          </div>
        </>) : (<>
          {!list ? (
            <p className="bt-hint">{t('The players can’t be had just now. Try again in a minute.', 'Список игроков сейчас недоступен. Попробуй через минуту.')}</p>
          ) : list.rows.length === 0 ? (
            <p className="bt-hint">{t('Nobody yet. Sign in and race to be the first.', 'Пока никого. Войди и пройди гонку — будешь первым.')}</p>
          ) : (<>
            <div className="pl-tab" role="table" aria-label={t('The players', 'Игроки')}>
              <div className="pl-tr pl-th" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">{t('Player', 'Игрок')}</span>
                <span role="columnheader" title={t('Points in the rating, every day added up', 'Очки рейтинга за все дни')} aria-sort="descending">{t('Pts', 'Очки')}</span>
                <span role="columnheader" title={t('Races', 'Гонок')}>{t('Races', 'Гонок')}</span>
                <span role="columnheader" title={t('Wins', 'Побед')}>{t('Wins', 'Побед')}</span>
                <span role="columnheader" title={t('Podiums', 'Подиумов')}>{t('Top 3', 'Топ-3')}</span>
              </div>
              {list.rows.map((r, i) => {
                const to = href(page, r.k);
                return (
                  <Link key={r.k} href={to} scroll={false} role="row" className="pl-tr" aria-busy={going === r.k}
                    onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(to, r.k); }}>
                    <span role="cell" className="pl-i">{(page - 1) * list.per + i + 1}</span>
                    <span role="cell" className="pl-who">
                      <span className="pl-fl"><FlagImg code={r.fl} lang={lang} /></span>
                      <span className="pl-nm"><b>{nameOf(r)}</b><small>{r.yacht ? yachtName(r.yacht) : t(`${r.days} day${r.days === 1 ? '' : 's'} racing`, `${r.days} ${ruPlural(r.days, ['день', 'дня', 'дней'])} в гонках`)}</small></span>
                    </span>
                    <span role="cell" className="pl-pts">{num(r.pts)}</span>
                    <span role="cell">{num(r.n)}</span>
                    <span role="cell">{r.wins ? num(r.wins) : '–'}</span>
                    <span role="cell">{r.podiums ? num(r.podiums) : '–'}</span>
                  </Link>
                );
              })}
            </div>
            {list.pages > 1 && (
              <nav className="pl-pages" aria-label={t('Pages', 'Страницы')}>
                <Link className="fl-btn" href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} scroll={false}
                  onClick={(e) => { e.preventDefault(); if (page > 1) go(href(page - 1), null); }} aria-label={t('Previous page', 'Предыдущая страница')}><IconBack s={16} /></Link>
                {Array.from({ length: list.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === list.pages || Math.abs(n - page) <= 1).map((n, i, a) => (
                  <span key={n} className="pl-pn">
                    {i > 0 && n - a[i - 1] > 1 && <span className="pl-gap" aria-hidden="true">…</span>}
                    <Link className="fl-btn" href={href(n)} scroll={false} aria-current={n === page ? 'page' : undefined}
                      onClick={(e) => { e.preventDefault(); if (n !== page) go(href(n), null); }}>{n}</Link>
                  </span>
                ))}
                <Link className="fl-btn" href={href(page + 1)} aria-disabled={page >= list.pages} tabIndex={page >= list.pages ? -1 : undefined} scroll={false}
                  onClick={(e) => { e.preventDefault(); if (page < list.pages) go(href(page + 1), null); }} aria-label={t('Next page', 'Следующая страница')}><IconArrow s={16} /></Link>
              </nav>
            )}
            <p className="bt-hint">{t('Points are the rating’s, every day of today’s race added up: of N players ranked on a day, the first gets N and the last 1. Wins and podiums count every race, free races too. Guests aren’t on it: sign in and race to be.', 'Очки — рейтинговые, за все дни гонки дня: из N игроков в рейтинге дня первый получает N, последний — 1. Победы и подиумы — во всех гонках, и в свободных тоже. Гостей здесь нет: войди и пройди гонку, чтобы попасть сюда.')}</p>
          </>)}
        </>)}
      </PauseCard>
    </div>
  );
}
