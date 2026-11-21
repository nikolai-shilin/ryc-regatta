// The dictionary's scenes (words.js): each word of sailing that can be shown, shown on the water of the race paused
// behind it. Its yachts sail by the game's own physics (sim.js Boat.step) on its own course: the windward mark, the
// gate, the start line with its committee boat and pin, the laylines and the zone rings are the race's, drawn as the
// race draws them (world.js). Your boat stands in for the one each word is about, in your colours; another sails by
// her where a word takes two, a tag over each saying which is which. The race's own boats are put away meanwhile and
// given back as they were, with its course, its guides and its camera.
//
// How it works: the world draws a race of the scenes' (an object over the paused race, so its course, wind, sea and
// flags are the race's own) with boat views of their own; the race itself is never stepped or changed. world.shot
// takes the camera (world.js), framed into the part of the screen the dictionary leaves open.
import * as THREE from 'three';
import { Boat, KN, D2R, clamp, lerp, wrap, beatAngle, runAngle, polarSpeed, rng, waveHeight } from './sim.js';
import { CLS } from './classes.js';
import { labelSprite } from './yacht.js';
import { OVERLAY } from './post.js';
import { officer, Flag, tube, rod, RoundedBoxGeometry } from './committee.js';

const STEP = 1 / 60;
const LANG_AT = { en: 0, ru: 1, es: 2, de: 3, tr: 4, fr: 5, it: 6, pt: 7 };
// the tags over the boats
export const TAGS = {
  stbd: ['Starboard', 'Правый галс', 'Estribor', 'Steuerbord', 'Sancak', 'Tribord', 'Dritta', 'Boreste'],
  port: ['Port', 'Левый галс', 'Babor', 'Backbord', 'İskele', 'Bâbord', 'Sinistra', 'Bombordo'],
  windward: ['Windward', 'Наветренная', 'Barlovento', 'Luv', 'Rüzgârüstü', 'Au vent', 'Sopravvento', 'Barlavento'],
  leeward: ['Leeward', 'Подветренная', 'Sotavento', 'Lee', 'Rüzgâraltı', 'Sous le vent', 'Sottovento', 'Sotavento'],
  overlapped: ['Overlapped', 'Связаны', 'Comprometidos', 'Überlappt', 'Bindirmeli', 'Engagés', 'Ingaggiate', 'Sobrepostos'],
  ahead: ['Clear ahead', 'Чисто впереди', 'Libre por la proa', 'Klar voraus', 'Açık önde', 'Route libre devant', 'Libera avanti', 'Livre à vante'],
  astern: ['Clear astern', 'Чисто позади', 'Libre por la popa', 'Klar achteraus', 'Açık arkada', 'Route libre derrière', 'Libera dietro', 'Livre à ré'],
  inside: ['Inside · mark-room', 'Внутренняя · место у знака', 'Interior · espacio en baliza', 'Innen · Bahnmarkenraum', 'İçteki · şamandıra alanı', 'Intérieur · place à la marque', 'Interna · spazio alla boa', 'Por dentro · espaço de marca'],
  outside: ['Outside', 'Внешняя', 'Exterior', 'Außen', 'Dıştaki', 'Extérieur', 'Esterna', 'Por fora'],
  header: ['Header', 'Заход ветра', 'Rolada desfavorable', 'Dreher', 'Aleyhte dönüş', 'Refus', 'Salto a scarso', 'Rondada contra'],
  lift: ['Lift', 'Отход ветра', 'Rolada favorable', 'Raumer', 'Lehte dönüş', 'Adonnante', 'Salto a buono', 'Rondada a favor'],
  dirty: ['Dirty air', 'Ветровая тень', 'Aire sucio', 'Abwind', 'Kirli hava', 'Vent perturbé', 'Aria sporca', 'Vento sujo'],
  clear: ['Clear air', 'Чистый ветер', 'Aire limpio', 'Freier Wind', 'Temiz hava', 'Vent propre', 'Aria pulita', 'Vento limpo'],
  favoured: ['Favoured end', 'Выгодный конец', 'Extremo favorecido', 'Begünstigtes Ende', 'Avantajlı uç', 'Extrémité favorisée', 'Estremità favorita', 'Lado favorecido'],
  ocs: ['OCS', 'OCS', 'OCS', 'OCS', 'OCS', 'OCS', 'OCS', 'OCS'],
  proper: ['Proper course', 'Надлежащий курс', 'Rumbo debido', 'Richtiger Kurs', 'Uygun rota', 'Route normale', 'Rotta propria', 'Rumo devido'],
  penalty: ['Penalty turn', 'Штрафной оборот', 'Giro de penalización', 'Strafkringel', 'Ceza dönüşü', 'Tour de pénalité', 'Giro di penalità', 'Giro de penalidade'],
  veer: ['Veer', 'Сдвиг вправо', 'Rolada a la derecha', 'Rechtsdreher', 'Sağa dönüş', 'Bascule à droite', 'Rotazione a destra', 'Rondada à direita'],
  back: ['Back', 'Сдвиг влево', 'Rolada a la izquierda', 'Linksdreher', 'Sola dönüş', 'Bascule à gauche', 'Rotazione a sinistra', 'Rondada à esquerda'],
  layline: ['On the layline', 'На лейлайне', 'En la layline', 'Auf der Layline', 'Layline üzerinde', 'Sur la lay-line', 'Sulla layline', 'Na layline'],
  wind: ['Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent', 'Vento', 'Vento'],
  higher: ['Higher', 'Острее', 'Más orzado', 'Höher', 'Daha orsa', 'Plus près', 'Più stretto', 'Mais orçado'],
  lower: ['Lower', 'Полнее', 'Más abierto', 'Tiefer', 'Daha açık', 'Plus abattu', 'Più largo', 'Mais arribado'],
  closeHauled: ['Close-hauled', 'Бейдевинд', 'De ceñida', 'Hoch am Wind', 'Orsa', 'Au près', 'Di bolina', 'Na orça'],
  square: ['Square to the wind', 'Перпендикуляр к ветру', 'Perpendicular al viento', 'Rechtwinklig zum Wind', 'Rüzgâra dik', 'Perpendiculaire au vent', 'Perpendicolare al vento', 'Perpendicular ao vento'],
  umpire: ['Umpire', 'Ампайр', 'Umpire', 'Umpire', 'Hakem', 'Umpire', 'Umpire', 'Umpire'],
  danger: ['Danger', 'Опасно', 'Peligro', 'Gefahr', 'Tehlike', 'Danger', 'Pericolo', 'Perigo'],
};
const tagIn = (k, lang) => (TAGS[k] ? TAGS[k][LANG_AT[lang] ?? 0] ?? TAGS[k][0] : k);

