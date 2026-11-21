import Link from 'next/link';
import type { ReactNode } from 'react';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { levelName, nextLevel } from '@/lib/levels';
import { provisional, shown, stakes, signed as sgn, PROVISIONAL, START } from '@/lib/elo';
import type { MyRating } from '@/lib/duel-rating';
import type { Ready } from '@/lib/duel-seek';
import type { Call, Near } from '@/lib/duel-page';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';

// The pieces of the 1-on-1 page as it was designed (the design canvas "1-on-1 races", board "The 1-on-1 page"), drawn
// from what components/duel-finder.tsx reads: the hero's rating panel, Ready now as a table with your chance and what a
// win or a loss would do, the open calls to take, your last rated races and the 1-on-1 rating around you. All presentational.
export const RATING_HREF = '/rating#duel';

const dayOf = (at: string, lang: Lang) => new Date(at).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' });

// your 1-on-1 rating as the HUD's cells, the race pages' lower third (the HUD canvas's "/race/free" board): the rating
// and its level (or how many of the first five are done), the record, the place, and who is ready now
export function HudCells({ lang, mine, ready, near }: { lang: Lang; mine: MyRating | null | undefined; ready: number | null; near: number }) {
  const t = tx(lang), num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const prov = mine ? provisional(mine.races) : true, nx = mine && !prov ? nextLevel(mine.rating) : null;
  const cell = (k: string, b: ReactNode, v: string, href?: string) => {
    const inner = <><span className="bt-sk">{k}</span><b>{b}</b><span className="bt-sv">{v}</span></>;
    return href ? <Link key={k} href={href} className="dp-cell-a">{inner}</Link> : <div key={k}>{inner}</div>;
  };
  const rating = !mine
    ? cell(t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1'), String(START), t('Where everyone starts', 'Старт у всех', 'Donde empiezan todos', 'Hier beginnen alle', 'Herkesin başladığı yer', 'Là où tous commencent', 'Da dove partono tutti', 'Onde todos começam'))
    : cell(t('Your rating', 'Твой рейтинг', 'Tu rating', 'Deine Wertung', 'Reytingin', 'Ton classement', 'Il tuo rating', 'Seu rating'), shown(mine.rating, mine.races),
      prov ? t(`Provisional · ${mine.races} of ${PROVISIONAL}`, `Предварительный · ${mine.races} из ${PROVISIONAL}`, `Provisional · ${mine.races} de ${PROVISIONAL}`, `Vorläufig · ${mine.races} von ${PROVISIONAL}`, `Geçici · ${PROVISIONAL} yarışın ${mine.races}.`, `Provisoire · ${mine.races} sur ${PROVISIONAL}`, `Provvisorio · ${mine.races} di ${PROVISIONAL}`, `Provisório · ${mine.races} de ${PROVISIONAL}`)
        : nx ? `${levelName(mine.rating, lang)} · ${t(`${nx.to} to ${pick(nx.level.name, lang)}`, `${nx.to} до уровня «${pick(nx.level.name, lang)}»`, `${nx.to} para ${pick(nx.level.name, lang)}`, `${nx.to} bis ${pick(nx.level.name, lang)}`, `${pick(nx.level.name, lang)} için ${nx.to}`, `${nx.to} avant ${pick(nx.level.name, lang)}`, `${nx.to} a ${pick(nx.level.name, lang)}`, `${nx.to} para ${pick(nx.level.name, lang)}`)}` : levelName(mine.rating, lang),
      '/duel/rating');
  const record = cell(t('Record', 'Счёт', 'Balance', 'Bilanz', 'Skor', 'Bilan', 'Bilancio', 'Retrospecto'), mine ? `${mine.wins}–${mine.losses}` : '–',
    mine?.races ? t('rated races won · lost', 'побед · поражений', 'ganadas · perdidas', 'gewonnen · verloren', 'kazanılan · kaybedilen', 'gagnées · perdues', 'vinte · perse', 'vencidas · perdidas') : t('no rated race yet', 'рейтинговых гонок пока нет', 'aún sin regatas con rating', 'noch keine gewertete', 'henüz reytingli yarış yok', 'pas encore de régate classée', 'ancora nessuna regata valida', 'ainda sem regata valendo'));
  const place = cell(t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Posição'), mine?.place ? `#${num(mine.place)}` : '–',
    mine?.place ? t(`of ${num(mine.of)} settled`, `из ${num(mine.of)}`, `de ${num(mine.of)}`, `von ${num(mine.of)}`, `${num(mine.of)} içinde`, `sur ${num(mine.of)}`, `su ${num(mine.of)}`, `de ${num(mine.of)}`) : t('after five rated races', 'после пяти рейтинговых', 'tras cinco con rating', 'nach fünf gewerteten', 'beş reytingli yarıştan sonra', 'après cinq classées', 'dopo cinque valide', 'depois de cinco valendo'), RATING_HREF);
  // (who is ready is read for a signed-in sailor alone: a visitor's cells leave it out)
  const now = ready === null ? null : cell(t('Ready now', 'Готовы сейчас', 'Listos ahora', 'Jetzt bereit', 'Şu an hazır', 'Prêts maintenant', 'Pronti ora', 'Prontos agora'), String(ready),
    t(`${near} at your level`, `твоего уровня: ${near}`, `${near} de tu nivel`, `${near} auf deinem Niveau`, `seviyende ${near}`, `${near} de ton niveau`, `${near} del tuo livello`, `${near} do seu nível`));
  return <div className="bt-stats dp-stats-hud">{rating}{record}{place}{now}</div>;
}

export function Card({ id, title, aside, children, className = '' }: { id: string; title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`dp-card ${className}`} aria-labelledby={id}>
      <div className="dp-ch"><h2 id={id} className="dp-h2">{title}</h2>{aside}</div>
      {children}
    </section>
  );
}

