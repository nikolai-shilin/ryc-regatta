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
        'Два способа обогнуть нижний знак, ветер сверху. Широко зайти — узко выйти: подход далеко от знака, поворот и выход в бейдевинд вплотную к нему. Узко зайти — широко выйти: подход вплотную к знаку, а выход широко и ниже первого следа.', 'Dos formas de rodear una baliza de sotavento, con el viento desde arriba. Abierto a la entrada, cerrado a la salida: la aproximación bien separada de la baliza, el giro y la salida de ceñida justo al lado. Cerrado a la entrada, abierto a la salida: pegado a la baliza al entrar, y luego salida abierta y por debajo de la primera trayectoria.', 'Zwei Arten, eine Leetonne zu runden, mit dem Wind von oben. Weit hinein, eng hinaus: die Anfahrt weit von der Tonne, die Drehung und der Ausgang hoch am Wind dicht an ihr. Eng hinein, weit hinaus: dicht an die Tonne, dann weit hinaus und unter der ersten Spur durch.', 'Bir rüzgâraltı şamandırasını dönmenin iki yolu, rüzgâr yukarıdan. Geniş giriş, dar çıkış: şamandıranın epey açığından yaklaşma, dönüş ve hemen yanından orsa çıkış. Dar giriş, geniş çıkış: şamandıraya yakın girip sonra açılarak ilk izin altına çıkış.', 'Deux façons de contourner une bouée sous le vent, avec le vent venant du haut. Large en entrée, serré en sortie : l’approche bien au large de la bouée, le virage, et la sortie au près tout contre elle. Serré en entrée, large en sortie : tout près de la bouée, puis une sortie large, sous la première trace.')}>
        {/* the wind */}
        <path className="f-wind" d="M28 14 V50" />
        <path className="f-wind-h" d="M21 46 L35 46 L28 58 Z" />
        <text x="40" y="36">{t('WIND', 'ВЕТЕР', 'VIENTO', 'WIND', 'RÜZGÂR', 'VENT')}</text>
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
        <span className="gd-key gd-key-you">{t('Wide in, tight out: you leave the mark close, already close-hauled', 'Широко зайти — узко выйти: уходишь от знака вплотную, уже в бейдевинд', 'Abierto a la entrada, cerrado a la salida: dejas la baliza cerca, ya de ceñida', 'Weit hinein, eng hinaus: Du verlässt die Tonne dicht, schon hoch am Wind', 'Geniş giriş, dar çıkış: şamandırayı yakından, zaten orsada bırakırsın', 'Large en entrée, serré en sortie : tu quittes la bouée tout près, déjà au près')}</span>
        <span className="gd-key gd-key-alt">{t('Tight in, wide out: below the boats behind, in their dirty air', 'Узко зайти — широко выйти: под лодками позади, в их ветровой тени', 'Cerrado a la entrada, abierto a la salida: por debajo de los barcos de atrás, en su aire sucio', 'Eng hinein, weit hinaus: unter den Booten hinter dir, in ihrem Abwind', 'Dar giriş, geniş çıkış: arkandaki teknelerin altında, onların kirli havasında', 'Serré en entrée, large en sortie : sous les bateaux de derrière, dans leur vent perturbé')}</span>
      </figcaption>
    </figure>
  );
}

export function GuideFigure({ fig, t }: { fig: 'wide'; t: T }) {
  if (fig === 'wide') return <WideInTightOut t={t} />;
  return null;
}
