'use client';
import type { Lang } from '@/lib/lang';
import { tx } from '@/lib/lang';
import { CopyLink, ShareButton } from './share-sheet';

// /social's way to send the game to a friend: the share sheet (each app, the link to copy, the phone's own sheet) and
// Copy link beside it, with home's address on this site's origin and a line in the reader's language.
export function ShareGame({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const data = () => ({
    url: `${location.origin}/${lang === 'ru' ? '?lang=ru' : ''}`,
    text: t('Up and down: a sailing race in the browser, today’s race the same for everyone. Beat my time?', 'Up and down — парусная регата в браузере, гонка дня одна на всех. Обгонишь моё время?'),
    title: t('Share the game', 'Поделиться игрой'),
  });
  return (
    <div className="so-share">
      <ShareButton lang={lang} data={data} className="pill pill-primary" title={t('Share the game', 'Поделиться игрой')} />
      <CopyLink lang={lang} data={data} className="pill" />
    </div>
  );
}