// Ready now: who else is looking, nearest your rating first, with your chance and what a win or a loss would do
export function ReadyTable({ lang, list, mine, filter, setFilter, challenge, hour }: { lang: Lang; list: Ready[]; mine: MyRating | null | undefined; filter: 'level' | 'all'; setFilter: (f: 'level' | 'all') => void; challenge: (h: string) => void; hour: boolean }) {
  const t = tx(lang);
  const me = mine ? { rating: mine.rating, races: mine.races } : { rating: START, races: 0 };
  const near = list.filter((r) => Math.abs(r.rating - me.rating) <= 100);
  const rows = filter === 'level' ? near : list;
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const chips = (
    <div className="dp-chips" role="group" aria-label={t('Show', 'Показать', 'Mostrar', 'Zeigen', 'Göster', 'Afficher', 'Mostra', 'Mostrar')}>
      <button type="button" className={filter === 'level' ? 'on' : ''} aria-pressed={filter === 'level'} onClick={() => setFilter('level')}>{t(`My level · ${near.length}`, `Мой уровень · ${near.length}`, `Mi nivel · ${near.length}`, `Mein Niveau · ${near.length}`, `Seviyem · ${near.length}`, `Mon niveau · ${near.length}`, `Il mio livello · ${near.length}`, `Meu nível · ${near.length}`)}</button>
      <button type="button" className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t(`Everyone · ${list.length}`, `Все · ${list.length}`, `Todos · ${list.length}`, `Alle · ${list.length}`, `Herkes · ${list.length}`, `Tout le monde · ${list.length}`, `Tutti · ${list.length}`, `Todos · ${list.length}`)}</button>
    </div>
  );
  const title = <><span className="dp-dot" aria-hidden="true" />{t(`Ready now · ${list.length}`, `Готовы сейчас · ${list.length}`, `Listos ahora · ${list.length}`, `Jetzt bereit · ${list.length}`, `Şu an hazır · ${list.length}`, `Prêts maintenant · ${list.length}`, `Pronti ora · ${list.length}`, `Prontos agora · ${list.length}`)}{hour && <span className="dp-tag dp-tag-live">{t('Duel hour', 'Час дуэлей', 'Hora de duelos', 'Duell-Stunde', 'Düello saati', 'Heure des duels', 'Ora dei duelli', 'Hora dos duelos')}</span>}</>;
  return (
    <Card id="dp-ready" title={title} aside={list.length ? chips : null} className="dp-ready">
      {rows.length ? (
        <div className="dp-tab" role="table" aria-labelledby="dp-ready">
          <div className="dp-tr dp-th" role="row">
            {[t('Sailor', 'Гонщик', 'Regatista', 'Segler', 'Denizci', 'Marin', 'Velista', 'Velejador'), t('Level', 'Уровень', 'Nivel', 'Niveau', 'Seviye', 'Niveau', 'Livello', 'Nível'), t('Rating', 'Рейтинг', 'Rating', 'Wertung', 'Reyting', 'Classement', 'Rating', 'Rating'), t('Your chance', 'Твой шанс', 'Tu probabilidad', 'Deine Chance', 'Şansın', 'Ta chance', 'La tua probabilità', 'Sua chance'), t('Win / lose', 'Победа / поражение', 'Ganar / perder', 'Sieg / Niederlage', 'Galibiyet / yenilgi', 'Victoire / défaite', 'Vittoria / sconfitta', 'Vitória / derrota'), ''].map((h, i) => <span key={i} role="columnheader" className="lbl">{h}</span>)}
          </div>
          {rows.map((r) => {
            const st = stakes(me.rating, r.rating, me.races), ch = Math.round(st.chance * 100);
            return (
              <div key={r.handle} className="dp-tr" role="row">
                <span role="cell" className="dp-who"><b>{r.name || anyone}</b>{r.away
                  ? <span className="dp-tag">{t('away · gets a message', 'не на странице · получит сообщение', 'fuera · recibe un mensaje', 'weg · bekommt eine Nachricht', 'uzakta · mesaj alır', 'absent · reçoit un message', 'via · riceve un messaggio', 'fora · recebe uma mensagem')}</span>
                  : <span className="dp-sub">{t(`waiting ${mmss(r.waited)}`, `ждёт ${mmss(r.waited)}`, `esperando ${mmss(r.waited)}`, `wartet ${mmss(r.waited)}`, `${mmss(r.waited)} bekliyor`, `attend ${mmss(r.waited)}`, `aspetta ${mmss(r.waited)}`, `esperando ${mmss(r.waited)}`)}</span>}</span>
                <span role="cell" className="dp-lvc">{provisional(r.races) ? t('New', 'Новичок', 'Nuevo', 'Neu', 'Yeni', 'Nouveau', 'Nuovo', 'Novo') : levelName(r.rating, lang)}</span>
                <b role="cell">{shown(r.rating, r.races)}</b>
                <span role="cell" className="dp-ch"><b>{ch}%</b><span className="dp-track" aria-hidden="true"><i style={{ width: `${ch}%` }} /></span></span>
                <span role="cell"><span className="dp-up">{sgn(st.win)}</span> / <span className="dp-down">{sgn(-st.loss)}</span></span>
                <span role="cell"><button type="button" className="dp-btn dp-btn-s df-race" onClick={() => challenge(r.handle)} aria-label={t(`Race ${r.name || 'this sailor'}`, `Гонка с ${r.name || 'этим соперником'}`, `Regatear con ${r.name || 'este regatista'}`, `Gegen ${r.name || 'diesen Segler'} segeln`, `${r.name || 'Bu denizci'} ile yarış`, `Régater contre ${r.name || 'ce marin'}`, `Sfida ${r.name || 'questo velista'}`, `Correr contra ${r.name || 'este velejador'}`)}>{t('Race', 'Гонка', 'Regatear', 'Segeln', 'Yarış', 'Régater', 'Sfida', 'Correr')}</button></span>
              </div>
            );
          })}
        </div>
      ) : list.length ? (
        <p className="dp-empty">{t('Nobody within 100 of you is looking right now. Everyone looking is one tap away.', 'Сейчас никто в пределах 100 от тебя не ищет. Все, кто ищет, — в одном касании.', 'Ahora nadie a 100 o menos de ti está buscando. Todos los que buscan están a un toque.', 'Gerade sucht niemand bis 100 um dich. Alle Suchenden sind einen Tipp entfernt.', 'Şu an sana 100 yakın arayan yok. Arayan herkes bir dokunuş uzakta.', 'Personne à 100 de toi ne cherche pour l’instant. Tous ceux qui cherchent sont à un geste.', 'Ora nessuno entro 100 da te sta cercando. Tutti quelli che cercano sono a un tocco.', 'Ninguém até 100 de você está procurando agora. Todos que procuram estão a um toque.')}</p>
      ) : (
        <p className="dp-empty">{t('Nobody else is looking right now. Find a race, and you’re the first one the next sailor sees.', 'Сейчас больше никто не ищет. Начни поиск — и следующий соперник увидит тебя первым.', 'Ahora nadie más está buscando. Busca una regata y serás lo primero que vea el próximo regatista.', 'Gerade sucht sonst niemand. Starte die Suche, dann sieht dich der nächste Segler zuerst.', 'Şu an başka arayan yok. Yarış ara; sıradaki denizci ilk seni görür.', 'Personne d’autre ne cherche pour l’instant. Lance la recherche : le prochain marin te verra en premier.', 'Ora nessun altro sta cercando. Cerca una regata e sarai il primo che vedrà il prossimo velista.', 'Ninguém mais está procurando agora. Procure uma regata e você será o primeiro que o próximo velejador vê.')}</p>
      )}
    </Card>
  );
}

