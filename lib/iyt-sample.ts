import type { Lang } from './lang';

// A real question from the trainer (iyt.rycrentals.com, question rr-166: the racing rules, right of way, rules 10–13),
// for the card in /iyt's head. Its words are the trainer's own, copied as they are; its drawing is the trainer's too,
// served from there. Change the question there, change it here.
const Q = {
  id: 'rr-166',
  answer: 'B' as const,
  figure: { en: 'https://iyt.rycrentals.com/api/mcp?figure=rr-166', ru: 'https://iyt.rycrentals.com/api/mcp?figure=rr-166&lang=ru' },
  reference: { en: 'RRS 12, RRS 13, RRS 10', ru: 'ППГ 12, ППГ 13, ППГ 10' },
  en: {
    question: 'Blue is two lengths clear ahead of you on starboard tack on a beat; you are keeping clear. She tacks onto port right in your path and settles close-hauled a length and a half ahead of you. Who keeps clear during her tack, and who after it?',
    options: {
      A: 'Blue while tacking, then you — once she has completed her tack you are the boat clear astern again',
      B: 'Blue both times — while tacking she keeps clear under rule 13, and once close-hauled on port she keeps clear of you, on starboard, under rule 10',
      C: 'You while she tacks, then Blue — a boat tacking has right of way until she is close-hauled',
      D: 'You both times — the boat astern keeps clear of the boat ahead whatever she does (rule 12)',
    },
    why: 'Rule 12 ends when Blue passes head to wind; rule 13 applies during the tack and rule 10 afterwards, since the tacks differ.',
  },
  ru: {
    question: 'Синяя в двух длинах чисто впереди вас правым галсом на лавировке; вы сторонитесь. Она делает поворот оверштаг на левый галс прямо на вашем пути и ложится в крутой бейдевинд в полутора длинах перед вами. Кто сторонится во время её поворота и кто после?',
    options: {
      A: 'Синяя во время поворота, затем вы — после завершения её поворота вы снова яхта чисто позади',
      B: 'Синяя в обоих случаях — во время поворота она сторонится по правилу 13, а лёгши в крутой бейдевинд левым галсом, сторонится вас, яхты правого галса, по правилу 10',
      C: 'Вы во время её поворота, затем Синяя — яхта в повороте имеет право дороги, пока не ляжет в бейдевинд',
      D: 'Вы в обоих случаях — яхта позади сторонится яхты впереди, что бы та ни делала (правило 12)',
    },
    why: 'Правило 12 заканчивается, когда Синяя проходит левентик; во время поворота действует правило 13, а после — правило 10, так как галсы разные.',
  },
};

export type Sample = {
  question: string; options: [letter: string, text: string][]; answer: string; why: string; reference: string;
  figure: string; more: string; // the drawing, and the trainer's page of this topic's questions
};

export function iytSample(lang: Lang): Sample {
  const q = Q[lang];
  return {
    question: q.question, options: Object.entries(q.options), answer: Q.answer, why: q.why, reference: Q.reference[lang],
    figure: Q.figure[lang], more: `https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/rightofway#questions`,
  };
}