// ---------- the scenes ----------
// Each word's: the boats (where each starts, her tack, her angle to the wind, what she holds to, her tag), the camera,
// how long it runs before it starts again, the leg the race's guides are drawn for, and what happens on the way.
// Places in boat lengths (S.L) from the course's marks; "up" is towards the wind, "right" to the right looking up it.
// A boat: at (where she is at the scene's start), tack (+1 starboard, −1 port), twa (degrees off the wind), hold (the
// angle she's steered to, twa by default; null: the helm left alone), kite, tag, warn (a red tag), you (your boat).
// A camera: on (a boat, or two: their middle; rib: that share of the way to the umpire's boat) or at (a place); r (what has to fit, in lengths, round it); el (degrees
// above the water); az (degrees round from behind her, or from downwind with wind: true or a place); spin (°/s).
// arrow: the wind's arrow on the water, alongside what the camera's on, on the side away from the other boat (true,
// or how many lengths off), or upwind of it ({ up: lengths, scale }); square: the
// line square to the wind through the start line's far end, so the favoured end shows ahead of it; umpire: the
// umpire's boat by a boat ({ by, at: [lengths to her right, ahead] }), her flag up in that boat's colour.
const SCENES = {
  beat: (S) => ({
    boats: [{ at: S.up(S.M, -13, 2), tack: 1, twa: S.bt }],
    cam: { at: S.up(S.M, -7, 0), r: 8, el: 58, az: 0 }, T: 26, leg: 'mark', guides: true,
    tick: (t, [b]) => { if (t > 4 && !b.auto && b.sinceTack > 7) b.tackOrGybe(); },
  }),
  'close-hauled': (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 1.5, el: 12, az: 70 }, T: 24 }),
  reach: (S) => ({ boats: [{ at: S.o, tack: 1, twa: 95 }], cam: { on: 0, r: 1.6, el: 14, az: 70 }, T: 24 }),
  run: (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.ra, kite: S.kite }], cam: { on: 0, r: 1.7, el: 16, az: 145 }, T: 24 }),
  tack: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 2.2, el: 38, az: 180, wind: true }, T: 12, arrow: true,
    tick: (t, [b]) => { if (t > 2.5 && !b.done1) { b.done1 = 1; b.tackOrGybe(); } },
  }),
  gybe: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: 150, kite: S.kite }], cam: { on: 0, r: 2.3, el: 34, az: 0, wind: true }, T: 13, arrow: true,
    tick: (t, [b]) => { if (t > 2.5 && !b.done1) { b.done1 = 1; b.tackOrGybe(); } },
  }),
  // side by side on a reach, the leeward one (yours) luffs, higher, and the windward one comes up after her to keep clear
  luff: (S) => {
    const h = S.h(1, 110);
    return { boats: [{ at: S.o, tack: 1, twa: 110, tag: 'leeward' }, { at: S.o, tack: 1, twa: 110, tag: 'windward', ...off(S.stb(h), 2.6 * S.L, S.fwd(h), -0.3 * S.L) }],
      cam: { on: [0, 1], r: 3.6, el: 64, az: 0, wind: true }, T: 11, arrow: 2.6,
      tick: (t, [a, b]) => { if (t > 2) { a.hold = 42; a.tag = 'higher'; } if (t > 2.8) b.hold = 48; } };
  },
  // side by side close-hauled, yours to leeward bears away, lower, and the other sails on close-hauled
  'bear-away': (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: 1, twa: S.bt }, { at: S.o, tack: 1, twa: S.bt, tag: 'closeHauled', ...off(S.stb(h), 2.4 * S.L, S.fwd(h), 0) }],
      cam: { on: [0, 1], r: 3.8, el: 64, az: 0, wind: true }, T: 11, arrow: 2.6,
      tick: (t, [a]) => { if (t > 2) { a.hold = 115; a.tag = 'lower'; } } };
  },
  'in-irons': (S) => ({ boats: [{ at: S.o, tack: 1, twa: 2, v: 0.2, hold: null }], cam: { on: 0, r: 1.6, el: 22, az: 120 }, T: 7, pre: 0 }),
  starboard: (S) => crossing(S, 0),
  port: (S) => crossing(S, 1),
  windward: (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: 1, twa: S.bt, tag: 'windward', you: true, ...off(S.stb(h), 2.2 * S.L, S.fwd(h), -0.4 * S.L) }, { at: S.o, tack: 1, twa: S.bt, tag: 'leeward' }],
      cam: { on: [0, 1], r: 3.6, el: 32, az: 205 }, T: 20 };
  },
  overlap: (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: 1, twa: S.bt, tag: 'overlapped', ...off(S.stb(h), 1.8 * S.L, S.fwd(h), -0.7 * S.L) }, { at: S.o, tack: 1, twa: S.bt }],
      cam: { on: [0, 1], r: 3.2, el: 64, az: 0 }, T: 20, stern: 1 };
  },
  'clear-astern': (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: 1, twa: S.bt, tag: 'astern', ...off(S.stb(h), 0.5 * S.L, S.fwd(h), -2.3 * S.L) }, { at: S.o, tack: 1, twa: S.bt, tag: 'ahead' }],
      cam: { on: [0, 1], r: 3.4, el: 60, az: 0 }, T: 20, stern: 1 };
  },
  'proper-course': (S) => {
    const h = S.h(1, S.ra);
    return { boats: [{ at: add(S.G, S.fwd(h), -11 * S.L), tack: 1, twa: S.ra, kite: S.kite, tag: 'proper' }],
      cam: { on: 0, r: 5, el: 42, az: 0 }, T: 18, leg: 'gate' };
  },
  penalty: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt, hold: null, tag: 'penalty', pen: true }], cam: { on: 0, r: 2.8, el: 58, az: 0, wind: true }, T: 22,
    tick: (t, [b]) => { b.rudder = t > 1 && b.pen ? 1 : 0; if (!b.pen) { b.hold = S.bt; b.tag = null; } },
  }),
  header: (S) => shift(S, -1),
  lift: (S) => shift(S, 1),
  layline: (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: add(S.M, S.fwd(h), -8 * S.L), tack: 1, twa: S.bt, tag: 'layline' }],
      cam: { at: add(S.M, S.fwd(h), -4 * S.L), r: 6, el: 62, az: 0 }, T: 26, leg: 'mark', guides: true };
  },
  'dirty-air': (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: 1, twa: S.bt, tag: 'dirty', ...off(S.down, 3.2 * S.L, S.stb(h), 0.3 * S.L) }, { at: S.o, tack: 1, twa: S.bt, tag: 'clear' }],
      cam: { on: [0, 1], r: 3.6, el: 44, az: 0 }, T: 20 };
  },
  gust: (S) => {
    const g = S.gust; if (!g) return null;
    const h = S.h(1, S.bt);
    return { boats: [{ at: add(g, S.fwd(h), -(g.r + 2 * S.L)), tack: 1, twa: S.bt }],
      cam: { at: g, r: g.r / S.L + 3, el: 64, az: 0 }, T: 22, guides: true };
  },
  'start-line': (S) => ({
    boats: [0.2, 0.4, 0.6, 0.8].map((f, i) => ({ at: S.up(S.lerpLine(f), -3.2 - (i % 2) * 0.6, 0), tack: 1, twa: S.bt })),
    cam: { at: S.up(S.Lm, -2, 0), r: S.lineL / 2 + 2, el: 30, az: 0 }, T: 12, leg: 'start',
  }),
  'favoured-end': (S) => ({
    boats: [{ at: S.up(S.fav, -1.6, 0), tack: 1, twa: S.bt, tag: 'favoured' }, { at: S.up(S.unfav, -1.6, 0), tack: 1, twa: S.bt }],
    cam: { at: S.Lm, r: S.lineL / 2 + 2.5, el: 55, az: 0 }, T: 12, leg: 'start', guides: true, arrow: { up: 3, scale: 2.2 }, square: true,
  }),
  ocs: (S) => ({
    boats: [{ at: S.up(S.lerpLine(0.5), 1.2, 0), tack: 1, twa: S.bt, tag: 'ocs', warn: true }, ...[0.25, 0.75].map((f) => ({ at: S.up(S.lerpLine(f), -1.5, 0), tack: 1, twa: S.bt }))],
    cam: { at: S.Lm, r: S.lineL / 2 + 2, el: 38, az: 0 }, T: 10, leg: 'start', pre: 0, v: 0.6,
  }),
  'general-recall': (S) => ({
    boats: [0.15, 0.35, 0.5, 0.65, 0.85].map((f, i) => ({ at: S.up(S.lerpLine(f), i % 2 ? 1.1 : -1.4, 0), tack: 1, twa: S.bt, ...(i % 2 ? { tag: 'ocs', warn: true } : {}) })),
    cam: { at: S.Lm, r: S.lineL / 2 + 2, el: 42, az: 0 }, T: 10, leg: 'start', pre: 0, v: 0.6,
  }),
  'windward-mark': (S) => rounding(S, { cam: { at: S.M, r: 5, el: 52, az: 0 } }),
  zone: (S) => rounding(S, { cam: { at: S.M, r: 6.5, el: 78, az: 0 } }),
  'mark-room': (S) => rounding(S, { two: true, cam: { at: S.M, r: 5, el: 60, az: 0 } }),
  gate: (S) => {
    const h = S.h(1, S.ra);
    return { boats: [{ at: add(S.G, S.fwd(h), -5 * S.L), tack: 1, twa: S.ra, kite: S.kite }],
      cam: { at: S.G, r: S.gateW / 2 + 3, el: 50, az: 180 }, T: 16, leg: 'gate' };
  },
  gennaker: (S) => (S.kite && !S.sym ? { boats: [{ at: S.o, tack: 1, twa: 135, kite: true }], cam: { on: 0, r: 1.5, el: 16, az: 40, spin: 6 }, T: 40 } : null),
  // a spinnaker on its pole, on a run, where it's best
  spinnaker: (S) => (S.kite && S.sym ? { boats: [{ at: S.o, tack: 1, twa: 165, kite: true }], cam: { on: 0, r: 1.5, el: 16, az: 40, spin: 6 }, T: 40 } : null),
  sheet: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt, manual: true }], cam: { on: 0, r: 1.15, el: 42, az: 25 }, T: 24,
    tick: (t, [b]) => { b.sheet = clamp(0.45 + 0.42 * Math.sin((t / 8) * 2 * Math.PI), 0, 1); },
  }),
  reef: (S) => (S.reef ? { boats: [{ at: S.o, tack: 1, twa: S.bt, reef: true }], cam: { on: 0, r: 1.5, el: 12, az: 80 }, T: 24 } : null),

  // ---------- the words added on 21 November ----------
  'no-go': (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 2.4, el: 64, az: 0, wind: true }, T: 11, guides: true,
    tick: (t, [b]) => { if (t > 2) b.hold = 12; },
  }),
  pinching: (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.bt - 9, hold: S.bt - 9 }], cam: { on: 0, r: 1.3, el: 20, az: 60 }, T: 20 }),
  footing: (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.bt + 8, hold: S.bt + 8 }], cam: { on: 0, r: 1.3, el: 20, az: 60 }, T: 20 }),
  // past dead downwind slowly, the boom left where it was: a few degrees by the lee; on further, it slams across
  'by-the-lee': (S) => ({
    boats: [{ at: S.o, tack: 1, twa: 160, kite: S.kite }], cam: { on: 0, r: 2, el: 40, az: 0, wind: true }, T: 18, arrow: true,
    tick: (t, [b]) => { b.holdH = S.h(1, 160 + clamp((t - 1) * 2, 0, 27)); },
  }),
  'crash-gybe': (S) => ({
    boats: [{ at: S.o, tack: 1, twa: 160 }], cam: { on: 0, r: 2, el: 40, az: 0, wind: true }, T: 16, arrow: true,
    tick: (t, [b]) => { if (!b.flipped) b.holdH = S.h(1, 160 + clamp((t - 1) * 3, 0, 45)); if (b.boom < 0) { b.flipped = 1; b.holdH = null; b.hold = 150; b.tag = 'danger'; b.warn = true; } },
  }),
  heel: (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 1.3, el: 6, az: 180 }, T: 24 }),
  'keep-clear': (S) => crossing(S, 1),
  'veer-back': (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 2.6, el: 76, az: 0, wind: true }, T: 14, guides: true,
    wind: (t) => 14 * D2R * (clamp((t - 1.5) / 2.5, 0, 1) - 2 * clamp((t - 7) / 4, 0, 1)),
    tick: (t, [b]) => { b.tag = t < 1.5 ? null : t < 8 ? 'veer' : 'back'; },
  }),
  oscillating: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 2.8, el: 78, az: 0, wind: true }, T: 24, guides: true,
    wind: (t) => 11 * D2R * Math.sin((t / 12) * 2 * Math.PI),
  }),
  persistent: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 2.8, el: 78, az: 0, wind: true }, T: 20, guides: true,
    wind: (t) => 20 * D2R * clamp((t - 1) / 14, 0, 1),
  }),
  current: (S) => (S.current ? { boats: [{ at: S.up(S.M, -2.5, 1.6), tack: 1, twa: S.bt }], cam: { at: S.M, r: 2.6, el: 38, az: 0, spin: 4 }, T: 16, leg: 'mark' } : null),
  'committee-boat': (S) => ({
    boats: [{ at: S.up(S.lerpLine(0.8), -2.2, 0), tack: 1, twa: S.bt }], cam: { at: S.cb, r: 2.4, el: 18, az: 0, spin: 7 }, T: 30, leg: 'start',
  }),
  pin: (S) => ({
    boats: [{ at: S.up(S.lerpLine(0.2), -2.2, 0), tack: 1, twa: S.bt }], cam: { at: S.pin, r: 2.2, el: 20, az: 0, spin: 7 }, T: 30, leg: 'start',
  }),
  umpire: (S) => {
    const h = S.h(1, S.bt);
    return { boats: [{ at: S.o, tack: -1, twa: S.bt, hold: null, tag: 'penalty', pen: true }, { at: S.o, tack: 1, twa: S.bt, tag: 'stbd', ...off(S.fwd(h), 2.6 * S.L, S.stb(h), -1.2 * S.L) }],
      cam: { on: 0, r: 1.5, el: 22, az: 35, wind: true, rib: 0.55 }, T: 18, umpire: { by: 0, at: [-1.5, -0.4] },
      tick: (t, [b]) => { b.rudder = t > 0.6 && b.pen ? -1 : 0; if (!b.pen) { b.hold = S.bt; b.tag = null; } } };
  },
  'starting-signal': (S) => SCENES['start-line'](S),
  'line-bias': (S) => SCENES['favoured-end'](S),
  leg: (S) => ({
    boats: [{ at: S.up(S.Lm, 4, 1), tack: 1, twa: S.bt }],
    cam: { at: S.mid(S.Lm, S.M), r: S.dist(S.Lm, S.M) / 2 / S.L + 2, el: 72, az: 0 }, T: 30, leg: 'mark', guides: true,
    tick: (t, [b]) => { if (t > 4 && !b.auto && b.sinceTack > 9) b.tackOrGybe(); },
  }),
  'offset-mark': (S) => (S.marks.offset ? around(S, S.M, S.marks.offset, S.G) : null),
  'wing-mark': (S) => (S.marks.wing ? around(S, S.M, S.marks.wing, S.G) : null),
  'wide-in': (S) => rounding(S, { cam: { at: S.M, r: 4, el: 70, az: 0 } }),
  'finish-line': (S) => {
    const f = S.finish, mid = f ? S.mid(f.a, f.b) : S.Lm, len = f ? S.dist(f.a, f.b) / S.L : S.lineL;
    let h = f ? Math.atan2(f.through.x, -f.through.z) : S.h(1, S.ra);
    if (Math.abs(wrap(S.W - h)) < S.bt * D2R) h = S.h(1, S.bt); // a finish straight upwind: crossed close-hauled
    return { boats: [headed(S, add(mid, S.fwd(h), -4 * S.L), h)], cam: { at: mid, r: len / 2 + 2, el: 45, az: 0 }, T: 14, leg: 'finish' };
  },
  mainsail: (S) => ({ boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 1.1, el: 10, az: 95, y: 0.45 }, T: 24 }),
  jib: (S) => (S.jib && !S.genoa ? { boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 1, el: 14, az: 150, y: 0.4 }, T: 24 } : null),
  // from above her lee side: its clew aft of the mast, over the main
  genoa: (S) => (S.genoa ? { boats: [{ at: S.o, tack: 1, twa: S.bt }], cam: { on: 0, r: 0.9, el: 62, az: 100, y: 0.2 }, T: 24 } : null),
  boom: (S) => ({
    boats: [{ at: S.o, tack: 1, twa: 150 }], cam: { on: 0, r: 1.2, el: 52, az: 0, wind: true }, T: 11,
    tick: (t, [b]) => { if (t > 3 && !b.done1) { b.done1 = 1; b.tackOrGybe(); } },
  }),
  'code-zero': (S) => (S.zero ? { boats: [{ at: S.o, tack: 1, twa: 80, kite: 'zero' }], cam: { on: 0, r: 1.6, el: 14, az: 60, spin: 4 }, T: 30 } : null),
  backing: (S) => ({ boats: [{ at: S.o, tack: 1, twa: 40, v: 0.4, hold: null, manual: true, sheet: 1 }], cam: { on: 0, r: 1.6, el: 22, az: 90 }, T: 14, pre: 0 }),
};
const add = (p, v, k) => ({ x: p.x + v.x * k, z: p.z + v.z * k });
const off = (v1, k1, v2, k2) => ({ dx: v1.x * k1 + v2.x * k2, dz: v1.z * k1 + v2.z * k2 });
// two close-hauled boats on opposite tacks crossing: port passes astern of starboard. Your boat the one the word's about
function crossing(S, youPort) {
  const hs = S.h(1, S.bt), hp = S.h(-1, S.bt), v = polarSpeed(S.tws, S.bt) * KN, Tc = 5, X = S.o;
  const s = { at: add(X, S.fwd(hs), -v * Tc), tack: 1, twa: S.bt, tag: 'stbd' };
  const p = { at: add(X, S.fwd(hp), -(v * Tc + 1.9 * S.L)), tack: -1, twa: S.bt, tag: 'port' };
  return { boats: youPort ? [p, s] : [s, p], cam: { at: X, r: 4.2, el: 50, az: 0 }, T: 13 };
}
// a wind shift on a close-hauled boat: a header she bears away for, a lift she points up in
function shift(S, k) {
  return { boats: [{ at: S.o, tack: 1, twa: S.bt, tag: k > 0 ? 'lift' : 'header', tagAt: 2.5 }], cam: { on: 0, r: 2.6, el: 76, az: 0, wind: true }, T: 12, guides: true,
    wind: (t) => k * 15 * D2R * clamp((t - 2) / 2.5, 0, 1) };
}
// up the starboard layline to the windward mark and round it to port, onto the run; two: overlapped, the inside one
// next to the mark
function rounding(S, { two, cam }) {
  const h = S.h(1, S.bt), f = S.fwd(h), sb = S.stb(h);
  const one = { at: add(add(S.M, f, -4.6 * S.L), sb, 1.3 * S.L), tack: 1, twa: S.bt, tag: two ? 'inside' : null };
  const out = { at: add(add(S.M, f, -4.3 * S.L), sb, 2.9 * S.L), tack: 1, twa: S.bt, tag: 'outside' };
  return { boats: two ? [one, out] : [one], cam, T: 24, leg: 'mark',
    tick: (t, bs) => { for (const b of bs) if (!b.round && (b.x - S.M.x) * f.x + (b.z - S.M.z) * f.z > 0.9 * S.L) { b.round = 1; b.hold = S.ra; b.kiteUp = S.kite; } } };
}

