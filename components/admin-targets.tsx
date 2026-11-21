import { LOCALE, tx, type Lang } from '@/lib/lang';

// The 1-on-1 plan's targets (its eighth lesson, "a number to move": each release has its target, set against release 1's
// baseline), measured on the admin's 1-on-1 page over its period. The database's regatta_admin_targets (iyt-test
// supabase/migrations/20261122090000_regatta_targets.sql) gives each figure as [hits, of], or for the wait [median
// seconds, of] and for days sailed [days, sailors]; this says what each target is, what it stands at and whether it's met.
type Pair = [number | null, number];
export type Targets = { since: string | null } & Partial<Record<TargetKey, Pair>> & { days_now?: Pair; days_prev?: Pair; wait_all?: Pair };
type TargetKey = 'gun' | 'gun_fin' | 'trusted' | 'rated_1min' | 'disputed' | 'invite_gun' | 'invite_fin' | 'claim' | 'rematch' | 'wait_hour' | 'pair_gun' | 'first_fin' | 'back_7' | 'push_ok' | 'call_10' | 'fy_tap' | 'fy_dismiss';
// a share at least or under a percentage, a time at most so many seconds, or a baseline (no target, written down)
type Goal = { key: TargetKey; rel: number; op: 'min' | 'max' | 'under' | 'base'; v: number; secs?: true };

export const GOALS: Goal[] = [
  { key: 'gun', rel: 1, op: 'base', v: 0 }, { key: 'gun_fin', rel: 1, op: 'base', v: 0 }, { key: 'trusted', rel: 1, op: 'min', v: 95 },
  { key: 'rated_1min', rel: 2, op: 'min', v: 99 }, { key: 'disputed', rel: 2, op: 'under', v: 2 },
  { key: 'invite_gun', rel: 3, op: 'min', v: 60 }, { key: 'invite_fin', rel: 3, op: 'min', v: 80 }, { key: 'claim', rel: 3, op: 'min', v: 25 }, { key: 'rematch', rel: 3, op: 'min', v: 30 },
  { key: 'wait_hour', rel: 4, op: 'max', v: 30, secs: true }, { key: 'pair_gun', rel: 4, op: 'min', v: 75 }, { key: 'first_fin', rel: 4, op: 'min', v: 80 }, { key: 'back_7', rel: 4, op: 'min', v: 50 },
  { key: 'push_ok', rel: 5, op: 'min', v: 40 }, { key: 'call_10', rel: 5, op: 'min', v: 50 },
  { key: 'fy_tap', rel: 7, op: 'min', v: 10 }, { key: 'fy_dismiss', rel: 7, op: 'under', v: 20 },
];

export type Status = 'met' | 'not' | 'none' | 'base';
// where a figure stands against its goal: no data, a baseline written down, met or not yet
export function standing(g: Goal, p: Pair | undefined): Status {
  if (!p || !p[1] || p[0] == null) return 'none';
  if (g.op === 'base') return 'base';
  const v = g.secs ? p[0] : (100 * p[0]) / p[1];
  return (g.op === 'min' ? v >= g.v : g.op === 'max' ? v <= g.v : v < g.v) ? 'met' : 'not';
}
// days sailed a month per active sailor: up on the 30 days before, or no days before to compare with
export function daysStanding(now: Pair | undefined, prev: Pair | undefined): Status {
  if (!now || !now[1] || now[0] == null) return 'none';
  if (!prev || !prev[1] || prev[0] == null) return 'base';
  return now[0] > prev[0] ? 'met' : 'not';
}

