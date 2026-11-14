import type { T } from '@/lib/lang';

// The drawings in the guides, under a section's text (lib/guides.ts: fig). Drawn in the tokens' colours
// (styles/broadcast.css, .gd-fig): the marks as they look on the water, your track in your blue, the wind in white.

// "Wide in, tight out" at a leeward mark, the wind from the top, the mark left to port: your track comes down well wide
// of the mark, turns, and leaves it close, already close-hauled; the other way in, tight, swings out wide and below.
function WideInTightOut({ t }: { t: T }) {
  return (
    <figure className="gd-fig">
      <svg viewBox="0 0 320 215" role="img" aria-label={t(
        'Two ways round a leeward mark, with the wind from the top. Wide in, tight out: the approach well wide of the mark, the turn, and the exit close-hauled right by it. Tight in, wide out: in close to the mark, then out wide and below the first track.',
        'Два способа обогнуть нижний знак, ветер сверху. Широко зайти — узко выйти: подход далеко от знака, поворот и выход в бейдевинд вплотную к нему. Узко зайти — широко выйти: подход вплотную к знаку, а выход широко и ниже первого следа.')}>
        {/* the wind */}
        <path className="f-wind" d="M28 14 V50" />
        <path className="f-wind-h" d="M21 46 L35 46 L28 58 Z" />
        <text x="40" y="36">{t('WIND', 'ВЕТЕР')}</text>
        {/* tight in, wide out */}
        <path className="f-alt" d="M134 14 V140 C134 192 172 210 200 182 L280 102" />
        <path className="f-alt-h" d="M284 98 L281.9 107.2 L274.8 100.1 Z" />
        {/* wide in, tight out: your track */}
        <path className="f-you" d="M95 14 V108 C95 182 136 202 166 172 L252 86" />
        <path className="f-you-h" d="M256 82 L253.9 91.2 L246.8 84.1 Z" />
        {/* the mark */}
        <circle className="f-buoy" cx="150" cy="160" r="7" />
      </svg>
      <figcaption>
        <span className="gd-key gd-key-you">{t('Wide in, tight out: you leave the mark close, already close-hauled', 'Широко зайти — узко выйти: уходишь от знака вплотную, уже в бейдевинд')}</span>
        <span className="gd-key gd-key-alt">{t('Tight in, wide out: below the boats behind, in their dirty air', 'Узко зайти — широко выйти: под лодками позади, в их ветровой тени')}</span>
      </figcaption>
    </figure>
  );
}

export function GuideFigure({ fig, t }: { fig: 'wide'; t: T }) {
  if (fig === 'wide') return <WideInTightOut t={t} />;
  return null;
}