// the open calls a sailor could take: who, the race, the band and how long ago; Take it when their rating is in the band
export function OpenCalls({ lang, calls, take, post, canPost }: { lang: Lang; calls: Call[]; take: (code: string) => void; post: () => void; canPost: boolean }) {
  const t = tx(lang);
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const ago = (s: number) => { const m = Math.max(1, Math.round(s / 60)); return t(`${m} min ago`, `${m} мин назад`, `hace ${m} min`, `vor ${m} Min.`, `${m} dk önce`, `il y a ${m} min`, `${m} min fa`, `há ${m} min`); };
  const post_ = canPost ? <button type="button" className="dp-link" onClick={post}>{t('Post yours', 'Свой вызов', 'Publica el tuyo', 'Eigene stellen', 'Seninkini yap', 'Lancer le tien', 'Lancia la tua', 'Publicar o seu')}</button> : null;
  return (
    <Card id="dp-calls" className="dp-calls" title={t(`Open calls · ${calls.length}`, `Открытые вызовы · ${calls.length}`, `Retos abiertos · ${calls.length}`, `Offene Herausforderungen · ${calls.length}`, `Açık çağrılar · ${calls.length}`, `Appels ouverts · ${calls.length}`, `Sfide aperte · ${calls.length}`, `Desafios abertos · ${calls.length}`)} aside={post_}>
      {calls.length ? calls.map((c) => {
        const where = [pick(VENUES.find((v) => v.id === c.venue)?.name, lang), pick(YACHTS.find((y) => y.id === c.yacht)?.name, lang)].filter(Boolean).join(' · ');
        const band = t(`rated, ${c.lo}–${c.hi}`, `рейтинговая, ${c.lo}–${c.hi}`, `con rating, ${c.lo}–${c.hi}`, `gewertet, ${c.lo}–${c.hi}`, `reytingli, ${c.lo}–${c.hi}`, `classée, ${c.lo}–${c.hi}`, `valida, ${c.lo}–${c.hi}`, `vale rating, ${c.lo}–${c.hi}`);
        return (
          <div key={c.code} className="dp-row">
            <span className="dp-rl"><b>{c.name || anyone} · {shown(c.rating, c.races)}</b><span className="dp-sub">{[where, t('~4 min', '~4 мин', '~4 min', '~4 Min.', '~4 dk', '~4 min', '~4 min', '~4 min'), band].filter(Boolean).join(' · ')}</span></span>
            <span className="dp-rr">
              {c.mine ? <span className="dp-tag">{t('Your call', 'Твой вызов', 'Tu reto', 'Deine', 'Senin çağrın', 'Ton appel', 'La tua sfida', 'Seu desafio')}</span>
                : c.inBand ? <button type="button" className="dp-btn dp-btn-s dp-btn-q" onClick={() => take(c.code)}>{t('Take it', 'Принять', 'Aceptar', 'Annehmen', 'Kabul et', 'Le prendre', 'Accetta', 'Aceitar')}</button>
                : <span className="dp-sub">{t('outside your range', 'вне твоего диапазона', 'fuera de tu rango', 'außerhalb deines Bereichs', 'aralığın dışında', 'hors de ta fourchette', 'fuori dal tuo intervallo', 'fora da sua faixa')}</span>}
              <span className="lbl">{ago(c.ago)}</span>
            </span>
          </div>
        );
      }) : <p className="dp-empty">{t('No open calls right now. While you look, post one: a link for any chat, and the first sailor near your rating to take it races you.', 'Сейчас открытых вызовов нет. Пока ищешь, сделай свой: ссылка для любого чата, и первый соперник твоего уровня, кто её примет, гоняется с тобой.', 'Ahora no hay retos abiertos. Mientras buscas, publica uno: un enlace para cualquier chat, y el primer regatista de tu nivel que lo acepte regatea contigo.', 'Gerade gibt es keine offenen Herausforderungen. Während du suchst, stell eine: ein Link für jeden Chat, und der erste Segler auf deinem Niveau, der annimmt, segelt gegen dich.', 'Şu an açık çağrı yok. Ararken bir tane yap: her sohbet için bir bağlantı; seviyendeki ilk kabul eden seninle yarışır.', 'Aucun appel ouvert pour l’instant. Pendant ta recherche, lances-en un : un lien pour n’importe quel chat, et le premier marin de ton niveau qui le prend court contre toi.', 'Nessuna sfida aperta ora. Mentre cerchi, lanciane una: un link per qualsiasi chat, e il primo velista del tuo livello che la prende sfida te.', 'Nenhum desafio aberto agora. Enquanto procura, publique um: um link para qualquer conversa, e o primeiro velejador do seu nível que aceitar corre com você.')}</p>}
    </Card>
  );
}

