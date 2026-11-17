import { tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { Table, Tile } from './admin-stats';
import { IconBoats, IconCrew, IconFlag, IconScreen, IconSliders, IconTrophy } from './ui';

// The admin's look at how the players like the game, over the same days as the numbers above it: why races are left
// (how each ended, how far it had got, the last incident before), whether players come back, what they say (the
// result page's stars and comments), how far a visit gets (opened, loaded, a race, a finish; loads that failed or were
// given up, the errors), what they set, and how the races go as a player gets more of them behind her. All of it from
// the database's regatta_admin_insight (supabase/migrations/20261117130000_game_insight.sql in the iyt-test repo),
// which answers an admin alone. Drawn on the server, per request.
type Num = number | null;
export type Insight = {
  since: string;
  exits: { how: Record<string, number>; stage: Record<string, number>; last: Record<string, number>; left: number; mins_left: Num; mins_fin: Num };
  retention: { new: number; d1: number; d1of: number; d7: number; d7of: number; d30: number; d30of: number; back: number; active: number };
  ratings: { n: number; avg: Num; stars: number[]; yacht: Record<string, { n: number; avg: number }>; comments: { at: string; rating: Num; comment: string; yacht: string; venue: string | null; wind: string | null; place: Num; boats: Num; dsq: boolean; dev: string | null; how: string | null }[] };
  funnel: { opened: number; loaded: number; failed: number; gave_up: number; raced: number; finished: number; load: Num; mins: Num; races: Num;
    dev: Record<string, { opened: number; loaded: number; gave_up: number; failed: number; raced: number }>; why: { why: string; n: number }[];
    errors: { m: string; src: string | null; n: number; visits: number }[]; lost: number; howto: number; drill: number; ghost: number };
  usage: Record<string, Record<string, number>>;
  difficulty: { b: number; n: number; fin: number; top3: number; dsq: number; who: number; down: Num; pens: Num }[];
};

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const fix = (x: Num | undefined, k = 0) => (x == null ? '–' : x.toFixed(k));
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

export function AdminInsight({ lang, data, error }: { lang: Lang; data: Insight | null; error?: string | null }) {
  const t = tx(lang), L = lang === 'ru' ? 1 : 0;
  if (!data) {
    return (
      <div className="adm adm-stats">
        <div className="adm-k"><IconCrew /><span className="kicker">{t('How they like it', 'Нравится ли игра')}</span></div>
        <p className="hint">{error ? t(`The numbers didn’t load: ${error}`, `Цифры не загрузились: ${error}`) : t('Nothing yet.', 'Пока ничего.')}</p>
      </div>
    );
  }
  const { exits: X, retention: R, ratings: S, funnel: F, usage: U, difficulty: D } = data;
  const yachtName = (id: string) => YACHTS.find((y) => y.id === id)?.name[L] ?? id;
  const venueName = (id: string | null) => (id ? VENUES.find((v) => v.id === id)?.name[L] ?? id : '');
  const HOW: Record<string, [string, string]> = {
    finish: ['Finished', 'Финишировал'], restart: ['Restarted', 'Начал заново'], change: ['Changed the race', 'Сменил гонку'], menu: ['Back to the menu', 'Вышел в меню'],
    close: ['Closed the page', 'Закрыл страницу'], hidden: ['Put the app away', 'Свернул приложение'], new: ['Began another', 'Начал другую'], unknown: ['Not kept (older races)', 'Не записано (старые гонки)'],
  };
  const STAGE: Record<string, [string, string]> = {
    'before the start': ['Before the start', 'До старта'], 'first leg': ['First leg', 'Первый отрезок'], 'middle legs': ['Middle legs', 'Средние отрезки'],
    'last leg': ['Last leg', 'Последний отрезок'], unknown: ['Not known', 'Неизвестно'],
  };
  const INC: Record<string, [string, string]> = {
    ocs: ['Over the line early', 'Фальстарт'], fouled: ['Broke a rule', 'Нарушил правило'], touched: ['Touched a mark', 'Задел знак'], bump: ['Collision', 'Столкновение'],
    aground: ['Ran aground', 'Сел на мель'], penNow: ['Penalty to take', 'Штраф'], missedLine: ['Missed the line', 'Пропустил линию'], missedGate: ['Missed the gate', 'Пропустил ворота'],
    wrongSide: ['Mark on the wrong side', 'Знак не с той стороны'], genRecall: ['General recall', 'Общий отзыв'], barging: ['Barging at the start', 'Баржинг на старте'],
    finishOwed: ['Finished owing a penalty', 'Финиш с невыполненным штрафом'],
  };
  const SET: Record<string, [string, string]> = {
    cam: ['Camera', 'Камера'], trim: ['Sails', 'Паруса'], sound: ['Sound', 'Звук'], voice: ['Voices', 'Голоса'], music: ['Music', 'Музыка'], sea: ['Sea', 'Море'],
    saver: ['Battery saver', 'Экономия батареи'], gfx: ['Graphics setting', 'Настройка графики'], q: ['Graphics level', 'Уровень графики'], guides: ['Guides', 'Подсказки на воде'],
    speed: ['Game speed', 'Скорость игры'], ghost: ['Ghost of your best', 'Призрак лучшей гонки'],
  };
  const VAL: Record<string, Record<string, [string, string]>> = {
    cam: { drone: ['Drone', 'Дрон'], top: ['From above', 'Сверху'], helm: ['From the helm', 'С руля'] },
    trim: { '0': ['By hand', 'Вручную'], '1': ['Auto', 'Авто'], '2': ['Main and jib apart', 'Раздельно'] },
    sound: { '0': ['Off', 'Выкл'], '1': ['On', 'Вкл'] }, voice: { '0': ['Off', 'Выкл'], '1': ['On', 'Вкл'] }, saver: { '0': ['Off', 'Выкл'], '1': ['On', 'Вкл'] },
    guides: { '0': ['Off', 'Выкл'], '1': ['On', 'Вкл'] }, ghost: { '0': ['Off', 'Выкл'], '1': ['On', 'Вкл'] },
    gfx: { auto: ['Auto', 'Авто'], high: ['High', 'Высокая'], medium: ['Medium', 'Средняя'], low: ['Low', 'Низкая'] },
    q: { high: ['High', 'Высокая'], medium: ['Medium', 'Средняя'], low: ['Low', 'Низкая'] },
  };
  const val = (k: string, v: string) => VAL[k]?.[v]?.[L] ?? (k === 'speed' ? `×${v}` : v);
  const dev = (v: string) => {
    const [d, tg] = v.split(' ');
    const name = { phone: t('Phone', 'Телефон'), tablet: t('Tablet', 'Планшет'), desktop: t('Computer', 'Компьютер') }[d] ?? t('Not known', 'Неизвестно');
    return tg ? `${name} · Telegram` : `${name} · ${t('browser', 'браузер')}`;
  };
  const date = (s: string) => new Date(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const total = sum(X.how), fin = X.how.finish || 0;
  const good = (S.stars[3] || 0) + (S.stars[4] || 0);
  const BUCKET = ['', t('Their 1st race', '1-я гонка игрока'), t('2nd–5th', '2–5-я'), t('6th–20th', '6–20-я'), t('21st and on', '21-я и дальше')];

  return (
    <>
      {/* why races are left */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconFlag /><span className="kicker">{t('Why races are left', 'Почему бросают гонки')}</span></div>
        <div className="adm-tiles">
          <Tile k={t('Finished', 'Дошли до финиша')} v={pct(fin, total)} />
          <Tile k={t('Left before the finish', 'Бросили до финиша')} v={String(X.left)} />
          <Tile k={t('Minutes to leaving', 'Минут до ухода')} v={fix(X.mins_left, 1)} />
          <Tile k={t('Minutes to the finish', 'Минут до финиша')} v={fix(X.mins_fin, 1)} />
        </div>
        <Table title={t('How the race ended', 'Как закончилась гонка')} first={t('Ending', 'Исход')} head={[t('Races', 'Гонок'), t('Share', 'Доля')]}
          rows={sorted(X.how).map(([k, n]) => ({ key: k, name: HOW[k]?.[L] ?? k, cells: [String(n), pct(n, total)] }))} />
        <Table title={t('How far they got before leaving', 'Где бросили')} first={t('Stage', 'Этап')} head={[t('Races', 'Гонок'), t('Of those left', 'Из брошенных')]}
          rows={sorted(X.stage).map(([k, n]) => ({ key: k, name: STAGE[k]?.[L] ?? k, cells: [String(n), pct(n, X.left)] }))} />
        <Table title={t('What happened in the minute before', 'Что случилось за минуту до ухода')} first={t('Incident', 'Происшествие')} head={[t('Races', 'Гонок'), t('Of those left', 'Из брошенных')]}
          rows={sorted(X.last).map(([k, n]) => ({ key: k, name: INC[k]?.[L] ?? k, cells: [String(n), pct(n, X.left)] }))} />
        <p className="hint">{t('A race counts as finished when the player crossed the line, whatever came after. “Put the app away” may be followed by the race going on; the race is counted as it was left first. Races before 17 November weren’t followed.',
          'Гонка считается финишированной, если игрок пересёк линию, что бы ни было потом. После «свернул приложение» гонка могла продолжиться — считается первый уход. Гонки до 17 ноября не отслеживались.')}</p>
      </div>

      {/* coming back */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconCrew /><span className="kicker">{t('Do they come back', 'Возвращаются ли')}</span></div>
        <div className="adm-tiles">
          <Tile k={t('Players active', 'Активных игроков')} v={String(R.active)} />
          <Tile k={t('New in the period', 'Новых за период')} v={String(R.new)} />
          <Tile k={t('Came back another day', 'Вернулись в другой день')} v={String(R.back)} />
          <Tile k={t('Next day', 'На следующий день')} v={pct(R.d1, R.d1of)} />
          <Tile k={t('Within a week', 'В течение недели')} v={pct(R.d7, R.d7of)} />
          <Tile k={t('Within a month', 'В течение месяца')} v={pct(R.d30, R.d30of)} />
        </div>
        <p className="hint">{t(`A player is a Telegram user, a site account or, for a guest, a browser. The returns are of the players first seen in the period: next day over ${R.d1of} of them, within a week over ${R.d7of} (first seen 7 days ago or more), within a month over ${R.d30of}. Guests are followed from 17 November.`,
          `Игрок — это пользователь Telegram, аккаунт на сайте или, для гостя, браузер. Возвраты — среди впервые пришедших за период: на следующий день — из ${R.d1of}, за неделю — из ${R.d7of} (пришли 7 и более дней назад), за месяц — из ${R.d30of}. Гости отслеживаются с 17 ноября.`)}</p>
      </div>

      {/* what they say */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconTrophy /><span className="kicker">{t('What they say', 'Что говорят')}</span></div>
        <div className="adm-tiles">
          <Tile k={t('Races rated', 'Оценок')} v={String(S.n)} />
          <Tile k={t('Average', 'Средняя')} v={S.avg == null ? '–' : `${S.avg.toFixed(1)} / 5`} />
          <Tile k={t('Four or five', 'Четыре или пять')} v={pct(good, S.n)} />
        </div>
        {S.n > 0 && (
          <figure className="adm-stars" aria-label={t('Ratings by stars', 'Оценки по звёздам')}>
            <figcaption className="adm-tab-h">{t('Each rating', 'Каждая оценка')}</figcaption>
            {[5, 4, 3, 2, 1].map((n) => {
              const c = S.stars[n - 1] || 0, max = Math.max(1, ...S.stars);
              return (
                <div key={n} className="adm-star" title={`${n}: ${c}`}>
                  <span className="adm-star-k">{'★'.repeat(n)}</span>
                  <span className="adm-star-bar"><i style={{ width: `${(100 * c) / max}%` }} /></span>
                  <span className="adm-star-v">{c} · {pct(c, S.n)}</span>
                </div>
              );
            })}
          </figure>
        )}
        <Table title={t('By yacht', 'По яхтам')} first={t('Yacht', 'Яхта')} head={[t('Ratings', 'Оценок'), t('Average', 'Средняя')]}
          rows={Object.entries(S.yacht).sort((a, b) => b[1].n - a[1].n).map(([k, x]) => ({ key: k, name: yachtName(k), cells: [String(x.n), x.avg.toFixed(1)] }))} />
        {S.comments.length > 0 && (
          <section className="adm-tab">
            <h3 className="adm-tab-h">{t('Their words', 'Отзывы')}</h3>
            <ul className="adm-comments">
              {S.comments.map((c, i) => (
                <li key={i}>
                  <span className="adm-c-meta">{date(c.at)} · {c.rating ? '★'.repeat(c.rating) : t('no stars', 'без оценки')} · {yachtName(c.yacht)}{c.venue ? `, ${venueName(c.venue)}` : ''}
                    {c.dsq ? ' · DSQ' : c.place && c.boats ? ` · ${c.place}/${c.boats}` : ''}{c.dev ? ` · ${dev(c.dev)}` : ''}</span>
                  <p>{c.comment}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* how far a visit gets */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconScreen /><span className="kicker">{t('How far a visit gets', 'Как далеко заходят')}</span></div>
        <figure className="adm-funnel" aria-label={t('The visits, step by step', 'Заходы по шагам')}>
          {([[t('Opened the game', 'Открыли игру'), F.opened], [t('It loaded', 'Загрузилась'), F.loaded], [t('Began a race', 'Начали гонку'), F.raced], [t('Finished one', 'Финишировали'), F.finished]] as [string, number][]).map(([k, n]) => (
            <div key={k} className="adm-star">
              <span className="adm-star-k adm-funnel-k">{k}</span>
              <span className="adm-star-bar"><i style={{ width: `${F.opened ? (100 * n) / F.opened : 0}%` }} /></span>
              <span className="adm-star-v">{n} · {pct(n, F.opened)}</span>
            </div>
          ))}
        </figure>
        <div className="adm-tiles">
          <Tile k={t('Gave up while loading', 'Ушли во время загрузки')} v={`${F.gave_up} · ${pct(F.gave_up, F.opened)}`} />
          <Tile k={t('Failed to load', 'Не загрузилась')} v={`${F.failed} · ${pct(F.failed, F.opened)}`} />
          <Tile k={t('Seconds to load', 'Секунд на загрузку')} v={fix(F.load, 1)} />
          <Tile k={t('Minutes a visit', 'Минут за заход')} v={fix(F.mins, 1)} />
          <Tile k={t('Races a visit', 'Гонок за заход')} v={fix(F.races, 1)} />
        </div>
        <Table title={t('By device', 'По устройству')} first={t('Device', 'Устройство')} head={[t('Opened', 'Открыли'), t('Loaded', 'Загрузилась'), t('Gave up', 'Ушли'), t('Failed', 'Ошибка'), t('Raced', 'Гонка')]}
          rows={Object.entries(F.dev).sort((a, b) => b[1].opened - a[1].opened).map(([k, x]) => ({ key: k, name: dev(k), cells: [String(x.opened), pct(x.loaded, x.opened), pct(x.gave_up, x.opened), pct(x.failed, x.opened), pct(x.raced, x.opened)] }))} />
        <Table title={t('Why a load failed', 'Почему не загрузилась')} first={t('Reason', 'Причина')} head={[t('Visits', 'Заходов')]}
          rows={F.why.map((w) => ({ key: w.why, name: w.why, cells: [String(w.n)] }))} />
        <Table title={t('Errors on the page', 'Ошибки на странице')} first={t('Error', 'Ошибка')} head={[t('Where', 'Где'), t('Times', 'Раз'), t('Visits', 'Заходов')]}
          rows={F.errors.map((e) => ({ key: e.m + e.src, name: e.m, cells: [e.src || '–', String(e.n), String(e.visits)] }))} />
        <div className="adm-tiles">
          <Tile k={t('Opened How to play', 'Открыли «Как играть»')} v={pct(F.howto, F.loaded)} />
          <Tile k={t('Sailed a drill', 'Проходили тренировку')} v={String(F.drill)} />
          <Tile k={t('Raced a ghost', 'Гонялись с призраком')} v={String(F.ghost)} />
          <Tile k={t('Lost the 3D (WebGL)', 'Потеряли 3D (WebGL)')} v={String(F.lost)} />
        </div>
        <p className="hint">{t('A visit is the game’s page opened. Followed from 17 November; a page opened from a cached copy of the game before that may have no opening.',
          'Заход — это одно открытие страницы игры. Отслеживается с 17 ноября; страница, открытая из старой копии игры, может прийти без записи об открытии.')}</p>
      </div>

      {/* what they set */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconSliders /><span className="kicker">{t('What they set', 'Чем пользуются')}</span></div>
        <div className="adm-sets">
          {Object.keys(SET).filter((k) => U[k]).map((k) => {
            const n = sum(U[k]);
            return <Table key={k} title={SET[k][L]} first={t('Setting', 'Значение')} head={[t('Races', 'Гонок'), t('Share', 'Доля')]}
              rows={sorted(U[k]).map(([v, c]) => ({ key: v, name: val(k, v), cells: [String(c), pct(c, n)] }))} />;
          })}
        </div>
        <p className="hint">{t('As each race ended: what the player had set then.', 'На момент окончания каждой гонки: что было выставлено у игрока.')}</p>
      </div>

      {/* difficulty */}
      <div className="adm adm-stats">
        <div className="adm-k"><IconBoats /><span className="kicker">{t('Too easy, too hard', 'Слишком легко или сложно')}</span></div>
        <Table title={t('By how many races the player had sailed', 'По опыту игрока')} first={t('Race', 'Гонка')}
          head={[t('Races', 'Гонок'), t('Players', 'Игроков'), t('Finished', 'Финиш'), t('Top 3', 'Топ-3'), t('DSQ', 'DSQ'), t('Place', 'Место'), t('Penalties', 'Штрафов')]}
          rows={D.map((d) => ({ key: String(d.b), name: BUCKET[d.b], cells: [String(d.n), String(d.who), pct(d.fin, d.n), pct(d.top3, d.fin), pct(d.dsq, d.n), d.down == null ? '–' : `${Math.round(100 * d.down)}%`, fix(d.pens, 1)] }))} />
        <p className="hint">{t('Place: the median, 0% first in the fleet, 100% last. Top 3: of the races finished. Penalties: the average in a finished race (from 17 November). A guest’s races are counted by their browser.',
          'Место — медиана: 0% — первым во флоте, 100% — последним. Топ-3 — от финишировавших. Штрафов — в среднем за финишированную гонку (с 17 ноября). Гонки гостя считаются по его браузеру.')}</p>
      </div>
    </>
  );
}
