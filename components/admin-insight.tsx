import { pick, LOCALE, tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { Table, Tile } from './admin-stats';
import { IconBoats, IconCrew, IconFlag, IconScreen, IconSliders, IconTrophy } from './ui';

// The admin's look at how the players like the game, over the last `days`: why races are left
// (how each ended, how far it had got, the last incident before), whether players come back, what they say (the
// result page's stars and comments), how far a visit gets (opened, loaded, a race, a finish; loads that failed or were
// given up, the errors), what they set, and how the races go as a player gets more of them behind her. All of it from
// the database's regatta_admin_insight (supabase/migrations/20261117130000_game_insight.sql in the iyt-test repo),
// which answers an admin alone. Drawn on the server, per request, a block at a time: how far a visit gets and whether
// they come back on /admin/players; why races are left, how hard, what they say and set on /admin/game; the loads that
// failed and the errors on /admin/tech.
type Num = number | null;
export type Insight = {
  since: string;
  exits: { how: Record<string, number>; stage: Record<string, number>; last: Record<string, number>; left: number; mins_left: Num; mins_fin: Num };
  retention: { new: number; d1: number; d1of: number; d7: number; d7of: number; d30: number; d30of: number; back: number; active: number };
  ratings: { n: number; avg: Num; stars: number[]; yacht: Record<string, { n: number; avg: number }>; comments: { at: string; rating: Num; comment: string; yacht: string; venue: string | null; wind: string | null; place: Num; boats: Num; dsq: boolean; dev: string | null; how: string | null }[] };
  funnel: { opened: number; loaded: number; failed: number; gave_up: number; raced: number; finished: number; load: Num; mins: Num; races: Num;
    dev: Record<string, { opened: number; loaded: number; gave_up: number; failed: number; raced: number }>; why: { why: string; n: number }[];
    errors: { m: string; src: string | null; n: number; visits: number }[]; lost: number; howto: number; drill: number };
  usage: Record<string, Record<string, number>>;
  difficulty: { b: number; n: number; fin: number; top3: number; dsq: number; who: number; down: Num; pens: Num }[];
};

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const fix = (x: Num | undefined, k = 0) => (x == null ? '–' : x.toFixed(k));
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

const HOW: Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
  finish: ['Finished', 'Финишировал', 'Terminó', 'Im Ziel', 'Bitti'], restart: ['Restarted', 'Начал заново', 'Reinició', 'Neu gestartet', 'Yeniden başladı'], change: ['Changed the race', 'Сменил гонку', 'Cambió la regata', 'Regatta geändert', 'Yarışı değiştirdi'], menu: ['Back to the menu', 'Вышел в меню', 'Volvió al menú', 'Zurück zum Menü', 'Menüye döndü'],
  close: ['Closed the page', 'Закрыл страницу', 'Cerró la página', 'Seite geschlossen', 'Sayfayı kapattı'], hidden: ['Put the app away', 'Свернул приложение', 'Dejó la app en segundo plano', 'App weggelegt', 'Uygulamayı kenara koydu'], new: ['Began another', 'Начал другую', 'Empezó otra', 'Eine andere begonnen', 'Bir yenisine başladı'], unknown: ['Not kept (older races)', 'Не записано (старые гонки)', 'No guardado (regatas anteriores)', 'Nicht erfasst (ältere Regatten)', 'Tutulmadı (eski yarışlar)'],
};
const STAGE: Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
  'before the start': ['Before the start', 'До старта', 'Antes de la salida', 'Vor dem Start', 'Starttan önce'], 'first leg': ['First leg', 'Первый отрезок', 'Primer tramo', 'Erster Schenkel', 'İlk ayak'], 'middle legs': ['Middle legs', 'Средние отрезки', 'Tramos intermedios', 'Mittlere Schenkel', 'Ara ayaklar'],
  'last leg': ['Last leg', 'Последний отрезок', 'Último tramo', 'Letzter Schenkel', 'Son ayak'], unknown: ['Not known', 'Неизвестно', 'Desconocido', 'Unbekannt', 'Bilinmiyor'],
};
const INC: Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
  ocs: ['Over the line early', 'Фальстарт', 'Pasó la línea antes de tiempo', 'Zu früh über der Linie', 'Hattı erken geçti'], fouled: ['Broke a rule', 'Нарушил правило', 'Infringió una regla', 'Regel verletzt', 'Kuralı çiğnedi'], touched: ['Touched a mark', 'Задел знак', 'Tocó una baliza', 'Marke berührt', 'Şamandıraya dokundu'], bump: ['Collision', 'Столкновение', 'Colisión', 'Kollision', 'Çarpışma'],
  aground: ['Ran aground', 'Сел на мель', 'Encalló', 'Auf Grund gelaufen', 'Karaya oturdu'], penNow: ['Penalty to take', 'Штраф', 'Penalización pendiente', 'Strafe zu drehen', 'Alınacak ceza'], missedLine: ['Missed the line', 'Пропустил линию', 'No cruzó la línea', 'Linie verpasst', 'Hattı kaçırdı'], missedGate: ['Missed the gate', 'Пропустил ворота', 'Se saltó la puerta', 'Tor verpasst', 'Kapıyı kaçırdı'],
  wrongSide: ['Mark on the wrong side', 'Знак не с той стороны', 'Baliza por el lado equivocado', 'Marke auf der falschen Seite', 'Şamandıra yanlış tarafta'], genRecall: ['General recall', 'Общий отзыв', 'Llamada general', 'Allgemeiner Rückruf', 'Genel geri çağırma'], barging: ['Barging at the start', 'Баржинг на старте', 'Colarse en la salida', 'Drängeln beim Start', 'Startta sıkıştırma'],
  finishOwed: ['Finished owing a penalty', 'Финиш с невыполненным штрафом', 'Llegó con penalización pendiente', 'Mit offener Strafe im Ziel', 'Ceza borcuyla bitirdi'],
};
const SET: Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
  cam: ['Camera', 'Камера', 'Cámara', 'Kamera', 'Kamera'], trim: ['Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler'], sound: ['Sound', 'Звук', 'Sonido', 'Ton', 'Ses'], voice: ['Voices', 'Голоса', 'Voces', 'Stimmen', 'Sesler'], music: ['Music', 'Музыка', 'Música', 'Musik', 'Müzik'], sea: ['Sea', 'Море', 'Mar', 'Meer', 'Deniz'],
  saver: ['Battery saver', 'Экономия батареи', 'Ahorro de batería', 'Energiesparmodus', 'Pil tasarrufu'], gfx: ['Graphics setting', 'Настройка графики', 'Ajuste de gráficos', 'Grafikeinstellung', 'Grafik ayarı'], q: ['Graphics level', 'Уровень графики', 'Nivel de gráficos', 'Grafikstufe', 'Grafik düzeyi'], guides: ['Guides', 'Подсказки на воде', 'Guías', 'Hilfslinien', 'Kılavuzlar'],
  speed: ['Game speed', 'Скорость игры', 'Velocidad del juego', 'Spielgeschwindigkeit', 'Oyun hızı'],
};
const VAL: Record<string, Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]>> = {
  cam: { drone: ['Drone', 'Дрон', 'Dron', 'Drohne', 'Drone'], top: ['From above', 'Сверху', 'Desde arriba', 'Von oben', 'Yukarıdan'], helm: ['From the helm', 'С руля', 'Desde el timón', 'Vom Ruder', 'Dümenden'] },
  trim: { '0': ['By hand', 'Вручную', 'A mano', 'Von Hand', 'Elle'], '1': ['Auto', 'Авто', 'Auto', 'Auto', 'Otomatik'], '2': ['Main and jib apart', 'Раздельно', 'Mayor y foque por separado', 'Groß und Fock getrennt', 'Ana yelken ve flok ayrı'] },
  sound: { '0': ['Off', 'Выкл', 'No', 'Aus', 'Kapalı'], '1': ['On', 'Вкл', 'Sí', 'Ein', 'Açık'] }, voice: { '0': ['Off', 'Выкл', 'No', 'Aus', 'Kapalı'], '1': ['On', 'Вкл', 'Sí', 'Ein', 'Açık'] }, saver: { '0': ['Off', 'Выкл', 'No', 'Aus', 'Kapalı'], '1': ['On', 'Вкл', 'Sí', 'Ein', 'Açık'] },
  guides: { '0': ['Off', 'Выкл', 'No', 'Aus', 'Kapalı'], '1': ['On', 'Вкл', 'Sí', 'Ein', 'Açık'] },
  gfx: { auto: ['Auto', 'Авто', 'Auto', 'Auto', 'Otomatik'], high: ['High', 'Высокая', 'Alto', 'Hoch', 'Yüksek'], medium: ['Medium', 'Средняя', 'Media', 'Mittel', 'Orta'], low: ['Low', 'Низкая', 'Bajo', 'Niedrig', 'Düşük'] },
  q: { high: ['High', 'Высокая', 'Alto', 'Hoch', 'Yüksek'], medium: ['Medium', 'Средняя', 'Media', 'Mittel', 'Orta'], low: ['Low', 'Низкая', 'Bajo', 'Niedrig', 'Düşük'] },
};

