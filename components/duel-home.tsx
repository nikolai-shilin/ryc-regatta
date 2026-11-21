'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALE, tx, type Lang } from '@/lib/lang';
import { levelName, nextLevel } from '@/lib/levels';
import { provisional, shown, stakes, signed as sgn, START } from '@/lib/elo';
import { parseMine, type MyRating } from '@/lib/duel-rating';
import { parseReady, type Ready } from '@/lib/duel-seek';
import { useWho } from './me';
import { IconPlay } from './ui';
import '@/styles/duel-rating.css';

// The 1-on-1 block on the home of a sailor who has raced before (<html data-back>, components/home-back.tsx) and is signed
// in: how many are ready now, Find a race (/duel), a friend's link (/match/new), your rating strip (the rating and level,
// the last rated race, the way to the next level, the record and place: GET /connect/rating/me) and the three sailors
// looking nearest your rating, each with your chance and stakes and Race, which opens /duel challenging them (?challenge).
// Read again every 15 s while the tab is shown. Nothing for a newcomer or a guest: the home leads them to a first race.
const LIST_MS = 15000, SHOW = 3;

export function DuelHome({ lang }: { lang: Lang }) {
  const who = useWho(lang);
  const [back, setBack] = useState(false);
  const [mine, setMine] = useState<MyRating | null>(null);
  const [list, setList] = useState<Ready[] | null>(null);
  useEffect(() => { setBack(document.documentElement.hasAttribute('data-back')); }, []);
  const on = back && !!who;
  useEffect(() => {
    if (!on) return;
    let live = true;
    fetch('/connect/rating/me', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setMine(parseMine(j)); }, () => {});
    const read = () => fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ do: 'ready_now' }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setList(parseReady(j?.list)); }, () => { if (live) setList((l) => l ?? []); });
    read();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') read(); }, LIST_MS);
    return () => { live = false; clearInterval(t); };
  }, [on]);
  return on ? <DuelHomeView lang={lang} mine={mine} list={list ?? []} /> : null;
}

