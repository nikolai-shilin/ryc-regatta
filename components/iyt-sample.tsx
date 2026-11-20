'use client';
import { useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import type { Sample } from '@/lib/iyt-sample';
import { IconOut } from './ui';

// A question from the trainer to try on /iyt (lib/iyt-sample.ts): its drawing, the question and four options. Pick one
// and it says right or not, marks the right answer (and yours, if it wasn't), and gives the reason in a line, the rules
// behind it and the way to more questions like it. One go: the answer stays as it is once given.
export function IytSample({ lang, q }: { lang: Lang; q: Sample }) {
  const t = tx(lang);
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === q.answer;
  return (
    <aside className="iyt-q" aria-labelledby="iyt-q-k">
      <div className="iyt-q-h">
        <span className="lbl-ink" id="iyt-q-k">{t('Try a question', 'Попробуйте вопрос', 'Prueba una pregunta', 'Probier eine Frage', 'Bir soru dene', 'Essaie une question')}</span>
        <span className="lbl">{t('Racing Rules of Sailing', 'Правила парусных гонок', 'Reglamento de Regatas a Vela', 'Wettfahrtregeln Segeln', 'Yelken Yarış Kuralları', 'Règles de course à la voile')}</span>
      </div>
      <div className="iyt-q-b">
        {/* the trainer's own drawing of the situation (an SVG from its site) */}
        <img className="iyt-q-fig" src={q.figure} width={344} height={224} decoding="async"
          alt={t('The drawing: Blue, ahead of you, tacks onto port in your path', 'Рисунок: Синяя впереди вас поворачивает на левый галс на вашем пути', 'El dibujo: Azul, por delante de ti, vira a amura de babor en tu camino', 'Die Zeichnung: Blau, vor dir, wendet auf Backbordbug in deinen Weg', 'Çizim: Önündeki Mavi, yoluna iskele kontraya tramola atıyor', 'Le dessin : Bleu, devant toi, vire bâbord amures sur ta route')} />
        <p className="iyt-q-text" id="iyt-q-text">{q.question}</p>
        <div className="iyt-q-opts" role="group" aria-labelledby="iyt-q-text">
          {q.options.map(([l, text]) => {
            const state = !picked ? '' : l === q.answer ? ' ok' : l === picked ? ' no' : ' off';
            return (
              <button key={l} type="button" className={`iyt-q-opt${state}`} aria-pressed={picked === l} aria-disabled={!!picked && picked !== l}
                onClick={() => { if (!picked) setPicked(l); }}>
                <b>{l}</b><span>{text}</span>
              </button>
            );
          })}
        </div>
        <div className="iyt-q-res" aria-live="polite">
          {picked && (
            <div className={right ? 'iyt-q-why ok' : 'iyt-q-why no'}>
              <p><b>{right ? t('Right.', 'Верно.', 'Correcto.', 'Richtig.', 'Doğru.', 'Exact.') : t(`Not quite: the answer is ${q.answer}.`, `Не совсем: правильный ответ — ${q.answer}.`, `No exactamente: la respuesta es ${q.answer}.`, `Nicht ganz: Die Antwort ist ${q.answer}.`, `Tam değil: cevap ${q.answer}.`, `Pas tout à fait : la réponse est ${q.answer}.`)}</b> {q.why}</p>
              <span className="lbl">{q.reference}</span>
              <a className="hm-src" href={q.more}>{t('More questions like this', 'Ещё вопросы на эту тему', 'Más preguntas como esta', 'Mehr Fragen wie diese', 'Buna benzer daha fazla soru', 'Plus de questions comme celle-ci')}<IconOut /></a>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
