import { findFlag, flagSrc } from '@/lib/flags';
import type { Lang } from '@/lib/lang';

// A sailor's country flag, 3:2, as a broadcast sets it before a name on a leaderboard: the flag they fly on the boat
// page (lib/flags.ts). A sailor who flies none, or a code this site doesn't draw, gets a blank flag in its place, so
// the names line up whether or not they fly one.
export const NoFlag = ({ className = 'fl' }: { className?: string }) => <span className={`${className} fl-none`} aria-hidden="true" />;

export function FlagImg({ code, lang }: { code: string | null | undefined; lang: Lang }) {
  const f = findFlag(code || undefined);
  if (!f) return <NoFlag />;
  const name = lang === 'ru' ? f.ru : lang === 'es' ? f.es ?? f.en : lang === 'de' ? f.de ?? f.en : lang === 'tr' ? f.tr ?? f.en : lang === 'fr' ? f.fr ?? f.en : lang === 'it' ? f.it ?? f.en : f.en;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="fl" src={flagSrc(f.code)} alt={name} title={name} width={24} height={16} loading="lazy" decoding="async" />;
}

// A name on a leaderboard: the flag, then the name cut short with an ellipsis if it must be
export const Who = ({ fl, name, lang }: { fl?: string | null; name: string; lang: Lang }) => (
  <span className="lb-who"><FlagImg code={fl} lang={lang} /><span className="lb-nm">{name}</span></span>
);