// your last rated races (the latest five), else your last 1-on-1s just for fun
export function LastRaces({ lang, mine }: { lang: Lang; mine: MyRating | null | undefined }) {
  const t = tx(lang);
  const all = <Link className="dp-link" href="/players?me=1">{t('All', 'Все', 'Todas', 'Alle', 'Tümü', 'Toutes', 'Tutte', 'Todas')} →</Link>;
  const won = t('won', 'победа', 'ganada', 'gewonnen', 'kazandın', 'gagnée', 'vinta', 'vitória'), lost = t('lost', 'поражение', 'perdida', 'verloren', 'kaybettin', 'perdue', 'persa', 'derrota');
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const rated = mine?.changes.slice(0, 5) ?? [];
  const fun = rated.length ? [] : (mine?.recent ?? []).filter((r) => r.state === 'finished').slice(0, 5);
  return (
    <Card id="dp-last" className="dp-last" title={t('Your last races', 'Твои последние гонки', 'Tus últimas regatas', 'Deine letzten Regatten', 'Son yarışların', 'Tes dernières régates', 'Le tue ultime regate', 'Suas últimas regatas')} aside={mine ? all : null}>
      {rated.map((c, i) => (
        <div key={i} className="dp-row dp-row-wl">
          <span className={`dp-wl ${c.won ? 'dp-w' : 'dp-l'}`} aria-hidden="true">{c.won ? t('W', 'В', 'G', 'S', 'G', 'V', 'V', 'V') : t('L', 'П', 'P', 'N', 'M', 'D', 'S', 'D')}</span>
          <span className="dp-rl"><b>{c.them || anyone} · {c.them_before}</b><span className="lbl">{dayOf(c.at, lang)} · {c.won ? won : lost} · {c.after}</span></span>
          <b className={c.delta >= 0 ? 'dp-up' : 'dp-down'}>{sgn(c.delta)}</b>
        </div>
      ))}
      {fun.map((r, i) => (
        <div key={i} className="dp-row dp-row-wl">
          <span className={`dp-wl ${r.won ? 'dp-w' : 'dp-l'}`} aria-hidden="true">{r.won ? t('W', 'В', 'G', 'S', 'G', 'V', 'V', 'V') : t('L', 'П', 'P', 'N', 'M', 'D', 'S', 'D')}</span>
          <span className="dp-rl"><b>{r.them || anyone}</b><span className="lbl">{dayOf(r.at, lang)} · {r.won ? won : lost} · {t('not rated', 'без рейтинга', 'sin rating', 'ungewertet', 'reytingsiz', 'non classée', 'non valida', 'sem rating')}</span></span>
          <span />
        </div>
      ))}
      {!rated.length && !fun.length && <p className="dp-empty">{mine === null
        ? t('Sign in, and your 1-on-1 races and what each did to your rating are kept here.', 'Войди — и здесь будут твои гонки 1 на 1 и как каждая изменила рейтинг.', 'Inicia sesión y aquí se guardarán tus regatas 1 contra 1 y lo que cada una hizo a tu rating.', 'Melde dich an, dann stehen hier deine 1-gegen-1-Regatten und was jede an deiner Wertung geändert hat.', 'Giriş yap; bire bir yarışların ve her birinin reytingine etkisi burada tutulur.', 'Connecte-toi : tes duels et ce que chacun a fait à ton classement seront gardés ici.', 'Accedi e qui troverai le tue regate 1 contro 1 e come ognuna ha mosso il rating.', 'Entre, e seus duelos e o que cada um fez no seu rating ficam aqui.')
        : t('No 1-on-1 races yet. Your first five find your level.', 'Гонок 1 на 1 пока нет. Первые пять найдут твой уровень.', 'Aún no hay regatas 1 contra 1. Las cinco primeras encuentran tu nivel.', 'Noch keine 1-gegen-1-Regatten. Die ersten fünf finden dein Niveau.', 'Henüz bire bir yarış yok. İlk beşi seviyeni bulur.', 'Pas encore de duel. Les cinq premiers trouvent ton niveau.', 'Ancora nessuna regata 1 contro 1. Le prime cinque trovano il tuo livello.', 'Ainda nenhum duelo. Os cinco primeiros acham seu nível.')}</p>}
    </Card>
  );
}