export function DuelHomeView({ lang, mine, list }: { lang: Lang; mine: MyRating | null; list: Ready[] }) {
  const t = tx(lang), num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const rating = mine?.rating ?? START, races = mine?.races ?? 0, prov = provisional(races), next = prov ? null : nextLevel(rating);
  const last = mine?.changes[0], n = list.length;
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  return (
    <section className="ho-sec dh" aria-labelledby="h-duel">
      <div className="dh-main">
        <span className="ho-k">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')}{n ? t(` · ${n} ready now`, ` · готовы сейчас: ${n}`, ` · ${n} listos ahora`, ` · ${n} jetzt bereit`, ` · şu an ${n} hazır`, ` · ${n} prêts maintenant`, ` · ${n} pronti ora`, ` · ${n} prontos agora`) : ''}</span>
        <h2 className="ho-h2" id="h-duel">{t('Race someone your level', 'Гонка с соперником твоего уровня', 'Regatea con alguien de tu nivel', 'Segle gegen jemanden auf deinem Niveau', 'Seviyendeki biriyle yarış', 'Affronte quelqu’un de ton niveau', 'Sfida qualcuno del tuo livello', 'Corra contra alguém do seu nível')}</h2>
        <p className="ho-ps">{t('One other sailor, live, on the same course. Win and your rating goes up; the less likely the win, the more it’s worth.', 'Один соперник, вживую, на той же дистанции. Победа поднимает рейтинг; чем менее вероятна победа, тем больше она стоит.', 'Otro regatista, en directo, en el mismo recorrido. Si ganas, tu rating sube; cuanto menos probable la victoria, más vale.', 'Ein anderer Segler, live, auf derselben Bahn. Gewinnst du, steigt deine Wertung; je unwahrscheinlicher der Sieg, desto mehr ist er wert.', 'Bir başka denizci, canlı, aynı parkurda. Kazanırsan reytingin yükselir; galibiyet ne kadar zorsa o kadar değerli.', 'Un autre marin, en direct, sur le même parcours. Gagne et ton classement monte ; moins la victoire est probable, plus elle vaut.', 'Un altro velista, dal vivo, sullo stesso percorso. Se vinci il tuo rating sale; meno è probabile la vittoria, più vale.', 'Outro velejador, ao vivo, no mesmo percurso. Vença e seu rating sobe; quanto menos provável a vitória, mais ela vale.')}</p>
        <div className="ho-acts">
          <Link className="ho-go" href="/duel" data-cta="duel-find"><IconPlay s={18} /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</span></Link>
          <Link className="ho-ghost" href="/match/new" data-cta="duel-friend">{t('Challenge a friend', 'Позвать друга', 'Reta a un amigo', 'Einen Freund herausfordern', 'Bir arkadaşını çağır', 'Défier un ami', 'Sfida un amico', 'Desafiar um amigo')}</Link>
        </div>
        <dl className="dh-strip">
          <div><dt>{t('Your rating', 'Твой рейтинг', 'Tu rating', 'Deine Wertung', 'Reytingin', 'Ton classement', 'Il tuo rating', 'Seu rating')}</dt><dd><b>{shown(rating, races)}</b><span className="df-lv">{prov ? t('New', 'Новичок', 'Nuevo', 'Neu', 'Yeni', 'Nouveau', 'Nuovo', 'Novo') : levelName(rating, lang)}</span></dd></div>
          {last ? (
            <div><dt>{t('Last rated race', 'Последняя гонка', 'Última regata', 'Letzte Wertung', 'Son yarış', 'Dernière régate', 'Ultima regata', 'Última regata')}</dt><dd><b className={last.delta >= 0 ? 'up' : 'down'}>{sgn(last.delta)}</b><span className="dh-s">{last.won
              ? t(`beat ${last.them || anyone}`, `победа над ${last.them || 'соперником'}`, `ganó a ${last.them || anyone}`, `gegen ${last.them || anyone} gewonnen`, `${last.them || anyone} yenildi`, `victoire sur ${last.them || anyone}`, `vinto contro ${last.them || anyone}`, `venceu ${last.them || anyone}`)
              : t(`lost to ${last.them || anyone}`, `поражение от ${last.them || 'соперника'}`, `perdió con ${last.them || anyone}`, `gegen ${last.them || anyone} verloren`, `${last.them || anyone} kazandı`, `défaite contre ${last.them || anyone}`, `perso contro ${last.them || anyone}`, `perdeu para ${last.them || anyone}`)}</span></dd></div>
          ) : null}
          {next ? <div><dt>{t(`To ${levelName(next.level.min, 'en')}`, `До уровня «${levelName(next.level.min, 'ru')}»`, `Para ${levelName(next.level.min, 'es')}`, `Bis ${levelName(next.level.min, 'de')}`, `${levelName(next.level.min, 'tr')} için`, `Vers ${levelName(next.level.min, 'fr')}`, `Per ${levelName(next.level.min, 'it')}`, `Para ${levelName(next.level.min, 'pt')}`)}</dt><dd><b>{next.to}</b></dd></div> : null}
          {races ? (
            <div><dt>{t('Record · place', 'Счёт · место', 'Balance · puesto', 'Bilanz · Platz', 'Kayıt · sıra', 'Bilan · place', 'Bilancio · posizione', 'Retrospecto · colocação')}</dt><dd><b>{num(mine?.wins ?? 0)}–{num(mine?.losses ?? 0)}</b>{mine?.place ? <span className="dh-s">{t(`#${num(mine.place)} of ${num(mine.of)}`, `${num(mine.place)}-е из ${num(mine.of)}`, `n.º ${num(mine.place)} de ${num(mine.of)}`, `Nr. ${num(mine.place)} von ${num(mine.of)}`, `${num(mine.of)} içinde ${num(mine.place)}.`, `${num(mine.place)}e sur ${num(mine.of)}`, `${num(mine.place)}° su ${num(mine.of)}`, `${num(mine.place)}º de ${num(mine.of)}`)}</span> : null}</dd></div>
          ) : (
            <div className="dh-wide"><dt>{t('Not rated yet', 'Пока без рейтинга', 'Aún sin rating', 'Noch keine Wertung', 'Henüz reyting yok', 'Pas encore classé', 'Ancora senza rating', 'Ainda sem rating')}</dt><dd><span className="dh-s">{t(`Everyone starts at ${START}; your first five races find your level.`, `У всех старт с ${START}; первые пять гонок найдут твой уровень.`, `Todos empiezan en ${START}; tus cinco primeras regatas encuentran tu nivel.`, `Alle beginnen bei ${START}; deine ersten fünf Regatten finden dein Niveau.`, `Herkes ${START} ile başlar; ilk beş yarışın seviyeni bulur.`, `Tout le monde part de ${START} ; tes cinq premières régates trouvent ton niveau.`, `Tutti partono da ${START}; le prime cinque regate trovano il tuo livello.`, `Todos começam em ${START}; suas cinco primeiras regatas acham seu nível.`)}</span></dd></div>
          )}
        </dl>
      </div>
      <aside className="ho-card dh-now" aria-label={t('Ready now', 'Готовы сейчас', 'Listos ahora', 'Jetzt bereit', 'Şu an hazır', 'Prêts maintenant', 'Pronti ora', 'Prontos agora')}>
        <div className="ho-card-h"><span className="lbl-ink">{t('Ready now', 'Готовы сейчас', 'Listos ahora', 'Jetzt bereit', 'Şu an hazır', 'Prêts maintenant', 'Pronti ora', 'Prontos agora')}</span><span className="lbl">{t('Nearest your rating', 'Ближе всего к тебе', 'Más cerca de tu rating', 'Nah an deiner Wertung', 'Reytingine en yakın', 'Les plus proches de toi', 'I più vicini a te', 'Mais perto do seu rating')}</span></div>
        {n ? (
          <ul className="df-list">{list.slice(0, SHOW).map((r) => {
            const st = stakes(rating, r.rating, races);
            return (
              <li key={r.handle} className="df-row">
                <span className="df-who"><b className="df-n">{r.name || anyone}</b><span className="df-meta">
                  <span className="df-lv">{provisional(r.races) ? t('New', 'Новичок', 'Nuevo', 'Neu', 'Yeni', 'Nouveau', 'Nuovo', 'Novo') : levelName(r.rating, lang)}</span>
                  <span className="iv-r">{shown(r.rating, r.races)}</span>
                  <span className="iv-m">{t(`chance ${Math.round(st.chance * 100)}%`, `шанс ${Math.round(st.chance * 100)}%`, `prob. ${Math.round(st.chance * 100)}%`, `Chance ${Math.round(st.chance * 100)} %`, `şans %${Math.round(st.chance * 100)}`, `chance ${Math.round(st.chance * 100)} %`, `prob. ${Math.round(st.chance * 100)}%`, `chance ${Math.round(st.chance * 100)}%`)}</span>
                  <span className="dh-st"><b className="up">{sgn(st.win)}</b> <b className="down">{sgn(-st.loss)}</b></span>
                </span></span>
                <Link className="bt-show df-race" href={`/duel?challenge=${r.handle}`} data-cta="duel-race">{t('Race', 'Гонка', 'Regatear', 'Segeln', 'Yarış', 'Régater', 'Sfida', 'Correr')}</Link>
              </li>
            );
          })}</ul>
        ) : <p className="iv-note">{t('Nobody is looking right now. Find a race, and you’re the first one the next sailor sees.', 'Сейчас никто не ищет. Начни поиск — и следующий соперник увидит тебя первым.', 'Ahora nadie está buscando. Busca una regata y serás lo primero que vea el próximo regatista.', 'Gerade sucht niemand. Starte die Suche, dann sieht dich der nächste Segler zuerst.', 'Şu an arayan yok. Yarış ara; sıradaki denizci ilk seni görür.', 'Personne ne cherche pour l’instant. Lance la recherche : le prochain marin te verra en premier.', 'Ora nessuno sta cercando. Cerca una regata e sarai il primo che vedrà il prossimo velista.', 'Ninguém está procurando agora. Procure uma regata e você será o primeiro que o próximo velejador vê.')}</p>}
        <Link className="lb-more" href="/duel">{n > SHOW
          ? t(`All ${n} on the 1-on-1 page`, `Все ${n} на странице 1 на 1`, `Los ${n} en la página 1 contra 1`, `Alle ${n} auf der 1-gegen-1-Seite`, `${n} kişinin hepsi bire bir sayfasında`, `Les ${n} sur la page duel`, `Tutti i ${n} nella pagina 1 contro 1`, `Todos os ${n} na página 1 contra 1`)
          : t('The 1-on-1 page', 'Страница 1 на 1', 'La página 1 contra 1', 'Die 1-gegen-1-Seite', 'Bire bir sayfası', 'La page duel', 'La pagina 1 contro 1', 'A página 1 contra 1')}</Link>
      </aside>
    </section>
  );
}
