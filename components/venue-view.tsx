'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { saveOpts } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { IconPlay, IconBack, IconArrow, IconWind, IconFlag, IconPin, IconBook } from './ui';
import { LoadBar, ScenePoster } from './skeleton';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';
import { useSceneStart } from '@/lib/scene-start';

// A venue (/venues/<id>), as the yachts page shows a yacht: the game's own scene there (/venue-view), a race on its
// course sailed by the game's skippers, and a drone flying over it from one shot to the next (SHOTS) — high over the
// whole water and the land round it, down the course from behind the start, along the line and over the windward mark —
// with what the place is beside it: the facts, the guide's sections (the water and the wind,
// its regattas, how to race it), racing here, and the other venues. It tours the shots by itself, one every DWELL
// seconds once the drone is there (the first a little longer); picking one, the arrows or taking hold of the view stops
// the tour, and the play button starts it again.
const DWELL = 10;
type Pair = [en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string]; // English, Russian
const SHOTS: { id: string; name: Pair; note: Pair }[] = [
  { id: 'waters', name: ['The water', 'Акватория', 'El agua', 'Das Wasser', 'Su', 'Le plan d’eau', 'L’acqua'], note: ['From high up, all round', 'С высоты, по кругу', 'Desde lo alto, alrededor', 'Von hoch oben, rundum', 'Yukarıdan, çepeçevre', 'Vu d’en haut, tout autour', 'Dall’alto, tutto intorno'] },
  { id: 'course', name: ['The course', 'Дистанция', 'El recorrido', 'Die Bahn', 'Parkur', 'Le parcours', 'Il percorso'], note: ['From behind the start', 'Из-за линии старта', 'Desde detrás de la salida', 'Von hinter dem Start', 'Startın arkasından', 'Depuis l’arrière de la ligne de départ', 'Da dietro la partenza'] },
  { id: 'start', name: ['The start', 'Старт', 'La salida', 'Der Start', 'Start', 'Le départ', 'La partenza'], note: ['Along the line', 'Вдоль линии', 'A lo largo de la línea', 'Entlang der Linie', 'Hat boyunca', 'Le long de la ligne', 'Lungo la linea'] },
  { id: 'windward', name: ['The top mark', 'Верхний знак', 'La baliza de barlovento', 'Die Luvtonne', 'Üst şamandıra', 'La bouée au vent', 'La boa di bolina'], note: ['Down the beat', 'Вниз по лавировке', 'Bajando la ceñida', 'Das Kreuz hinunter', 'Orsa ayağından aşağı', 'En descendant le bord de près', 'Giù lungo la bolina'] },
];
type ShotId = string;

export type VenueCard = {
  id: VenueId; n: number; of: number; name: Pair; place: Pair; about: Pair; wind: Pair; nation: string;
  title: Pair; intro: Pair; sections: { h: Pair; p: Pair[] }[];
  next: string | null; today: boolean; by: string; published: [string, string]; // the date as it is written, and its ISO form
  others: { id: VenueId; name: Pair; place: Pair }[];
};