// the 1-on-1 rating around you: three places above to three below (the top seven while you aren't settled)
export function NearTable({ lang, near }: { lang: Lang; near: Near | null | undefined }) {
  const t = tx(lang), num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const settled = !!near?.place;
  const title = settled
    ? t('The 1-on-1 rating, around you', 'Рейтинг 1 на 1 вокруг тебя', 'El rating 1 contra 1, a tu alrededor', 'Die 1-gegen-1-Wertung um dich herum', 'Bire bir reyting, çevrende', 'Le classement en duel, autour de toi', 'Il rating 1 contro 1, intorno a te', 'O rating 1 contra 1, ao seu redor')
    : t('The top of the 1-on-1 rating', 'Верх рейтинга 1 на 1', 'Lo más alto del rating 1 contra 1', 'Die Spitze der 1-gegen-1-Wertung', 'Bire bir reytingin zirvesi', 'Le haut du classement en duel', 'Il vertice del rating 1 contro 1', 'O topo do rating 1 contra 1');
  const all = <Link className="dp-link" href={RATING_HREF}>{t('The whole rating', 'Весь рейтинг', 'El rating completo', 'Die ganze Wertung', 'Tüm reyting', 'Tout le classement', 'Tutto il rating', 'O rating completo')} →</Link>;
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  return (
    <Card id="dp-near" className="dp-near" title={title} aside={all}>
      {near?.rows.length ? (
        <div className="dp-tab" role="table" aria-labelledby="dp-near">
          <div className="dp-tr dp-th" role="row">{[t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Posição'), t('Sailor', 'Гонщик', 'Regatista', 'Segler', 'Denizci', 'Marin', 'Velista', 'Velejador'), t('Level', 'Уровень', 'Nivel', 'Niveau', 'Seviye', 'Niveau', 'Livello', 'Nível'), t('Record', 'Счёт', 'Balance', 'Bilanz', 'Skor', 'Bilan', 'Bilancio', 'Retrospecto'), t('Rating', 'Рейтинг', 'Rating', 'Wertung', 'Reyting', 'Classement', 'Rating', 'Rating')].map((h) => <span key={h} role="columnheader" className="lbl">{h}</span>)}</div>
          {near.rows.map((r) => (
            <div key={`${r.place}-${r.name}-${r.rating}`} className={`dp-tr${r.me ? ' dp-me' : ''}`} role="row">
              <b role="cell">#{num(r.place)}</b>
              <b role="cell" className="dp-who">{r.me ? t('You', 'Ты', 'Tú', 'Du', 'Sen', 'Toi', 'Tu', 'Você') : r.name || anyone}</b>
              <span role="cell" className="dp-lvc">{levelName(r.rating, lang)}</span>
              <span role="cell">{r.wins}–{r.losses}</span>
              <b role="cell">{r.rating}</b>
            </div>
          ))}
        </div>
      ) : null}
      {!settled && <p className="dp-empty">{near?.rows.length
        ? t(`Places are for settled ratings, five rated races or more: ${num(near.of)} so far. Yours joins them after your fifth.`, `Места — для устоявшихся рейтингов, от пяти рейтинговых гонок: пока их ${num(near.of)}. Твой появится после пятой.`, `Los puestos son para ratings asentados, cinco regatas con rating o más: ${num(near.of)} por ahora. El tuyo entra tras la quinta.`, `Plätze gibt es für feste Wertungen ab fünf gewerteten Regatten: bisher ${num(near.of)}. Deine kommt nach der fünften dazu.`, `Sıralar oturmuş reytingler içindir, beş reytingli yarış ve üstü: şimdilik ${num(near.of)}. Seninki beşinciden sonra katılır.`, `Les places sont pour les classements établis, cinq régates classées ou plus : ${num(near.of)} pour l’instant. Le tien les rejoint après ta cinquième.`, `Le posizioni sono per i rating stabili, cinque regate valide o più: finora ${num(near.of)}. Il tuo arriva dopo la quinta.`, `As posições são para ratings firmes, cinco regatas valendo rating ou mais: ${num(near.of)} até agora. O seu entra depois da quinta.`)
        : t('Nobody has five rated races yet, so there are no places so far. The first to five leads.', 'Пока ни у кого нет пяти рейтинговых гонок, так что мест ещё нет. Первый, кто наберёт пять, возглавит.', 'Aún nadie tiene cinco regatas con rating, así que no hay puestos. El primero en llegar a cinco lidera.', 'Noch hat niemand fünf gewertete Regatten, also gibt es noch keine Plätze. Wer zuerst fünf hat, führt.', 'Henüz kimsenin beş reytingli yarışı yok, bu yüzden sıra yok. Beşe ilk ulaşan lider olur.', 'Personne n’a encore cinq régates classées, donc pas encore de places. Le premier à cinq mène.', 'Nessuno ha ancora cinque regate valide, quindi non ci sono posizioni. Il primo a cinque guida.', 'Ninguém tem cinco regatas valendo rating ainda, então não há posições. O primeiro a chegar a cinco lidera.')}</p>}
    </Card>
  );
}