// a boat on a heading of her own (radians), her tack and angle to the wind as they come
function headed(S, at, h) {
  const twa = wrap(S.W - h) / D2R;
  return { at, tack: twa >= 0 ? 1 : -1, twa: Math.abs(twa), holdH: h };
}
// out from one mark to another, round it to port, and on towards a third: the reach to the wing mark and the gybe
// there, or the offset mark and the bear-away onto the run
function around(S, from, mark, next) {
  const d = Math.hypot(mark.x - from.x, mark.z - from.z), h = Math.atan2(mark.x - from.x, -(mark.z - from.z));
  const back = Math.min(3.5 * S.L, d * 0.8), at = add(mark, S.fwd(h), -back);
  const pass = add(add(mark, S.stb(h), 1.8 * S.L), S.fwd(h), 0.6 * S.L); // the mark to port: she passes to its right, and turns once by it
  return { boats: [{ ...headed(S, at, h), route: [pass, next] }], cam: { at: mark, r: 4.5, el: 58, az: 0 }, T: 18, leg: 'mark' };
}

// the classes whose kite is a spinnaker on a pole (the rest fly a gennaker), and whose headsail is a genoa, its clew aft
// of the mast (the rest carry a jib, short of it: a dinghy none)
const SYM = ['dragon', 'jclass'], GENOA = ['jpk1050', 'bavaria46', 'dragon'];
// the words that have a scene for this class (a dinghy has no gennaker, few classes a reef)
export const sceneIds = (cls = CLS) => Object.keys(SCENES).filter((id) => {
  const kite = !!cls.kite, sym = SYM.includes(cls.id), genoa = GENOA.includes(cls.id);
  return !((id === 'gennaker' && !(kite && !sym)) || (id === 'spinnaker' && !(kite && sym)) || (id === 'reef' && !cls.reef) || (id === 'code-zero' && !cls.zero)
    || (id === 'jib' && (cls.jib === false || genoa)) || (id === 'genoa' && !genoa));
});