export function VenueView({ lang, v, back }: { lang: Lang; v: VenueCard; back: ReactNode }) {
  const t = tx(lang);
  const [shot, setShot] = useState<ShotId>('waters');
  const [auto, setAuto] = useState(true);
  const [live, setLive] = useState(false);
  const backdrop = useSceneStart();
  const [landed, setLanded] = useState(0); // the flights that have landed: the tour's clock restarts on each
  const [there, setThere] = useState(false); // the drone is at the shot picked, not on its way
  const frame = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null), strip = useRef<HTMLDivElement>(null);
  const now = useRef({ shot, live: false }); now.current = { shot, live };

  const post = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  // the part of the frame the words cover, so what the drone looks at stands in what is left
  const inset = useCallback(() => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), s = strip.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? (h.bottom / H) * 0.9 : head * 0.55), b: tall ? (H - c.top) / H : s ? ((H - s.top) / H) * 0.6 : 0 });
  }, [post]);
  const go = useCallback((next: ShotId) => { setShot(next); setThere(false); post({ type: 'focus', id: next }); }, [post]);
  const step = useCallback((k: number) => {
    const i = SHOTS.findIndex((x) => x.id === now.current.shot);
    go(SHOTS[(i + k + SHOTS.length) % SHOTS.length].id);
  }, [go]);
  const pick = (next: ShotId) => { setAuto(false); go(next); };

  // the scene's word: it is up (send it the frame), a flight has landed, or you took hold of the view
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'ready') { inset(); post({ type: 'focus', id: now.current.shot }); }
      if (d?.type === 'live' && !now.current.live) { setLive(true); setThere(true); setLanded((n) => n + 1); }
      if (d?.type === 'arrived') { setThere(d.id === now.current.shot); setLanded((n) => n + 1); }
      if (d?.type === 'touched') setAuto(false);
    };
    const fit = () => inset();
    addEventListener('message', on); addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    for (const el of [card.current, info.current, strip.current]) if (el) ro.observe(el);
    return () => { removeEventListener('message', on); removeEventListener('resize', fit); ro.disconnect(); };
  }, [inset, post]);
  // the tour: the next shot a while after the drone gets to this one
  const dwell = shot === 'waters' ? DWELL * 1.4 : DWELL;
  useEffect(() => {
    if (!auto || !there || !live) return;
    const k = setTimeout(() => step(1), dwell * 1000);
    return () => clearTimeout(k);
  }, [auto, there, live, landed, step, dwell]);
  // the arrows on the keyboard, as the buttons
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { setAuto(false); step(1); }
      if (e.key === 'ArrowLeft') { setAuto(false); step(-1); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [step]);

  const name = t(...v.name);
  const race = () => { saveOpts({ venue: v.id }); location.href = '/race/free'; };

  return (
    <div className="bt fl-view vn-view">
      <LoadBar label={t('Loading the water', 'Загружаем акваторию', 'Cargando el agua', 'Das Wasser wird geladen', 'Su yükleniyor', 'Chargement du plan d’eau', 'Caricamento dell’acqua')} on={!live && !backdrop.off} />
      <ScenePoster label={backdrop.off ? undefined : t('Loading the water', 'Загружаем акваторию', 'Cargando el agua', 'Das Wasser wird geladen', 'Su yükleniyor', 'Chargement du plan d’eau', 'Caricamento dell’acqua')} on={!live} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src={backdrop.go ? `/venue-view?venue=${v.id}` : undefined} title={t(`${name} from the drone`, `${name} с дрона`, `${name} desde el dron`, `${name} aus der Drohnenperspektive`, `${name} drondan`, `${name} vu du drone`, `${name} visto dal drone`)}
        onLoad={() => post({ type: 'hello' })} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand lang={lang} /></div>
        <span className="bt-kick">{t('Regatta venue', 'Регатная акватория', 'Sede de regata', 'Regattarevier', 'Regata yarış alanı', 'Plan d’eau de régate', 'Campo di regata')} <span className="fl-n">{String(v.n).padStart(2, '0')} / {String(v.of).padStart(2, '0')}</span></span>
        <h1 className="bt-h fl-h">{name}</h1>
        <p className="bt-p">{t(...v.about)}</p>

        <div className="fl-strip" ref={strip}>
          <div className="fl-ctl">
            <button type="button" className="fl-btn" onClick={() => { setAuto(false); step(-1); }} aria-label={t('Previous shot', 'Предыдущий вид', 'Plano anterior', 'Vorherige Aufnahme', 'Önceki çekim', 'Plan précédent', 'Inquadratura precedente')}><IconBack s={16} /></button>
            <button type="button" className="fl-btn" onClick={() => setAuto(!auto)} aria-pressed={auto}
              aria-label={auto ? t('Stop the drone’s tour', 'Остановить облёт', 'Parar el recorrido del dron', 'Tour der Drohne beenden', 'Dron turunu durdur', 'Arrêter la visite du drone', 'Ferma il giro del drone') : t('Tour the course', 'Облететь дистанцию', 'Recorrer el campo', 'Bahn besichtigen', 'Parkuru gez', 'Survoler le parcours', 'Fai il giro del percorso')}>
              {auto ? <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg> : <IconPlay s={14} />}
            </button>
            <button type="button" className="fl-btn" onClick={() => { setAuto(false); step(1); }} aria-label={t('Next shot', 'Следующий вид', 'Siguiente plano', 'Nächste Aufnahme', 'Sonraki çekim', 'Plan suivant', 'Inquadratura successiva')}><IconArrow s={16} /></button>
          </div>
          <div className="fl-boats vn-shots" role="radiogroup" aria-label={t('The drone’s view', 'Вид с дрона', 'La vista del dron', 'Die Sicht der Drohne', 'Dronun görüntüsü', 'La vue du drone', 'La vista del drone')}>
            {SHOTS.map((x, i) => (
              <button key={x.id} type="button" role="radio" aria-checked={x.id === shot} className="fl-boat" onClick={() => pick(x.id)}>
                <span className="fl-i">{String(i + 1).padStart(2, '0')}</span>
                <b>{t(...x.name)}</b>
                <span className="fl-m">{t(...x.note)}</span>
                {x.id === shot && auto && <i className={`fl-bar ${there && live ? 'run' : ''}`} key={landed} style={{ animationDuration: `${dwell}s` }} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PauseCard lang={lang} back={`/venues/${v.id}`} title={name} icon={<IconPin s={14} />} cardRef={card}
        tools={<Link className="bt-mini bt-all" href="/venues" aria-label={t('All venues', 'Все акватории', 'Todas las sedes', 'Alle Reviere', 'Tüm yarış alanları', 'Tous les plans d’eau', 'Tutti i campi di regata')}><IconBack s={14} /><span>{t('All venues', 'Все акватории', 'Todas las sedes', 'Alle Reviere', 'Tüm yarış alanları', 'Tous les plans d’eau', 'Tutti i campi di regata')}</span></Link>}
        action={v.today
          ? <a className="bt-go" href="/play?race=today"><IconPlay /><span>{t('Sail today’s race here', 'Пройди гонку дня здесь', 'Navega aquí la regata de hoy', 'Hier die Regatta des Tages segeln', 'Günün yarışını burada yarış', 'Courir ici la régate du jour', 'Corri qui la regata del giorno')}</span></a>
          : <button type="button" className="bt-go" onClick={race}><IconPlay /><span>{t(`Race at ${name}`, 'Гоняться здесь', `Regatea en ${name}`, `Regatta in ${name}`, `${name} yarışı`, `Régater à ${name}`, `Regata a ${name}`)}</span></button>}>
        <p className="bt-hint">{v.today
          ? t('Today’s race is sailed here: the same course and wind for everyone. Or set up a custom race here, your yacht, wind and fleet.', 'Гонка дня сегодня здесь: одна дистанция и ветер для всех. Или настрой здесь свою гонку — со своей яхтой, ветром и флотом.', 'La regata de hoy se navega aquí: el mismo recorrido y viento para todos. O prepara aquí una regata personalizada, con tu yate, viento y flota.', 'Die Regatta des Tages wird hier gesegelt: dieselbe Bahn und derselbe Wind für alle. Oder richte hier eine eigene Regatta ein, mit Yacht, Wind und Feld nach deiner Wahl.', 'Günün yarışı burada yapılır: herkes için aynı parkur ve rüzgâr. Ya da burada, yatınla, rüzgârınla ve filonla bir serbest yarış kur.', 'La régate du jour se court ici : le même parcours et le même vent pour tous. Ou prépare ici une régate libre, avec ton yacht, ton vent et ta flotte.', 'La regata del giorno si corre qui: stesso percorso e stesso vento per tutti. Oppure prepara qui una regata libera, con il tuo yacht, il tuo vento e la tua flotta.')
          : t('A custom race here: the yacht, the wind, the fleet and the course are yours to choose. Free, on a phone or a computer, with nothing to install.', 'Своя гонка здесь: яхту, ветер, флот и дистанцию выбираешь ты. Бесплатно, на телефоне или компьютере, ничего не нужно устанавливать.', 'Una regata personalizada aquí: el yate, el viento, la flota y el recorrido los eliges tú. Gratis, en móvil u ordenador, sin instalar nada.', 'Eine freie Regatta hier: Yacht, Wind, Feld und Bahn wählst du selbst. Kostenlos, auf dem Handy oder am Computer, ohne etwas zu installieren.', 'Burada serbest yarış: yat, rüzgâr, filo ve parkur senin seçimin. Ücretsiz, telefonda ya da bilgisayarda, hiçbir şey kurmadan.', 'Une régate libre ici : le yacht, le vent, la flotte et le parcours, c’est toi qui choisis. Gratuit, sur téléphone ou sur ordinateur, sans rien installer.', 'Una regata libera qui: lo yacht, il vento, la flotta e il percorso li scegli tu. Gratis, su telefono o computer, senza nulla da installare.')}</p>

        <div className="fl-stats vn-stats">
          <div><span className="bt-sk">{t('Wind in the game', 'Ветер в игре', 'El viento en el juego', 'Wind im Spiel', 'Oyunda rüzgâr', 'Le vent dans le jeu', 'Vento nel gioco')}</span><b>{t(...v.wind)}</b></div>
          <div><span className="bt-sk">{t('Sail letters', 'Буквы на парусе', 'Letras de vela', 'Segelnummern', 'Yelken harfleri', 'Lettres de voile', 'Lettere sulla vela')}</span><b>{v.nation}</b></div>
          <div className="vn-wide"><span className="bt-sk">{t('Where', 'Где', 'Dónde', 'Wo', 'Nerede', 'Où', 'Dove')}</span><b>{t(...v.place)}</b></div>
          {v.next && <div className="vn-wide"><span className="bt-sk">{v.today ? t('Race of the day here', 'Гонка дня здесь', 'Regata del día aquí', 'Die Regatta des Tages hier', 'Günün yarışı burada', 'La régate du jour ici', 'Regata del giorno qui') : t('Next race of the day here', 'Следующая гонка дня здесь', 'Próxima regata del día aquí', 'Nächste Regatta des Tages hier', 'Buradaki sıradaki günün yarışı', 'Prochaine régate du jour ici', 'Prossima regata del giorno qui')}</span><b>{v.today ? t('Today', 'Сегодня', 'Hoy', 'Heute', 'Bugün', 'Aujourd’hui', 'Oggi') : v.next}</b></div>}
        </div>

        <article className="vn-guide">
          <h2 className="vn-title" id="vn-card">{t(...v.title)}</h2>
          <p className="vn-intro">{t(...v.intro)}</p>
          <p className="gd-by">{t('By ', '', 'Por ', 'Von ', 'Yazan: ')}<span>{v.by}</span> · {t('Published ', 'Опубликовано ', 'Publicado ', 'Veröffentlicht ', 'Yayımlandı: ', 'Publié le ', 'Pubblicata il ')}<time dateTime={v.published[1]}>{v.published[0]}</time></p>
          {v.sections.map((s, k) => (
            <section key={k} className="bt-g yt-about" aria-labelledby={`vn-s${k + 1}`}>
              <h3 className="bt-k" id={`vn-s${k + 1}`}>{[<IconWind key="w" s={14} />, <IconFlag key="f" s={14} />, <IconPin key="p" s={14} />][k] ?? <IconBook s={14} />}{t(...s.h)}</h3>
              {s.p.map((p, j) => <p key={j}>{t(...p)}</p>)}
            </section>
          ))}
        </article>

        <div className="bt-g">
          <h3 className="bt-k">{t('More venues', 'Другие акватории', 'Más sedes', 'Weitere Reviere', 'Daha fazla yarış alanı', 'Plus de plans d’eau', 'Altri campi di regata')}</h3>
          <div className="bt-rows">
            {v.others.map((o) => (
              <Link key={o.id} className="bt-row" href={`/venues/${o.id}`}><IconPin s={18} /><span>{t(...o.name)}</span><span className="bt-row-m">{t(...o.place)}</span></Link>
            ))}
            <Link className="bt-row" href="/venues"><IconBook s={18} /><span>{t('Every venue', 'Все акватории', 'Todas las sedes', 'Alle Reviere', 'Tüm yarış alanları', 'Tous les plans d’eau', 'Ogni campo di regata')}</span><span className="bt-row-m">{v.of}</span></Link>
            <Link className="bt-row" href="/learn/shifts"><IconWind s={18} /><span>{t('Playing the wind shifts', 'Как играть на сдвигах', 'Jugar con las roladas', 'Mit den Winddrehern spielen', 'Rüzgâr dönüşlerini kullanmak', 'Jouer les bascules de vent', 'Giocare i salti di vento')}</span><span className="bt-row-m">{t('Guide', 'Гид', 'Guía', 'Leitfaden', 'Rehber', 'Guide', 'Guida')}</span></Link>
          </div>
        </div>
      </PauseCard>
    </div>
  );
}