function names(lang: Lang) {
  const t = tx(lang);
  return {
    t,
    yachtName: (id: string) => pick(YACHTS.find((y) => y.id === id)?.name, lang) ?? id,
    venueName: (id: string | null) => (id ? pick(VENUES.find((v) => v.id === id)?.name, lang) ?? id : ''),
    dev: (v: string) => {
      const [d, tg] = v.split(' ');
      const name = { phone: t('Phone', 'Телефон', 'Móvil', 'Handy', 'Telefon'), tablet: t('Tablet', 'Планшет', 'Tableta', 'Tablet', 'Tablet'), desktop: t('Computer', 'Компьютер', 'Ordenador', 'Computer', 'Bilgisayar') }[d] ?? t('Not known', 'Неизвестно', 'Desconocido', 'Unbekannt', 'Bilinmiyor');
      return tg ? `${name} · Telegram` : `${name} · ${t('browser', 'браузер', 'navegador', 'Browser', 'tarayıcı')}`;
    },
    date: (s: string) => new Date(s).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  };
}
type Props = { lang: Lang; data: Insight };

// why races are left: how each ended, how far it had got, the incident in the minute before
export function InsightExits({ lang, data }: Props) {
  const { t } = names(lang), X = data.exits;
  const total = sum(X.how), fin = X.how.finish || 0;
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconFlag /><span className="kicker">{t('Why races are left', 'Почему бросают гонки', 'Por qué se abandonan las regatas', 'Warum Regatten abgebrochen werden', 'Yarışlar neden bırakılıyor')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Finished', 'Дошли до финиша', 'Llegaron', 'Im Ziel', 'Bitti')} v={pct(fin, total)} />
        <Tile k={t('Left before the finish', 'Бросили до финиша', 'Abandonaron antes de la llegada', 'Vor dem Ziel verlassen', 'Bitişten önce bırakıldı')} v={String(X.left)} />
        <Tile k={t('Minutes to leaving', 'Минут до ухода', 'Minutos hasta el abandono', 'Minuten bis zum Verlassen', 'Bırakmaya kalan dakika')} v={fix(X.mins_left, 1)} />
        <Tile k={t('Minutes to the finish', 'Минут до финиша', 'Minutos hasta la llegada', 'Minuten bis ins Ziel', 'Bitişe kalan dakika')} v={fix(X.mins_fin, 1)} />
      </div>
      <Table title={t('How the race ended', 'Как закончилась гонка', 'Cómo terminó la regata', 'Wie die Regatta endete', 'Yarış nasıl bitti')} first={t('Ending', 'Исход', 'Final', 'Ende', 'Son')} head={[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar'), t('Share', 'Доля', 'Proporción', 'Teilen', 'Paylaş')]}
        rows={sorted(X.how).map(([k, n]) => ({ key: k, name: pick(HOW[k], lang) ?? k, cells: [String(n), pct(n, total)] }))} />
      <Table title={t('How far they got before leaving', 'Где бросили', 'Hasta dónde llegaron antes de abandonar', 'Wie weit sie vor dem Verlassen kamen', 'Bırakmadan önce ne kadar ilerlediler')} first={t('Stage', 'Этап', 'Etapa', 'Abschnitt', 'Aşama')} head={[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar'), t('Of those left', 'Из брошенных', 'De las abandonadas', 'Von den Abgebrochenen', 'Bırakanlardan')]}
        rows={sorted(X.stage).map(([k, n]) => ({ key: k, name: pick(STAGE[k], lang) ?? k, cells: [String(n), pct(n, X.left)] }))} />
      <Table title={t('What happened in the minute before', 'Что случилось за минуту до ухода', 'Qué pasó en el minuto anterior', 'Was in der Minute davor geschah', 'Önceki dakikada ne oldu')} first={t('Incident', 'Происшествие', 'Incidente', 'Vorfall', 'Olay')} head={[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar'), t('Of those left', 'Из брошенных', 'De las abandonadas', 'Von den Abgebrochenen', 'Bırakanlardan')]}
        rows={sorted(X.last).map(([k, n]) => ({ key: k, name: pick(INC[k], lang) ?? k, cells: [String(n), pct(n, X.left)] }))} />
      <p className="hint">{t('A race counts as finished when the player crossed the line, whatever came after. “Put the app away” may be followed by the race going on; the race is counted as it was left first. Races before 17 November weren’t followed.',
        'Гонка считается финишированной, если игрок пересёк линию, что бы ни было потом. После «свернул приложение» гонка могла продолжиться — считается первый уход. Гонки до 17 ноября не отслеживались.', 'Una regata cuenta como terminada cuando el jugador cruzó la línea, pase lo que pase después. Tras «Dejó la app en segundo plano» la regata puede continuar; se cuenta como se dejó la primera vez. Las regatas anteriores al 17 de noviembre no se registraron.', 'Eine Regatta zählt als beendet, wenn der Spieler die Linie überquert hat, was auch danach kam. Auf „App weggelegt“ kann die Regatta weiterlaufen; sie zählt so, wie sie zuerst verlassen wurde. Regatten vor dem 17. November wurden nicht verfolgt.', 'Oyuncu hattı geçtiyse, sonrasında ne olursa olsun yarış bitmiş sayılır. “Uygulamayı kenara koydu”nun ardından yarış sürebilir; yarış, ilk bırakıldığı haliyle sayılır. 17 Kasım’dan önceki yarışlar izlenmedi.')}</p>
    </div>
  );
}

// whether they come back: the players new in the period, back the next day, within a week and a month
export function InsightRetention({ lang, data }: Props) {
  const { t } = names(lang), R = data.retention;
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconCrew /><span className="kicker">{t('Do they come back', 'Возвращаются ли', '¿Vuelven?', 'Kommen sie wieder', 'Geri geliyorlar mı')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Players active', 'Активных игроков', 'Jugadores activos', 'Aktive Spieler', 'Aktif oyuncular')} v={String(R.active)} />
        <Tile k={t('New in the period', 'Новых за период', 'Nuevos en el periodo', 'Neu im Zeitraum', 'Dönemde yeni')} v={String(R.new)} />
        <Tile k={t('Came back another day', 'Вернулись в другой день', 'Volvieron otro día', 'An einem anderen Tag zurück', 'Başka bir gün geri geldi')} v={String(R.back)} />
        <Tile k={t('Next day', 'На следующий день', 'Al día siguiente', 'Am nächsten Tag', 'Ertesi gün')} v={pct(R.d1, R.d1of)} />
        <Tile k={t('Within a week', 'В течение недели', 'En una semana', 'Innerhalb einer Woche', 'Bir hafta içinde')} v={pct(R.d7, R.d7of)} />
        <Tile k={t('Within a month', 'В течение месяца', 'En un mes', 'Innerhalb eines Monats', 'Bir ay içinde')} v={pct(R.d30, R.d30of)} />
      </div>
      <p className="hint">{t(`A player is a Telegram user, a site account or, for a guest, a browser. The returns are of the players first seen in the period: next day over ${R.d1of} of them, within a week over ${R.d7of} (first seen 7 days ago or more), within a month over ${R.d30of}. Guests are followed from 17 November.`,
        `Игрок — это пользователь Telegram, аккаунт на сайте или, для гостя, браузер. Возвраты — среди впервые пришедших за период: на следующий день — из ${R.d1of}, за неделю — из ${R.d7of} (пришли 7 и более дней назад), за месяц — из ${R.d30of}. Гости отслеживаются с 17 ноября.`, `Un jugador es un usuario de Telegram, una cuenta del sitio o, si es invitado, un navegador. Los regresos son de los jugadores vistos por primera vez en el periodo: al día siguiente más de ${R.d1of} de ellos, en una semana más de ${R.d7of} (vistos por primera vez hace 7 días o más), en un mes más de ${R.d30of}. A los invitados se les sigue desde el 17 de noviembre.`, `Ein Spieler ist ein Telegram-Nutzer, ein Konto auf der Seite oder, als Gast, ein Browser. Die Rückkehrer sind die Spieler, die im Zeitraum zum ersten Mal auftauchten: am nächsten Tag über ${R.d1of} von ihnen, innerhalb einer Woche über ${R.d7of} (vor 7 Tagen oder früher erstmals gesehen), innerhalb eines Monats über ${R.d30of}. Gäste werden seit dem 17. November verfolgt.`, `Oyuncu; bir Telegram kullanıcısı, bir site hesabı ya da misafir için bir tarayıcıdır. Dönüşler, dönemde ilk görülen oyuncularınki: ertesi gün ${R.d1of} üzeri, bir hafta içinde ${R.d7of} üzeri (ilk görülmesinin üzerinden 7 gün ya da daha fazla geçenler), bir ay içinde ${R.d30of} üzeri. Misafirler 17 Kasım’dan itibaren izleniyor.`)}</p>
    </div>
  );
}

// what they say: the result page's stars, by yacht, and their words
export function InsightRatings({ lang, data }: Props) {
  const { t, yachtName, venueName, dev, date } = names(lang), S = data.ratings;
  const good = (S.stars[3] || 0) + (S.stars[4] || 0);
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconTrophy /><span className="kicker">{t('What they say', 'Что говорят', 'Qué dicen', 'Was sie sagen', 'Ne diyorlar')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Races rated', 'Оценок', 'Regatas valoradas', 'Bewertete Regatten', 'Puanlanan yarışlar')} v={String(S.n)} />
        <Tile k={t('Average', 'Средняя', 'Media', 'Durchschnitt', 'Ortalama')} v={S.avg == null ? '–' : `${S.avg.toFixed(1)} / 5`} />
        <Tile k={t('Four or five', 'Четыре или пять', 'Cuatro o cinco', 'Vier oder fünf', 'Dört ya da beş')} v={pct(good, S.n)} />
      </div>
      {S.n > 0 && (
        <figure className="adm-stars" aria-label={t('Ratings by stars', 'Оценки по звёздам', 'Valoraciones por estrellas', 'Bewertungen nach Sternen', 'Yıldızlara göre puanlar')}>
          <figcaption className="adm-tab-h">{t('Each rating', 'Каждая оценка', 'Cada valoración', 'Jede Bewertung', 'Her puan')}</figcaption>
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
      <Table title={t('By yacht', 'По яхтам', 'Por yate', 'Nach Yacht', 'Yata göre')} first={t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat')} head={[t('Ratings', 'Оценок', 'Valoraciones', 'Bewertungen', 'Puanlar'), t('Average', 'Средняя', 'Media', 'Durchschnitt', 'Ortalama')]}
        rows={Object.entries(S.yacht).sort((a, b) => b[1].n - a[1].n).map(([k, x]) => ({ key: k, name: yachtName(k), cells: [String(x.n), x.avg.toFixed(1)] }))} />
      {S.comments.length > 0 && (
        <section className="adm-tab">
          <h3 className="adm-tab-h">{t('Their words', 'Отзывы', 'Sus palabras', 'Ihre Worte', 'Sözleri')}</h3>
          <ul className="adm-comments">
            {S.comments.map((c, i) => (
              <li key={i}>
                <span className="adm-c-meta">{date(c.at)} · {c.rating ? '★'.repeat(c.rating) : t('no stars', 'без оценки', 'sin estrellas', 'keine Sterne', 'yıldızsız')} · {yachtName(c.yacht)}{c.venue ? `, ${venueName(c.venue)}` : ''}
                  {c.dsq ? ' · DSQ' : c.place && c.boats ? ` · ${c.place}/${c.boats}` : ''}{c.dev ? ` · ${dev(c.dev)}` : ''}</span>
                <p>{c.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// how far a visit gets: opened, loaded, a race begun and finished, by device; how long a visit is, and what else it does
export function InsightVisits({ lang, data }: Props) {
  const { t, dev } = names(lang), F = data.funnel;
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconScreen /><span className="kicker">{t('How far a visit gets', 'Как далеко заходят', 'Hasta dónde llega una visita', 'Wie weit ein Besuch kommt', 'Bir ziyaret ne kadar ilerliyor')}</span></div>
      <figure className="adm-funnel" aria-label={t('The visits, step by step', 'Заходы по шагам', 'Las visitas, paso a paso', 'Die Besuche, Schritt für Schritt', 'Ziyaretler adım adım')}>
        {([[t('Opened the game', 'Открыли игру', 'Abrieron el juego', 'Spiel geöffnet', 'Oyunu açtı'), F.opened], [t('It loaded', 'Загрузилась', 'Cargó', 'Geladen', 'Yüklendi'), F.loaded], [t('Began a race', 'Начали гонку', 'Empezaron una regata', 'Regatta begonnen', 'Yarışa başladı'), F.raced], [t('Finished one', 'Финишировали', 'Llegaron a una', 'Eine beendet', 'Birini bitirdi'), F.finished]] as [string, number][]).map(([k, n]) => (
          <div key={k} className="adm-star">
            <span className="adm-star-k adm-funnel-k">{k}</span>
            <span className="adm-star-bar"><i style={{ width: `${F.opened ? (100 * n) / F.opened : 0}%` }} /></span>
            <span className="adm-star-v">{n} · {pct(n, F.opened)}</span>
          </div>
        ))}
      </figure>
      <div className="adm-tiles">
        <Tile k={t('Gave up while loading', 'Ушли во время загрузки', 'Se fueron durante la carga', 'Beim Laden aufgegeben', 'Yüklenirken vazgeçti')} v={`${F.gave_up} · ${pct(F.gave_up, F.opened)}`} />
        <Tile k={t('Minutes a visit', 'Минут за заход', 'Minutos por visita', 'Minuten pro Besuch', 'Ziyaret başına dakika')} v={fix(F.mins, 1)} />
        <Tile k={t('Races a visit', 'Гонок за заход', 'Regatas por visita', 'Regatten pro Besuch', 'Ziyaret başına yarış')} v={fix(F.races, 1)} />
      </div>
      <Table title={t('By device', 'По устройству', 'Por dispositivo', 'Nach Gerät', 'Cihaza göre')} first={t('Device', 'Устройство', 'Dispositivo', 'Gerät', 'Cihaz')} head={[t('Opened', 'Открыли', 'Abrieron', 'Geöffnet', 'Açıldı'), t('Loaded', 'Загрузилась', 'Cargó', 'Geladen', 'Yüklendi'), t('Gave up', 'Ушли', 'Se fueron', 'Aufgegeben', 'Vazgeçti'), t('Failed', 'Ошибка', 'Fallo', 'Fehlgeschlagen', 'Başarısız'), t('Raced', 'Гонка', 'Regatearon', 'Gesegelt', 'Yarıştı')]}
        rows={Object.entries(F.dev).sort((a, b) => b[1].opened - a[1].opened).map(([k, x]) => ({ key: k, name: dev(k), cells: [String(x.opened), pct(x.loaded, x.opened), pct(x.gave_up, x.opened), pct(x.failed, x.opened), pct(x.raced, x.opened)] }))} />
      <div className="adm-tiles">
        <Tile k={t('Opened How to play', 'Открыли «Как играть»', 'Abrieron «Cómo jugar»', '„So spielst du“ geöffnet', '“Nasıl oynanır”ı açtı')} v={pct(F.howto, F.loaded)} />
        <Tile k={t('Sailed a drill', 'Проходили тренировку', 'Hicieron un ejercicio', 'Übung gesegelt', 'Alıştırma yaptı')} v={String(F.drill)} />
      </div>
      <p className="hint">{t('A visit is the game’s page opened. Followed from 17 November; a page opened from a cached copy of the game before that may have no opening.',
        'Заход — это одно открытие страницы игры. Отслеживается с 17 ноября; страница, открытая из старой копии игры, может прийти без записи об открытии.', 'Una visita es la página del juego abierta. Se sigue desde el 17 de noviembre; una página abierta desde una copia en caché del juego anterior a esa fecha puede no tener apertura.', 'Ein Besuch ist die geöffnete Seite des Spiels. Verfolgt seit dem 17. November; eine Seite, die zuvor aus einer zwischengespeicherten Kopie des Spiels geöffnet wurde, hat womöglich kein Öffnen.', 'Ziyaret, oyunun sayfasının açılmasıdır. 17 Kasım’dan itibaren izleniyor; ondan önce oyunun önbellekteki bir kopyasından açılan sayfanın açılış kaydı olmayabilir.')}</p>
    </div>
  );
}

// the loads that failed or were given up and why, the errors most seen, the 3D lost
export function InsightLoading({ lang, data }: Props) {
  const { t } = names(lang), F = data.funnel;
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconScreen /><span className="kicker">{t('Loads and errors', 'Загрузка и ошибки', 'Cargas y errores', 'Ladezeiten und Fehler', 'Yüklemeler ve hatalar')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Failed to load', 'Не загрузилась', 'No cargó', 'Laden fehlgeschlagen', 'Yüklenemedi')} v={`${F.failed} · ${pct(F.failed, F.opened)}`} />
        <Tile k={t('Gave up while loading', 'Ушли во время загрузки', 'Se fueron durante la carga', 'Beim Laden aufgegeben', 'Yüklenirken vazgeçti')} v={`${F.gave_up} · ${pct(F.gave_up, F.opened)}`} />
        <Tile k={t('Seconds to load', 'Секунд на загрузку', 'Segundos de carga', 'Sekunden bis zum Laden', 'Yüklenme saniyesi')} v={fix(F.load, 1)} />
        <Tile k={t('Lost the 3D (WebGL)', 'Потеряли 3D (WebGL)', 'Perdieron el 3D (WebGL)', '3D verloren (WebGL)', '3D (WebGL) kayboldu')} v={String(F.lost)} />
      </div>
      <Table title={t('Why a load failed', 'Почему не загрузилась', 'Por qué falló una carga', 'Warum ein Laden fehlschlug', 'Yükleme neden başarısız oldu')} first={t('Reason', 'Причина', 'Motivo', 'Grund', 'Neden')} head={[t('Visits', 'Заходов', 'Visitas', 'Besuche', 'Ziyaret')]}
        rows={F.why.map((w) => ({ key: w.why, name: w.why, cells: [String(w.n)] }))} />
      <Table title={t('Errors on the page', 'Ошибки на странице', 'Errores en la página', 'Fehler auf der Seite', 'Sayfadaki hatalar')} first={t('Error', 'Ошибка', 'Error', 'Fehler', 'Hata')} head={[t('Where', 'Где', 'Dónde', 'Wo', 'Nerede'), t('Times', 'Раз', 'Veces', 'Mal', 'Kez'), t('Visits', 'Заходов', 'Visitas', 'Besuche', 'Ziyaret')]}
        rows={F.errors.map((e) => ({ key: e.m + e.src, name: e.m, cells: [e.src || '–', String(e.n), String(e.visits)] }))} />
      <p className="hint">{t(`Of the ${F.opened} visits in the period. Followed from 17 November.`, `Из ${F.opened} заходов за период. Отслеживается с 17 ноября.`, `De las ${F.opened} visitas del periodo. Se sigue desde el 17 de noviembre.`, `Von den ${F.opened} Besuchen im Zeitraum. Verfolgt seit dem 17. November.`, `Dönemdeki ${F.opened} ziyaretten. 17 Kasım’dan itibaren izleniyor.`)}</p>
    </div>
  );
}

// what they set as each race ended
export function InsightSettings({ lang, data }: Props) {
  const { t } = names(lang), U = data.usage;
  const val = (k: string, v: string) => pick(VAL[k]?.[v], lang) ?? (k === 'speed' ? `×${v}` : v);
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconSliders /><span className="kicker">{t('What they set', 'Чем пользуются', 'Qué ajustan', 'Was sie einstellen', 'Neyi ayarlıyorlar')}</span></div>
      <div className="adm-sets">
        {Object.keys(SET).filter((k) => U[k]).map((k) => {
          const n = sum(U[k]);
          return <Table key={k} title={pick(SET[k], lang)} first={t('Setting', 'Значение', 'Ajuste', 'Einstellung', 'Ayar')} head={[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar'), t('Share', 'Доля', 'Proporción', 'Teilen', 'Paylaş')]}
            rows={sorted(U[k]).map(([v, c]) => ({ key: v, name: val(k, v), cells: [String(c), pct(c, n)] }))} />;
        })}
      </div>
      <p className="hint">{t('As each race ended: what the player had set then.', 'На момент окончания каждой гонки: что было выставлено у игрока.', 'Al terminar cada regata: lo que el jugador tenía ajustado entonces.', 'Zum Ende jeder Regatta: was der Spieler dann eingestellt hatte.', 'Her yarış biterken: oyuncunun o sırada ayarladıkları.')}</p>
    </div>
  );
}

// how the races go as a player gets more of them behind her
export function InsightDifficulty({ lang, data }: Props) {
  const { t } = names(lang), D = data.difficulty;
  const BUCKET = ['', t('Their 1st race', '1-я гонка игрока', 'Su 1.ª regata', 'Ihre 1. Regatta', 'İlk yarışı'), t('2nd–5th', '2–5-я', '2.ª–5.ª', '2.–5.', '2.–5.'), t('6th–20th', '6–20-я', '6.ª–20.ª', '6.–20.', '6.–20.'), t('21st and on', '21-я и дальше', '21.ª y siguientes', 'Ab der 21.', '21. ve sonrası')];
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconBoats /><span className="kicker">{t('Too easy, too hard', 'Слишком легко или сложно', 'Demasiado fácil, demasiado difícil', 'Zu leicht, zu schwer', 'Çok kolay, çok zor')}</span></div>
      <Table title={t('By how many races the player had sailed', 'По опыту игрока', 'Según cuántas regatas había navegado el jugador', 'Nach der Zahl der gesegelten Regatten', 'Oyuncunun yarıştığı yarış sayısına göre')} first={t('Race', 'Гонка', 'Regata', 'Regatta', 'Yarış')}
        head={[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar'), t('Players', 'Игроков', 'Jugadores', 'Spieler', 'Oyuncu'), t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi'), t('Top 3', 'Топ-3', 'Top 3', 'Top 3', 'İlk 3'), t('DSQ', 'DSQ'), t('Place', 'Место', 'Puesto', 'Platz', 'Sıra'), t('Penalties', 'Штрафов', 'Penalizaciones', 'Strafen', 'Cezalar')]}
        rows={D.map((d) => ({ key: String(d.b), name: BUCKET[d.b], cells: [String(d.n), String(d.who), pct(d.fin, d.n), pct(d.top3, d.fin), pct(d.dsq, d.n), d.down == null ? '–' : `${Math.round(100 * d.down)}%`, fix(d.pens, 1)] }))} />
      <p className="hint">{t('Place: the median, 0% first in the fleet, 100% last. Top 3: of the races finished. Penalties: the average in a finished race (from 17 November). A guest’s races are counted by their browser.',
        'Место — медиана: 0% — первым во флоте, 100% — последним. Топ-3 — от финишировавших. Штрафов — в среднем за финишированную гонку (с 17 ноября). Гонки гостя считаются по его браузеру.', 'Puesto: la mediana, 0 % primero de la flota, 100 % último. Top 3: de las regatas terminadas. Penalizaciones: la media en una regata terminada (desde el 17 de noviembre). Las regatas de un invitado se cuentan por su navegador.', 'Platz: der Median, 0 % für den Ersten im Feld, 100 % für den Letzten. Top 3: von den beendeten Regatten. Strafen: der Durchschnitt in einer beendeten Regatta (seit dem 17. November). Die Regatten eines Gastes werden über seinen Browser gezählt.', 'Sıra: ortanca; %0 filoda birinci, %100 sonuncu. İlk 3: bitirilen yarışların. Cezalar: bitirilen bir yarıştaki ortalama (17 Kasım’dan itibaren). Misafirin yarışları tarayıcısına göre sayılır.')}</p>
    </div>
  );
}