// ---------- the stage ----------
// world: the race's World; race: the race, paused; lang: for the tags. Gives back show(id) (true: shown; false: the
// word has no scene, and the race is in view), frame(dt) to call from the page's loop before world.frame, view(rect)
// for the part of the screen left open, and close().
export function createStage({ world, race, lang = 'en' }) {
  const W = race.wind.dir(), tws = race.wind.p.tws, L = CLS.loa, c = race.course;
  const fwd = (h) => ({ x: Math.sin(h), z: -Math.cos(h) }), stb = (h) => ({ x: Math.cos(h), z: Math.sin(h) });
  const upV = fwd(W), rightV = stb(W), down = { x: -upV.x, z: -upV.z };
  const up = (p, u, r = 0) => ({ x: p.x + upV.x * u * L + rightV.x * r * L, z: p.z + upV.z * u * L + rightV.z * r * L });
  const M = c.marks.mark, Gm = { x: (c.gate[0].x + c.gate[1].x) / 2, z: (c.gate[0].z + c.gate[1].z) / 2 };
  const pin = c.pin, cb = c.committee, Lm = { x: (pin.x + cb.x) / 2, z: (pin.z + cb.z) / 2 };
  const pinUp = (pin.x - cb.x) * upV.x + (pin.z - cb.z) * upV.z;
  const o = { x: lerp(Lm.x, M.x, 0.45), z: lerp(Lm.z, M.z, 0.45) }; // open water, on the course: halfway up the beat
  const gs = (race.wind.gusts || []).filter((g) => g.s > 0 && g.r > 0).sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z));
  const S = {
    W, tws, L, o, M, G: Gm, down, up, fwd, stb, Lm, kite: !!CLS.kite, reef: !!CLS.reef,
    bt: beatAngle(tws), ra: runAngle(tws, !!CLS.kite),
    h: (tack, twa) => W - tack * twa * D2R,
    lerpLine: (f) => ({ x: lerp(pin.x, cb.x, f), z: lerp(pin.z, cb.z, f) }),
    lineL: Math.hypot(pin.x - cb.x, pin.z - cb.z) / L, gateW: Math.hypot(c.gate[0].x - c.gate[1].x, c.gate[0].z - c.gate[1].z) / L,
    fav: pinUp > 0 ? pin : cb, unfav: pinUp > 0 ? cb : pin,
    gust: gs[0] ? { x: gs[0].x, z: gs[0].z, r: gs[0].r } : null,
    zero: !!CLS.zero, jib: CLS.jib !== false, sym: SYM.includes(CLS.id), genoa: GENOA.includes(CLS.id), marks: c.marks, finish: c.finish, cb, pin,
    current: Math.hypot(race.current?.x || 0, race.current?.z || 0) > 0.05,
    mid: (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }), dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
  };
  const legOf = (k) => (k === 'start' ? 0 : Math.max(0, c.legs.indexOf(k)));

  // the race the world draws meanwhile: the paused one's course, wind, sea and flags, with boats of its own
  const stage = Object.create(race);
  stage.boats = []; stage.player = null; stage.multi = false; stage.rand = rng(11);
  let shiftNow = 0;
  stage.windAt = function (b) { const w = race.windAt.call(this, b); return shiftNow ? { ...w, dir: w.dir + shiftNow } : w; };

  // the boats' views, made as they're first needed and kept for the next word: yours, then four of the fleet's looks
  const NAMES = ['Aurora', 'Kestrel', 'Halcyon', 'Tern'];
  const views = [];
  let tagY = 12;
  const viewAt = (i) => {
    if (views[i]) return views[i];
    const b = i ? Object.assign(new Boat({ name: NAMES[i - 1] }), { ai: {} }) : new Boat({ name: 'You' });
    const v = world.boatView(b);
    if (v.label) tagY = v.label.position.y;
    const tag = labelSprite(i ? '#ffffff' : '#3db8ff'); tag.layers.set(OVERLAY); tag.visible = false; v.root.add(tag);
    v.tag = tag; v.root.visible = false;
    return (views[i] = v);
  };

  // the race's things, put away while a word is shown, and given back
  let saved = null;
  const hideRace = () => {
    if (saved) return;
    saved = { race: world.race, views: world.boatViews, wakes: world.wakes, contacts: world.contacts, guides: world.showGuides, mode: world.mode, intro: world.intro };
    for (const v of saved.views) v.root.visible = false;
    for (const w of [...saved.wakes, ...saved.contacts]) { if (w.mesh) w.mesh.visible = false; if (w.hmesh) w.hmesh.visible = false; }
    world.race = stage; world.mode = 'drone'; world.intro = null; world.shot = shot;
  };
  const giveBack = () => {
    if (!saved) return;
    dropWakes();
    for (const v of views) if (v) { v.root.visible = false; }
    for (const v of saved.views) v.root.visible = true;
    for (const w of [...saved.wakes, ...saved.contacts]) { if (w.mesh) w.mesh.visible = true; if (w.hmesh) w.hmesh.visible = true; }
    Object.assign(world, { race: saved.race, boatViews: saved.views, wakes: saved.wakes, contacts: saved.contacts, showGuides: saved.guides, mode: saved.mode, intro: saved.intro, shot: null, beatI: -1 });
    world.camera.clearViewOffset();
    stern.visible = false; hideExtras();
    saved = null;
  };
  let wakes = [], contacts = [];
  const dropWakes = () => { for (const w of [...wakes, ...contacts]) w.dispose(world.scene); wakes = []; contacts = []; };

  // the line square across a boat's stern, for clear astern and overlapped
  const stern = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f5c400', transparent: true, opacity: 0.9, fog: false }));
  stern.frustumCulled = false; stern.visible = false; world.scene.add(stern);

  // the wind's arrow, flat on the water and pointing the way the wind blows, with its tag at its tail: half see-through,
  // it drifts down the wind and fades, over and over, like a gust running across the water
  const AL = 1.5 * L, AW = 0.18 * L, HL = 0.5 * L, HW = 0.55 * L, ARROW_A = 0.5, ARROW_T = 1.8;
  const ash = new THREE.Shape();
  ash.moveTo(0, -AW / 2); ash.lineTo(AL - HL, -AW / 2); ash.lineTo(AL - HL, -HW / 2); ash.lineTo(AL, 0); ash.lineTo(AL - HL, HW / 2); ash.lineTo(AL - HL, AW / 2); ash.lineTo(0, AW / 2); ash.closePath();
  const arrow = new THREE.Group(), arrowM = new THREE.Mesh(new THREE.ShapeGeometry(ash), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: ARROW_A, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  arrowM.rotation.x = -Math.PI / 2; arrowM.renderOrder = 5; arrow.add(arrowM);
  const windTag = labelSprite('#ffffff'); windTag.layers.set(OVERLAY); windTag.position.set(0, 0.25 * L, 0); arrow.add(windTag);
  arrow.visible = false; world.scene.add(arrow);
  // the line square to the wind through the start line's unfavoured end, out past the favoured one, with its tag
  const square = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.5 * L, gapSize: 0.35 * L, transparent: true, opacity: 0.9, fog: false }));
  square.frustumCulled = false; square.visible = false; world.scene.add(square);
  const squareTag = labelSprite('#ffffff'); squareTag.layers.set(OVERLAY); squareTag.visible = false; world.scene.add(squareTag);
  windTag.userData.set(tagIn('wind', lang), false);
  squareTag.userData.set(tagIn('square', lang), false);
  // the umpire's boat: a RIB five metres long, her bow to −z: a white moulded hull with a deep vee, grey tubes round
  // her with a black rubbing strake, a non-slip deck, a console with its windscreen, wheel and aerial, a jockey seat
  // and an outboard; the driver at the wheel and the umpire behind him, standing, the flag up in the colour of the boat
  // she penalises (the race's officers, committee.js)
  let rib = null;
  const makeRib = () => {
    const g = new THREE.Group(), std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    const M = { hull: std('#eef0f1', { roughness: 0.35 }), tube: std('#59616a', { roughness: 0.55 }), strake: std('#1b1d20', { roughness: 0.5 }),
      deck: std('#b9bec2', { roughness: 0.9 }), white: std('#f4f5f6', { roughness: 0.4 }), dark: std('#202327', { roughness: 0.45 }),
      seat: std('#2c3138', { roughness: 0.8 }), glass: new THREE.MeshPhysicalMaterial({ color: '#9fb6c4', roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.45 }),
      steel: std('#c9ced2', { metalness: 0.8, roughness: 0.3 }) };
    const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    // the hull, lofted through its sections: a half-breadth and a keel at each station, fine at the bow
    const Z0 = -2.45, Z1 = 2.4, N = 14, sec = [];
    for (let i = 0; i <= N; i++) {
      const z = lerp(Z0, Z1, i / N), f = clamp((z - Z0) / 1.9, 0, 1), b = 0.86 * Math.sqrt(f) + 0.01, keel = lerp(0.3, -0.32, Math.min(1, f * 1.3));
      sec.push([[-b, 0.34], [-b * 0.97, 0.06], [-b * 0.45, keel + 0.08], [0, keel], [b * 0.45, keel + 0.08], [b * 0.97, 0.06], [b, 0.34]].map(([x, y]) => [x, y, z]));
    }
    const pos = [], idx = [];
    sec.forEach((r) => r.forEach((q) => pos.push(...q)));
    const W = sec[0].length;
    for (let i = 0; i < N; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + W; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const last = N * W; // the transom
    pos.push(0, 0.34, Z1); const c = pos.length / 3 - 1;
    for (let j = 0; j < W - 1; j++) idx.push(last + j, c, last + j + 1);
    const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setIndex(idx); hull.computeVertexNormals();
    add(hull, new THREE.MeshStandardMaterial({ color: '#eef0f1', roughness: 0.35, side: THREE.DoubleSide }));
    // the tubes, round her from the stern on one side to the stern on the other, their ends coned
    const path = [[0.92, 2.45], [0.97, 1.4], [0.97, 0], [0.9, -1.05], [0.66, -1.95], [0.3, -2.5], [0, -2.62]];
    const loop = [...path.map(([x, z]) => [x, z]), ...path.slice(0, -1).reverse().map(([x, z]) => [-x, z])];
    add(tube(loop.map(([x, z], i) => [x, 0.5 + (z < -1.5 ? (-1.5 - z) * 0.08 : 0), z]), 0.27, false, 16), M.tube);
    add(tube(loop.map(([x, z]) => [x * 1.06 + Math.sign(x) * 0.12, 0.3 + (z < -1.5 ? (-1.5 - z) * 0.08 : 0), z - (z < -2 ? 0.12 : 0)]), 0.045, false, 6), M.strake);
    for (const x of [-0.92, 0.92]) { const cone = add(new THREE.ConeGeometry(0.27, 0.34, 16).rotateX(Math.PI / 2), M.tube, x, 0.5, 2.62); cone.rotation.y = Math.PI; }
    // a grab line along the top of each tube
    for (const k of [-1, 1]) add(tube([[0.98 * k, 0.8, 1.9], [1.02 * k, 0.79, 0.6], [1, 0.79, -0.6].map((v, i) => (i ? v : v * k)), [0.86 * k, 0.79, -1.4]], 0.018, false, 5), M.strake);
    // the deck, inside the tubes
    const ds = new THREE.Shape(); [[0.7, 2.35], [0.72, 0], [0.6, -1.1], [0.3, -1.9], [-0.3, -1.9], [-0.6, -1.1], [-0.72, 0], [-0.7, 2.35]].forEach(([x, z], i) => (i ? ds.lineTo(x, -z) : ds.moveTo(x, -z)));
    add(new THREE.ShapeGeometry(ds).rotateX(-Math.PI / 2), M.deck, 0, 0.36, 0);
    // the console: its box, the windscreen raked over its front, a dash, the wheel, the aerial; the grab rail round it
    const conZ = -0.25;
    add(RoundedBoxGeometry(0.66, 0.82, 0.62, 3, 0.07), M.white, 0, 0.77, conZ);
    const glass = add(new THREE.PlaneGeometry(0.64, 0.34), M.glass, 0, 1.3, conZ - 0.2); glass.rotation.x = -0.55;
    add(new THREE.BoxGeometry(0.5, 0.06, 0.24), M.dark, 0, 1.2, conZ + 0.06).rotation.x = 0.35;
    const wheelM = add(new THREE.TorusGeometry(0.15, 0.022, 8, 24), M.dark, 0.08, 1.07, conZ + 0.36); wheelM.rotation.x = -0.75;
    add(rod([0.25, 1.18, conZ + 0.1], [0.25, 2.5, conZ + 0.1], 0.012), M.white);
    add(tube([[-0.36, 0.5, conZ + 0.36], [-0.38, 1.0, conZ + 0.3], [-0.36, 1.2, conZ - 0.1], [-0.36, 1.0, conZ - 0.36]], 0.018, false, 5), M.steel);
    add(tube([[0.36, 0.5, conZ + 0.36], [0.38, 1.0, conZ + 0.3], [0.36, 1.2, conZ - 0.1], [0.36, 1.0, conZ - 0.36]], 0.018, false, 5), M.steel);
    // the jockey seat behind it, and the fuel tank under the umpire's feet
    add(RoundedBoxGeometry(0.52, 0.5, 0.5, 3, 0.06), M.seat, 0, 0.62, conZ + 0.95);
    add(RoundedBoxGeometry(0.56, 0.12, 0.54, 3, 0.05), M.dark, 0, 0.92, conZ + 0.95);
    add(RoundedBoxGeometry(0.5, 0.22, 0.4, 2, 0.05), M.dark, -0.3, 0.47, 1.95);
    // the outboard on the transom: its cowling, the leg into the water, the tiller arm
    add(RoundedBoxGeometry(0.44, 0.52, 0.64, 3, 0.12), M.dark, 0, 0.98, 2.62);
    add(RoundedBoxGeometry(0.17, 1.15, 0.26, 2, 0.04), M.dark, 0, 0.18, 2.72);
    add(new THREE.BoxGeometry(0.32, 0.035, 0.36), M.dark, 0, -0.12, 2.74); // the cavitation plate, just under the water
    add(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 10).rotateX(Math.PI / 2), M.dark, 0, -0.32, 2.78); // the propeller's hub
    add(new THREE.BoxGeometry(0.46, 0.05, 0.12), M.steel, 0, 0.72, 2.34);
    // the crew: the driver at the wheel, the umpire standing behind him, his arm up with the flag
    const ahead = Math.PI / 2; // an officer faces +x: this turns him to look over the bow
    const driver = officer(0, '#1d3557', 'wheel');
    driver.g.position.set(0, 0.36 + 0.94 * 1.1 - 0.05, conZ + 0.74); driver.g.rotation.y = ahead; g.add(driver.g);
    driver.arms[0].rotation.set(0.28, 0, 0.62); driver.arms[1].rotation.set(-0.28, 0, 0.62); // his hands down on the wheel
    const ump = officer(2, '#d8342b', 'halyard');
    ump.g.position.set(0.32, 0.36 + 0.94 * 1.1, 1.45); ump.g.rotation.y = ahead - 0.35; g.add(ump.g);
    g.updateMatrixWorld(true);
    // the staff upright in his raised hand, and the flag at its head
    const hand = ump.wrists[1].localToWorld(new THREE.Vector3(0, -0.06, 0));
    const top = hand.clone().add(new THREE.Vector3(0, 1.1, 0)), low = hand.clone().add(new THREE.Vector3(0, -0.45, 0));
    add(rod(low.toArray(), top.toArray(), 0.018), M.steel);
    const flag = new Flag(null, 1.1, 0.75); flag.mat.color.set('#3db8ff');
    flag.pivot.position.copy(top); g.add(flag.pivot);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const tag = labelSprite('#ffffff'); tag.layers.set(OVERLAY); tag.position.set(0, 3.9, 0); tag.userData.set(tagIn('umpire', lang), false); g.add(tag);
    g.userData.flag = flag.mesh; g.userData.flagObj = flag; g.userData.hand = hand;
    g.visible = false; world.scene.add(g);
    return g;
  };
  let ribAt = null;
  const hideExtras = () => { arrow.visible = false; square.visible = false; squareTag.visible = false; if (rib) rib.visible = false; };

  // ---------- a word ----------
  let def = null, specs = null, id = null, t = 0, acc = 0;
  const build = () => {
    dropWakes();
    const boats = specs.map((sp, i) => {
      const twa = sp.twa, h = S.h(sp.tack, twa), at = { x: sp.at.x + (sp.dx || 0), z: sp.at.z + (sp.dz || 0) };
      const v = sp.v ?? def.v ?? polarSpeed(tws, Math.max(twa, 30), !!sp.kite) * KN * 0.95;
      const pre = def.pre ?? 1.2, f = fwd(h);
      const b = new Boat({ x: at.x - f.x * v * pre, z: at.z - f.z * v * pre, h, v, autoTrim: !sp.manual });
      b.boom = sp.tack; b.tackSide = sp.tack; b.hold = sp.hold === undefined && sp.holdH == null ? twa : sp.hold ?? null; b.tag = sp.tag || null; b.warn = !!sp.warn;
      b.holdH = sp.holdH ?? null; b.route = sp.route ? [...sp.route] : null;
      if (sp.kite) { b.kite = true; b.kiteFill = 1; if (sp.kite === 'zero') b.kiteType = 'zero'; }
      if (sp.sheet != null) b.sheet = b.jibSheet = sp.sheet;
      if (sp.reef) { b.reef = true; b.reefFill = 1; }
      if (sp.pen) b.pen = {};
      if (sp.warn) b.ocs = true;
      b.leg = legOf(def.leg || 'mark');
      b.view = i;
      return b;
    });
    stage.boats = boats; stage.player = boats[0];
    world.boatViews = boats.map((b, i) => { const v = viewAt(i); v.root.visible = true; v.sea = null; return v; });
    for (let i = boats.length; i < views.length; i++) if (views[i]) views[i].root.visible = false;
    const Wake = saved.wakes[0]?.constructor, Contact = saved.contacts[0]?.constructor;
    wakes = Wake ? boats.map(() => new Wake(world.scene, world.wakeU, world.wakeField)) : [];
    contacts = Contact ? boats.map(() => new Contact(world.scene, world.wakeU, world.wakeField)) : [];
    world.wakes = wakes; world.contacts = contacts;
    world.showGuides = !!def.guides; world.beatI = -1;
    t = 0; shiftNow = 0;
    hideExtras();
    if (def.square) { // through the unfavoured end, square to the wind, out past the favoured end
      const k = (S.fav.x - S.unfav.x) * rightV.x + (S.fav.z - S.unfav.z) * rightV.z >= 0 ? 1 : -1, len = (S.lineL * 1.2 + 1) * L;
      const a = S.unfav, b = { x: a.x + rightV.x * k * len, z: a.z + rightV.z * k * len }, pos = square.geometry.attributes.position;
      pos.setXYZ(0, a.x, 0.4, a.z); pos.setXYZ(1, b.x, 0.4, b.z); pos.needsUpdate = true; square.computeLineDistances();
      squareTag.position.set(b.x, 0.25 * L, b.z);
      square.visible = squareTag.visible = true;
    }
    if (def.umpire) { rib ||= makeRib(); rib.visible = true; ribAt = null; }
    // the run-up: she comes to where she starts already sailing, her sails set
    for (let n = Math.round((def.pre ?? 1.2) / STEP); n > 0; n--) stepAll(true);
  };
  const steer = (b) => {
    if (b.auto) return;
    if (b.route?.length) { // on to the next point of her way, never into the wind
      const p = b.route[0], dx = p.x - b.x, dz = p.z - b.z;
      if (Math.hypot(dx, dz) < 0.8 * L || (b.route.length > 1 && dx * Math.sin(b.h) - dz * Math.cos(b.h) < 0 && Math.hypot(dx, dz) < 3 * L)) { b.route.shift(); return steer(b); }
      let h = Math.atan2(dx, -dz); const a = wrap(b.wdir - h);
      if (Math.abs(a) < S.bt * D2R) h = b.wdir - Math.sign(a || 1) * S.bt * D2R;
      b.holdH = h;
    }
    let want;
    if (b.holdH != null) want = b.holdH;
    else if (b.hold != null) { const side = Math.sign(wrap(b.wdir - b.h)) || b.tackSide || 1; want = b.wdir - side * b.hold * D2R; }
    else return;
    b.rudder = clamp(wrap(want - b.h) / (14 * D2R) - b.yawRate * 0.6, -1, 1);
  };
  function stepAll(pre) {
    if (!pre) { t += STEP; if (def.wind) shiftNow = def.wind(t); if (def.tick) def.tick(t, stage.boats); }
    for (const b of stage.boats) {
      if (b.kiteUp && !b.kite && !b.kiteJob) b.setKite(true);
      steer(b);
      b.step(STEP, stage);
      b.events.length = 0;
    }
  }

  // ---------- the camera ----------
  // A tag keeps its size on screen whatever the camera's distance, so where the open water is narrow (the panel at the
  // side of a screen held upright) a boat near its edge would carry her tag off it: the pill slides in, over her still,
  // to stay inside the open part (r, in pixels of the canvas Wd wide) with 8 px to spare; one wider than it is centred.
  const tp = new THREE.Vector3(), ts = new THREE.Vector3();
  function keepIn(tag, cam, Wd, r) {
    tag.center.x = 0.5;
    const w = tag.userData.w; if (!w) return;
    tag.getWorldPosition(tp); tag.getWorldScale(ts); tp.project(cam);
    if (!(Math.abs(tp.z) <= 1)) return;
    const spr = ts.x * cam.projectionMatrix.elements[0] / 2 * Wd, pill = spr * w / tag.material.map.image.width; // (sizeAttenuation off: the sprite's width on screen)
    const x = (tp.x + 1) / 2 * Wd, lo = r.x + 8 + pill / 2, hi = r.x + r.w - 8 - pill / 2;
    const want = lo > hi ? r.x + r.w / 2 : Math.min(hi, Math.max(lo, x));
    tag.center.x = 0.5 + (x - want) / spr;
  }
  let rect = null, camH = null;
  const target = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3();
  let firstShot = true;
  function shot(cam, cl, time) {
    const C = def?.cam; if (!C) return;
    const bs = stage.boats, on = C.on == null ? null : [].concat(C.on).map((i) => bs[i]).filter(Boolean);
    let p = on?.length ? { x: on.reduce((s, b) => s + b.x, 0) / on.length, z: on.reduce((s, b) => s + b.z, 0) / on.length } : C.at;
    if (C.rib && rib?.visible && ribAt) p = { x: lerp(p.x, rib.position.x, C.rib), z: lerp(p.z, rib.position.z, C.rib) }; // (the umpire's boat in the picture too)
    const head = on?.length && !C.wind ? on[0].h : W;
    camH = camH == null ? head : camH + wrap(head - camH) * cl(0.9);
    const ph = camH + (C.az + (C.spin || 0) * time) * D2R, el = C.el * D2R;
    // as far off as what has to fit needs, in the part of the screen the panel leaves
    const el0 = world.renderer.domElement, Wd = el0.clientWidth || 1, Hd = el0.clientHeight || 1;
    const r = rect || { x: 0, y: 0, w: Wd, h: Hd };
    const tv = Math.tan((50 * D2R) / 2), half = Math.min(tv * (r.h / Hd), tv * (Wd / Hd) * (r.w / Wd));
    const d = (C.r * L * 1.08) / Math.max(0.05, half);
    const f = fwd(ph);
    want.set(p.x - f.x * d * Math.cos(el), Math.max(2, d * Math.sin(el)) + L * 0.15, p.z - f.z * d * Math.cos(el));
    target.set(p.x, on?.length ? L * (C.y ?? 0.25) : 0, p.z);
    const k = firstShot ? 1 : cl(2.4);
    cam.position.lerp(want, k); look.lerp(target, firstShot ? 1 : cl(3)); firstShot = false;
    cam.up.set(0, 1, 0); cam.lookAt(look); cam.fov = 50;
    // the picture's middle moved into the open part
    cam.setViewOffset(Wd, Hd, -((r.x + r.w / 2) - Wd / 2), -((r.y + r.h / 2) - Hd / 2), Wd, Hd);
    // the tags, and the line across a stern
    cam.updateMatrixWorld();
    bs.forEach((b, i) => {
      const v = world.boatViews[i], tag = v?.tag; if (!tag) return;
      const text = b.tag && t >= (specs[i]?.tagAt || 0) ? tagIn(b.tag, lang) : '';
      tag.visible = !!text; if (text) { tag.userData.set(text, b.warn); tag.position.set(0, tagY, 0); keepIn(tag, cam, Wd, r); }
    });
    // the wind's arrow, upwind of what the camera's on, pointing down the wind there is now
    arrow.visible = !!def.arrow;
    if (arrow.visible) {
      const wn = W + shiftNow, u = fwd(wn), r = stb(wn), k = def.arrow.scale || 1;
      arrowM.scale.setScalar(k);
      let cx, cz;
      if (def.arrow.up) { cx = p.x + u.x * (def.arrow.up * L + AL * k); cz = p.z + u.z * (def.arrow.up * L + AL * k); }
      else {
        const gap = (def.arrow === true ? 2.2 : def.arrow) * L, two = bs[1] && on?.length > 1;
        const side = two && (bs[1].x - bs[0].x) * r.x + (bs[1].z - bs[0].z) * r.z > 0 ? -1 : two ? 1 : -1;
        cx = p.x + r.x * side * gap + u.x * AL * 0.6; cz = p.z + r.z * side * gap + u.z * AL * 0.6;
      }
      arrow.position.set(cx, 0.45, cz);
      arrow.rotation.y = Math.atan2(-Math.cos(wn), -Math.sin(wn)); // its +x down the wind
      // a third of its length down the wind, fading in and out as it goes (its tag stays put)
      const ph = (time / ARROW_T) % 1;
      arrowM.position.x = (ph - 0.5) * AL * k / 3;
      arrowM.material.opacity = ARROW_A * (0.25 + 0.75 * Math.sin(Math.PI * ph));
    }
    // the umpire's boat: by the boat she watches, on the way that boat set out on, riding the swell
    if (rib && rib.visible && def.umpire) {
      const b = bs[def.umpire.by];
      if (b) {
        if (!ribAt) ribAt = { h: b.h, x: b.x, z: b.z };
        const [r1, a1] = def.umpire.at, f1 = fwd(ribAt.h), s1 = stb(ribAt.h);
        ribAt.x += (b.x - ribAt.x) * cl(2); ribAt.z += (b.z - ribAt.z) * cl(2);
        const x = ribAt.x + s1.x * r1 * L + f1.x * a1 * L, z = ribAt.z + s1.z * r1 * L + f1.z * a1 * L;
        rib.position.set(x, waveHeight(world.W, x, z, time) * 0.8 - 0.1, z); rib.rotation.y = -ribAt.h; // her tubes just clear of the water
        rib.userData.flagObj.update(time, ribAt.h - (W + shiftNow), tws * 0.514); // flying down the wind
      }
    }
    stern.visible = !!def.stern && !!bs[def.stern];
    if (stern.visible) {
      const a = bs[def.stern], hf = fwd(a.h), hs = stb(a.h), sx = a.x - hf.x * L * 0.5, sz = a.z - hf.z * L * 0.5, pos = stern.geometry.attributes.position;
      pos.setXYZ(0, sx - hs.x * 3 * L, 0.35, sz - hs.z * 3 * L); pos.setXYZ(1, sx + hs.x * 3 * L, 0.35, sz + hs.z * 3 * L); pos.needsUpdate = true;
    }
  }

  // the words this race can show: the class's, less those its course, wind or water haven't the makings of (a wing
  // mark on a triangle only, a current where the water runs, a gust where one is blowing)
  const ids = sceneIds().filter((w) => { try { return !!SCENES[w](S); } catch (e) { return false; } });
  return {
    ids,
    has: (w) => ids.includes(w),
    show(w) {
      const make = SCENES[w];
      const d = make && ids.includes(w) ? make(S) : null;
      if (!d) { def = null; id = null; hideExtras(); giveBack(); return false; }
      hideRace();
      id = w; def = d; specs = d.boats; acc = 0;
      build();
      return true;
    },
    frame(dt) {
      if (!def) return;
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) { stepAll(false); acc -= STEP; }
      if (t > def.T) build();
    },
    view(r) { rect = r; },
    get id() { return id; },
    // (for the tests: the wind's arrow, the square line and the umpire's boat)
    get extras() { return { arrow, square, rib }; },
    close() {
      giveBack();
      for (const v of views) if (v) { world.scene.remove(v.root); world.seaShade.remove(v); v.root.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); }
      views.length = 0;
      world.scene.remove(stern); stern.geometry.dispose(); stern.material.dispose();
      for (const o of [arrow, square, squareTag, rib]) if (o) { world.scene.remove(o); o.traverse((x) => { x.geometry?.dispose(); x.material?.map?.dispose(); x.material?.dispose(); }); }
    },
  };
}