export function AdminTargets({ lang, data }: { lang: Lang; data: Targets }) {
  const t = tx(lang);
  const REL: Record<number, string> = {
    1: t('1 · Trusted results', '1 · Надёжный итог', '1 · Resultados fiables', '1 · Gesicherte Ergebnisse', '1 · Güvenilir sonuçlar', '1 · Résultats fiables', '1 · Risultati affidabili', '1 · Resultados confiáveis'),
    2: t('2 · The rating', '2 · Рейтинг', '2 · El rating', '2 · Die Wertung', '2 · Reyting', '2 · Le classement', '2 · Il rating', '2 · O rating'),
    3: t('3 · Friend challenge', '3 · Вызов другу', '3 · Reto a un amigo', '3 · Freundes-Herausforderung', '3 · Arkadaşa meydan okuma', '3 · Défi à un ami', '3 · Sfida a un amico', '3 · Desafio a um amigo'),
    4: t('4 · Matchmaking', '4 · Подбор соперника', '4 · Emparejamiento', '4 · Gegnersuche', '4 · Eşleştirme', '4 · Appariement', '4 · Abbinamento', '4 · Pareamento'),
    5: t('5 · Messages', '5 · Сообщения', '5 · Mensajes', '5 · Nachrichten', '5 · Mesajlar', '5 · Messages', '5 · Messaggi', '5 · Mensagens'),
    6: t('6 · Today’s race pages', '6 · Страницы гонки дня', '6 · Páginas de la regata del día', '6 · Seiten der Tagesregatta', '6 · Günün yarışı sayfaları', '6 · Pages de la régate du jour', '6 · Pagine della regata del giorno', '6 · Páginas da regata do dia'),
    7: t('7 · Player and help', '7 · Игрок и помощь', '7 · Jugador y ayuda', '7 · Spieler und Hilfe', '7 · Oyuncu ve yardım', '7 · Joueur et aide', '7 · Giocatore e aiuto', '7 · Jogador e ajuda'),
  };
  const WHAT: Record<TargetKey, string> = {
    gun: t('1-on-1s that reach the gun', 'гонки 1 на 1, дошедшие до старта', '1 contra 1 que llegan a la salida', '1-gegen-1, die den Start erreichen', 'Starta ulaşan bire birler', 'Duels qui arrivent au départ', 'Duelli che arrivano alla partenza', 'Duelos que chegam à largada'),
    gun_fin: t('of those, reach the finish', 'из них дошли до финиша', 'de ellas, llegan a la meta', 'davon im Ziel', 'bunların bitişe ulaşanı', 'parmi eux, arrivent à l’arrivée', 'di questi, arrivano al traguardo', 'destes, chegam à chegada'),
    trusted: t('finished races with both accounts and both screens agreeing', 'финиш с двумя аккаунтами и согласием экранов', 'terminadas con dos cuentas y ambas pantallas de acuerdo', 'beendet mit zwei Konten und einigen Bildschirmen', 'iki hesaplı ve ekranları uyuşan biten yarışlar', 'terminées avec deux comptes et les deux écrans d’accord', 'finite con due account e schermi concordi', 'terminadas com duas contas e as duas telas de acordo'),
    rated_1min: t('rated races with the new rating within a minute of the finish', 'рейтинг обновлён в течение минуты после финиша', 'regatas con el nuevo rating antes de un minuto tras la meta', 'neue Wertung binnen einer Minute nach dem Ziel', 'bitişten sonraki bir dakikada yeni reyting', 'nouveau classement moins d’une minute après l’arrivée', 'nuovo rating entro un minuto dal traguardo', 'novo rating até um minuto após a chegada'),
    disputed: t('finished rated races disputed', 'спорные среди рейтинговых', 'regatas puntuables en disputa', 'strittige gewertete Regatten', 'tartışmalı reytingli yarışlar', 'régates classées contestées', 'regate valide contestate', 'regatas valendo rating contestadas'),
    invite_gun: t('friends’ links opened that reach the gun', 'открытые ссылки друзей, дошедшие до старта', 'enlaces de amigos abiertos que llegan a la salida', 'geöffnete Freundes-Links, die den Start erreichen', 'açılan arkadaş bağlantılarından starta ulaşanlar', 'liens d’amis ouverts qui arrivent au départ', 'link di amici aperti che arrivano alla partenza', 'links de amigos abertos que chegam à largada'),
    invite_fin: t('of those, reach the finish', 'из них дошли до финиша', 'de ellos, llegan a la meta', 'davon im Ziel', 'bunların bitişe ulaşanı', 'parmi eux, arrivent à l’arrivée', 'di questi, arrivano al traguardo', 'destes, chegam à chegada'),
    claim: t('guests who finish and sign in to keep the race', 'гости, вошедшие после финиша, чтобы сохранить гонку', 'invitados que terminan y entran para guardar la regata', 'Gäste, die nach dem Ziel zum Behalten anmelden', 'bitirip yarışı saklamak için giriş yapan misafirler', 'invités qui finissent et se connectent pour garder la régate', 'ospiti che finiscono e accedono per tenere la regata', 'visitantes que terminam e entram para guardar a regata'),
    rematch: t('finished races followed by a rematch within 5 min', 'гонки с реваншем в течение 5 минут', 'regatas seguidas de revancha en 5 min', 'Regatten mit Revanche binnen 5 Min.', '5 dk içinde rövanşla devam eden yarışlar', 'régates suivies d’une revanche sous 5 min', 'regate seguite da una rivincita entro 5 min', 'regatas seguidas de revanche em 5 min'),
    wait_hour: t('median wait from Find a race to Match found, in the duel hour', 'медиана ожидания соперника в час дуэлей', 'espera mediana hasta Rival encontrado, en la hora de duelos', 'mittlere Wartezeit bis Gegner gefunden, in der Duellstunde', 'düello saatinde rakip bulunana kadar medyan bekleme', 'attente médiane jusqu’à Adversaire trouvé, à l’heure des duels', 'attesa mediana fino ad Avversario trovato, nell’ora dei duelli', 'espera mediana até Adversário encontrado, na hora dos duelos'),
    pair_gun: t('matches found that reach the gun', 'найденные пары, дошедшие до старта', 'emparejamientos que llegan a la salida', 'gefundene Paarungen, die den Start erreichen', 'starta ulaşan eşleşmeler', 'appariements qui arrivent au départ', 'abbinamenti che arrivano alla partenza', 'pareamentos que chegam à largada'),
    first_fin: t('first 1-on-1s that reach the finish', 'первые гонки 1 на 1, дошедшие до финиша', 'primeros 1 contra 1 que llegan a la meta', 'erste 1-gegen-1 im Ziel', 'bitişe ulaşan ilk bire birler', 'premiers duels qui arrivent à l’arrivée', 'primi duelli che arrivano al traguardo', 'primeiros duelos que chegam à chegada'),
    back_7: t('back within 7 days of a first 1-on-1', 'вернулись в течение 7 дней после первой гонки 1 на 1', 'vuelven en 7 días tras su primer 1 contra 1', 'binnen 7 Tagen nach dem ersten 1-gegen-1 zurück', 'ilk bire birden sonraki 7 günde geri dönenler', 'revenus sous 7 jours après un premier duel', 'tornati entro 7 giorni dal primo duello', 'voltaram em 7 dias após o primeiro duelo'),
    push_ok: t('Match found sent while away, ending in a match both accepted', 'сообщения «Соперник найден», приведшие к принятой гонке', 'Rival encontrado enviado en ausencia, que acaba en regata aceptada', 'Gegner gefunden in Abwesenheit gesendet, mit angenommener Regatta', 'yokken gönderilen Rakip bulundu, kabul edilen yarışla biten', 'Adversaire trouvé envoyé en absence, finissant en duel accepté', 'Avversario trovato inviato in assenza, finito in un duello accettato', 'Adversário encontrado enviado na ausência, terminando em duelo aceito'),
    call_10: t('open calls taken within 10 minutes', 'открытые вызовы, принятые за 10 минут', 'llamadas abiertas aceptadas en 10 minutos', 'offene Aufrufe binnen 10 Minuten angenommen', '10 dakikada alınan açık çağrılar', 'appels ouverts pris sous 10 minutes', 'chiamate aperte accettate entro 10 minuti', 'chamadas abertas aceitas em 10 minutos'),
    fy_tap: t('For you cards shown that are tapped', 'карточки «Для тебя», по которым нажали', 'tarjetas Para ti mostradas que se tocan', 'gezeigte Für-dich-Karten, die angetippt werden', 'gösterilen Senin için kartlarından dokunulanlar', 'cartes Pour toi affichées qui sont touchées', 'schede Per te mostrate che vengono toccate', 'cartões Para você mostrados que são tocados'),
    fy_dismiss: t('For you cards shown that are dismissed', 'карточки «Для тебя», которые скрыли', 'tarjetas Para ti mostradas que se descartan', 'gezeigte Für-dich-Karten, die verworfen werden', 'gösterilen Senin için kartlarından kapatılanlar', 'cartes Pour toi affichées qui sont écartées', 'schede Per te mostrate che vengono scartate', 'cartões Para você mostrados que são dispensados'),
  };
  const NOTE: Partial<Record<TargetKey, string>> = {
    push_ok: t('Opens aren’t recorded, so this is of those sent.', 'Открытия не записываются, поэтому считаем от отправленных.', 'Las aperturas no se registran: se cuenta sobre las enviadas.', 'Öffnungen werden nicht erfasst, daher von den gesendeten.', 'Açılmalar kaydedilmiyor, gönderilenlere göre sayılıyor.', 'Les ouvertures ne sont pas enregistrées : sur les envoyés.', 'Le aperture non sono registrate: sugli inviati.', 'As aberturas não são registradas: sobre as enviadas.'),
    wait_hour: t('Kept only since this table went live.', 'Записывается только с запуска этой таблицы.', 'Se registra solo desde que esta tabla está en línea.', 'Erst seit dieser Tabelle erfasst.', 'Yalnızca bu tablo yayına girdiğinden beri kaydediliyor.', 'Enregistré seulement depuis la mise en ligne de ce tableau.', 'Registrato solo da quando questa tabella è online.', 'Registrado só desde que esta tabela entrou no ar.'),
    invite_gun: t('Opens kept only since this table went live.', 'Открытия записываются только с запуска этой таблицы.', 'Aperturas registradas solo desde que esta tabla está en línea.', 'Öffnungen erst seit dieser Tabelle erfasst.', 'Açılmalar yalnızca bu tablo yayına girdiğinden beri kaydediliyor.', 'Ouvertures enregistrées seulement depuis la mise en ligne de ce tableau.', 'Aperture registrate solo da quando questa tabella è online.', 'Aberturas registradas só desde que esta tabela entrou no ar.'),
  };
  const GOAL = (g: Goal) => (g.op === 'base' ? t('Baseline', 'База', 'Base', 'Ausgangswert', 'Başlangıç', 'Référence', 'Base', 'Base') : g.secs ? `≤ ${g.v} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}` : `${g.op === 'min' ? '≥' : '<'} ${g.v}%`);
  const STATUS: Record<Status, string> = {
    met: t('Met', 'Выполнено', 'Cumplido', 'Erreicht', 'Tuttu', 'Atteint', 'Raggiunto', 'Atingido'),
    not: t('Not yet', 'Пока нет', 'Aún no', 'Noch nicht', 'Henüz değil', 'Pas encore', 'Non ancora', 'Ainda não'),
    none: t('No data yet', 'Нет данных', 'Sin datos aún', 'Noch keine Daten', 'Henüz veri yok', 'Pas encore de données', 'Ancora nessun dato', 'Sem dados ainda'),
    base: t('Written down', 'Записано', 'Anotado', 'Festgehalten', 'Kaydedildi', 'Noté', 'Annotato', 'Anotado'),
  };
  const of = (a: number, b: number) => t(`${a} of ${b}`, `${a} из ${b}`, `${a} de ${b}`, `${a} von ${b}`, `${b} içinde ${a}`, `${a} sur ${b}`, `${a} su ${b}`, `${a} de ${b}`);
  const secs = (v: number) => `${Math.round(v)} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}`;
  const sailors = (n: number) => t(`${n} sailors`, `гонщиков: ${n}`, `${n} regatistas`, `${n} Segler`, `${n} denizci`, `${n} marins`, `${n} velisti`, `${n} velejadores`);
  const now = (g: Goal, p: Pair | undefined) => {
    if (!p || !p[1] || p[0] == null) return '–';
    if (g.secs) return `${secs(p[0])} · ${t(`${p[1]} waits`, `ожиданий: ${p[1]}`, `${p[1]} esperas`, `${p[1]} Wartezeiten`, `${p[1]} bekleme`, `${p[1]} attentes`, `${p[1]} attese`, `${p[1]} esperas`)}`;
    return `${Math.round((100 * p[0]) / p[1])}% · ${of(p[0], p[1])}`;
  };
  const tone = (s: Status) => (s === 'met' ? 'var(--up)' : s === 'not' ? 'var(--warn)' : undefined);
  const allHours = data.wait_all && data.wait_all[1] && data.wait_all[0] != null ? t(`At any hour: ${secs(data.wait_all[0])}.`, `В любой час: ${secs(data.wait_all[0])}.`, `A cualquier hora: ${secs(data.wait_all[0])}.`, `Zu jeder Stunde: ${secs(data.wait_all[0])}.`, `Her saatte: ${secs(data.wait_all[0])}.`, `À toute heure : ${secs(data.wait_all[0])}.`, `A qualsiasi ora: ${secs(data.wait_all[0])}.`, `A qualquer hora: ${secs(data.wait_all[0])}.`) : null;
  const days = daysStanding(data.days_now, data.days_prev);
  const daysNow = (p: Pair | undefined) => (p && p[1] && p[0] != null ? `${p[0].toLocaleString(LOCALE[lang])} · ${sailors(p[1])}` : '–');
  type Row = { key: string; rel: number; what: string; note: string | null; goal: string; value: string; s: Status };
  // the release named on its first row alone
  const row = ({ key, rel, what, note, goal, value, s }: Row, i: number, all: Row[]) => (
    <tr key={key}>
      <th scope="row"><span className="adm-pl-name">{i === 0 || all[i - 1].rel !== rel ? REL[rel] : ''}</span></th>
      <td><span className="adm-pl-name">{what}{note && <span className="adm-pl-sub">{note}</span>}</span></td>
      <td>{goal}</td>
      <td>{value}</td>
      <td style={{ color: tone(s) }}>{STATUS[s]}</td>
    </tr>
  );
  const rows: Row[] = GOALS.map((g) => {
    const p = data[g.key];
    const note = [NOTE[g.key], g.key === 'wait_hour' ? allHours : null].filter(Boolean).join(' ') || null;
    return { key: g.key, rel: g.rel, what: WHAT[g.key], note, goal: GOAL(g), value: now(g, p), s: standing(g, p) };
  });
  rows.push({ key: 'days', rel: 6, what: t('days sailed in 30 days per active sailor', 'дней в гонке за 30 дней на активного гонщика', 'días navegados en 30 días por regatista activo', 'Segeltage in 30 Tagen je aktivem Segler', 'aktif denizci başına 30 günde yarış günü', 'jours de course sur 30 jours par marin actif', 'giorni in regata su 30 per velista attivo', 'dias de regata em 30 dias por velejador ativo'),
    note: t(`The 30 days before: ${daysNow(data.days_prev)}. Whatever the period.`, `30 дней до этого: ${daysNow(data.days_prev)}. При любом периоде.`, `Los 30 días anteriores: ${daysNow(data.days_prev)}. Sea cual sea el periodo.`, `Die 30 Tage davor: ${daysNow(data.days_prev)}. Unabhängig vom Zeitraum.`, `Önceki 30 gün: ${daysNow(data.days_prev)}. Dönemden bağımsız.`, `Les 30 jours d’avant : ${daysNow(data.days_prev)}. Quelle que soit la période.`, `I 30 giorni prima: ${daysNow(data.days_prev)}. Qualunque sia il periodo.`, `Os 30 dias anteriores: ${daysNow(data.days_prev)}. Seja qual for o período.`),
    goal: t('up on the 30 before', 'больше, чем за 30 до этого', 'más que los 30 anteriores', 'mehr als die 30 davor', 'önceki 30 günden fazla', 'plus que les 30 d’avant', 'più dei 30 prima', 'mais que os 30 anteriores'), value: daysNow(data.days_now), s: days });
  rows.push({ key: 'rating-links', rel: 6, what: t('old /race/rating links ending on a 404', 'старые ссылки /race/rating, ведущие на 404', 'enlaces antiguos /race/rating que acaban en 404', 'alte /race/rating-Links, die auf 404 enden', '404’e düşen eski /race/rating bağlantıları', 'anciens liens /race/rating finissant en 404', 'vecchi link /race/rating che finiscono in 404', 'links antigos /race/rating que terminam em 404'),
    note: t('A permanent redirect to /race#board (next.config.ts), checked by the tests.', 'Постоянный редирект на /race#board (next.config.ts), проверен тестами.', 'Una redirección permanente a /race#board (next.config.ts), comprobada por los tests.', 'Eine dauerhafte Weiterleitung auf /race#board (next.config.ts), von den Tests geprüft.', '/race#board’a kalıcı yönlendirme (next.config.ts), testlerle denetlenir.', 'Une redirection permanente vers /race#board (next.config.ts), vérifiée par les tests.', 'Un reindirizzamento permanente a /race#board (next.config.ts), verificato dai test.', 'Um redirecionamento permanente para /race#board (next.config.ts), verificado pelos testes.'),
    goal: '0', value: '0', s: 'met' });
  rows.sort((a, b) => a.rel - b.rel);
  const met = rows.filter((r) => r.s === 'met').length;
  const title = t('The plan’s targets', 'Цели плана', 'Los objetivos del plan', 'Die Ziele des Plans', 'Planın hedefleri', 'Les objectifs du plan', 'Gli obiettivi del piano', 'As metas do plano');
  return (
    <section className="adm-tab adm-targets">
      <h3 className="adm-tab-h">{title}</h3>
      <p className="hint">{t(`Each release of the 1-on-1 plan with its target, over this period. ${met} met. A target with only a few races behind it says little yet.`, `Каждый выпуск плана 1 на 1 и его цель, за этот период. Выполнено: ${met}. Цель всего с несколькими гонками пока мало что значит.`, `Cada entrega del plan 1 contra 1 con su objetivo, en este periodo. ${met} cumplidos. Un objetivo con pocas regatas detrás aún dice poco.`, `Jede Stufe des 1-gegen-1-Plans mit ihrem Ziel, in diesem Zeitraum. ${met} erreicht. Ein Ziel mit wenigen Regatten sagt noch wenig.`, `Bire bir planının her sürümü ve hedefi, bu dönemde. ${met} tuttu. Arkasında az yarış olan bir hedef henüz pek bir şey söylemez.`, `Chaque version du plan des duels avec son objectif, sur cette période. ${met} atteints. Un objectif avec peu de régates derrière lui en dit encore peu.`, `Ogni rilascio del piano dei duelli con il suo obiettivo, in questo periodo. ${met} raggiunti. Un obiettivo con poche regate alle spalle dice ancora poco.`, `Cada versão do plano de duelos com sua meta, neste período. ${met} atingidas. Uma meta com poucas regatas por trás ainda diz pouco.`)}</p>
      <div className="adm-tab-scroll" tabIndex={0} role="region" aria-label={title}>
        <table>
          <thead><tr>
            <th scope="col">{t('Release', 'Выпуск', 'Entrega', 'Stufe', 'Sürüm', 'Version', 'Rilascio', 'Versão')}</th>
            <th scope="col">{t('What', 'Что', 'Qué', 'Was', 'Ne', 'Quoi', 'Cosa', 'O quê')}</th>
            <th scope="col">{t('Target', 'Цель', 'Objetivo', 'Ziel', 'Hedef', 'Objectif', 'Obiettivo', 'Meta')}</th>
            <th scope="col">{t('Now', 'Сейчас', 'Ahora', 'Jetzt', 'Şimdi', 'Maintenant', 'Ora', 'Agora')}</th>
            <th scope="col">{t('Standing', 'Итог', 'Estado', 'Stand', 'Durum', 'État', 'Stato', 'Situação')}</th>
          </tr></thead>
          <tbody>{rows.map(row)}</tbody>
        </table>
      </div>
    </section>
  );
}
