'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';

// How was the race? Asked on the result page of your own race, just sailed (a day at most), once: one to five, then a
// line on what to make better if you like. Posted to the scores server (api/game.mjs in the iyt-test repo, ev 'rate'),
// which keeps it on the race's row for the site's /admin; it names no one (the race's id is the only link). A copy of
// the game run locally (npm run dev) posts nothing, as the game's stats.js.
const API = 'https://iyt.rycrentals.com/api/game';
const local = () => /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(location.hostname) && !/[?&]scores\b/.test(location.search);
const post = (body: object) => {
  if (local()) return;
  try { fetch(API, { method: 'POST', keepalive: true, body: JSON.stringify(body) }).catch(() => {}); } catch {}
};

export function RateRace({ id, lang }: { id: string; lang: Lang }) {
  const t = tx(lang);
  const key = 'regatta-rated-' + id;
  const [stage, setStage] = useState<'ask' | 'more' | 'done' | 'hidden'>('hidden');
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  useEffect(() => { try { setStage(localStorage.getItem(key) ? 'hidden' : 'ask'); } catch { setStage('ask'); } }, [key]);
  if (stage === 'hidden') return null;
  const rate = (n: number) => {
    setStars(n); setStage('more');
    post({ ev: 'rate', id, rating: n });
    try { localStorage.setItem(key, String(n)); } catch {}
  };
  const send = () => {
    const c = text.trim();
    if (c) post({ ev: 'rate', id, comment: c.slice(0, 500) });
    setStage('done');
  };
  const words = [t('Bad', 'Плохо', 'Mala', 'Schlecht', 'Kötü', 'Mauvaise'), t('Not great', 'Так себе', 'Floja', 'Nicht toll', 'Pek iyi değil', 'Bof'), t('OK', 'Нормально', 'Normal', 'OK', 'İdare eder', 'Correcte'), t('Good', 'Хорошо', 'Buena', 'Gut', 'İyi', 'Bonne'), t('Loved it', 'Отлично', 'Me encantó', 'Super', 'Bayıldım', 'J’ai adoré')];
  return (
    <section className="rr" aria-label={t('Rate the race', 'Оценка гонки', 'Valora la regata', 'Bewerte die Regatta', 'Yarışı puanla', 'Noter la régate')}>
      {stage === 'done' ? (
        <p className="rr-thanks">{t('Thank you — it helps us make the game better.', 'Спасибо — это помогает делать игру лучше.', 'Gracias: nos ayuda a mejorar el juego.', 'Danke, das hilft uns, das Spiel besser zu machen.', 'Teşekkürler — oyunu daha iyi yapmamıza yardımcı oluyor.', 'Merci — ça nous aide à améliorer le jeu.')}</p>
      ) : (
        <>
          <span className="rr-q">{t('How was the race?', 'Как тебе гонка?', '¿Qué tal la regata?', 'Wie war die Regatta?', 'Yarış nasıldı?', 'Comment était la régate ?')}</span>
          <div className="rr-stars" role="radiogroup" aria-label={t('One to five', 'От одного до пяти', 'De una a cinco', 'Eins bis fünf', 'Birden beşe', 'De un à cinq')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} · ${words[n - 1]}`} title={words[n - 1]}
                className={n <= stars ? 'on' : undefined} onClick={() => rate(n)} disabled={stage === 'more'}>
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
              </button>
            ))}
          </div>
          {stage === 'more' && (
            <div className="rr-more">
              <label className="rr-l" htmlFor="rr-text">{stars <= 3 ? t('What got in the way?', 'Что мешало?', '¿Qué te molestó?', 'Was war im Weg?', 'Ne engel oldu?', 'Qu’est-ce qui t’a gêné ?') : t('What would make it better?', 'Что сделать ещё лучше?', '¿Qué la mejoraría?', 'Was würde es besser machen?', 'Neyi daha iyi yapardı?', 'Qu’est-ce qui la rendrait meilleure ?')} <span>{t('If you like', 'Если хочешь', 'Si quieres', 'Wenn du magst', 'İstersen', 'Si tu veux')}</span></label>
              <textarea id="rr-text" className="field rr-text" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
              <button type="button" className="pill pill-xs rr-send" onClick={send}><span className="btn-t">{text.trim() ? t('Send', 'Отправить', 'Enviar', 'Senden', 'Gönder', 'Envoyer') : t('Done', 'Готово', 'Hecho', 'Fertig', 'Tamam', 'Terminé')}</span></button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
