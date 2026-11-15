import { findFlag, flagSrc } from '@/lib/flags';
import type { Lang } from '@/lib/lang';

// A sailor's country flag, 3:2, as a broadcast sets it before a name on a leaderboard: the flag they fly on the boat
// page (lib/flags.ts). Nothing for a sailor who flies none, or a code this site doesn't draw.
export function FlagImg({ code, lang }: { code: string | null | undefined; lang: Lang }) {
  const f = findFlag(code || undefined);
  if (!f) return null;
  const name = lang === 'ru' ? f.ru : f.en;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="fl" src={flagSrc(f.code)} alt={name} title={name} width={24} height={16} loading="lazy" decoding="async" />;
}

// A name on a leaderboard: the flag, then the name cut short with an ellipsis if it must be
export const Who = ({ fl, name, lang }: { fl?: string | null; name: string; lang: Lang }) => (
  <span className="lb-who"><FlagImg code={fl} lang={lang} /><span className="lb-nm">{name}</span></span>
);
