import type { Lang } from './lang';

// A real question from the trainer (iyt.rycrentals.com, question rr-166: the racing rules, right of way, rules 10–13),
// for the card in /iyt's head. Its words are the trainer's own, copied as they are; its drawing is the trainer's too,
// served from there. Change the question there, change it here.
const Q = {
  id: 'rr-166',
  answer: 'B' as const,
  figure: { en: 'https://iyt.rycrentals.com/api/mcp?figure=rr-166', ru: 'https://iyt.rycrentals.com/api/mcp?figure=rr-166&lang=ru' },
  reference: { en: 'RRS 12, RRS 13, RRS 10', ru: 'ППГ 12, ППГ 13, ППГ 10', es: 'RRV 12, RRV 13, RRV 10', de: 'WR 12, WR 13, WR 10', tr: 'YYK 12, YYK 13, YYK 10', fr: 'RCV 12, RCV 13, RCV 10', it: 'RRS 12, RRS 13, RRS 10', pt: 'RRV 12, RRV 13, RRV 10' },
  pt: {
    question: 'Azul está livre à vante, dois comprimentos à sua frente, amurado a boreste no contravento; você se mantém afastado. Ele cambeia bem na sua rota, passa a amurado a bombordo e se acerta no contravento um comprimento e meio à sua frente. Quem se mantém afastado durante a cambada, e quem depois?',
    options: {
      A: 'Azul durante a cambada, depois você: terminada a cambada, você volta a ser o barco livre à ré',
      B: 'Azul nas duas vezes: durante a cambada ele se mantém afastado pela regra 13, e uma vez no contravento amurado a bombordo ele se mantém afastado de você, amurado a boreste, pela regra 10',
      C: 'Você durante a cambada dele, depois Azul: um barco cambando tem direito de passagem até estar no contravento',
      D: 'Você nas duas vezes: o barco de trás se mantém afastado do barco da frente, faça ele o que fizer (regra 12)',
    },
    why: 'A regra 12 deixa de valer quando Azul passa da proa ao vento; durante a cambada vale a regra 13, depois a regra 10, porque as amuras são opostas.',
  },
  it: {
    question: 'Blu è libera avanti, due lunghezze davanti a te, mure a dritta di bolina; tu ti tieni discosto. Vira proprio sulla tua rotta, passa mure a sinistra e si assesta di bolina una lunghezza e mezza davanti a te. Chi si tiene discosto mentre vira, e chi dopo?',
    options: {
      A: 'Blu durante la virata, poi tu: finita la virata, sei di nuovo la barca libera dietro',
      B: 'Blu entrambe le volte: durante la virata si tiene discosta per la regola 13, e una volta di bolina mure a sinistra si tiene discosta da te, mure a dritta, per la regola 10',
      C: 'Tu durante la sua virata, poi Blu: una barca che vira ha il diritto di rotta finché non è di bolina',
      D: 'Tu entrambe le volte: la barca dietro si tiene discosta da quella davanti, qualunque cosa faccia (regola 12)',
    },
    why: 'La regola 12 smette di valere quando Blu passa la prua al vento; durante la virata vale la regola 13, poi la regola 10, perché le mure sono diverse.',
  },
  fr: {
    question: 'Bleu est en route libre devant, deux longueurs devant toi, tribord amures au près ; tu te maintiens à l’écart. Il vire de bord juste sur ta route, passe bâbord amures et s’établit au près une longueur et demie devant toi. Qui se maintient à l’écart pendant son virement, et qui ensuite ?',
    options: {
      A: 'Bleu pendant le virement, puis toi : une fois son virement terminé, tu es de nouveau le bateau en route libre derrière',
      B: 'Bleu les deux fois : pendant le virement il se maintient à l’écart selon la règle 13, et une fois au près bâbord amures il se maintient à l’écart de toi, tribord amures, selon la règle 10',
      C: 'Toi pendant son virement, puis Bleu : un bateau qui vire de bord a la priorité jusqu’à ce qu’il soit au près',
      D: 'Toi les deux fois : le bateau derrière se maintient à l’écart du bateau devant, quoi qu’il fasse (règle 12)',
    },
    why: 'La règle 12 cesse de s’appliquer quand Bleu passe bout au vent ; la règle 13 s’applique pendant le virement, puis la règle 10, puisque les amures sont différentes.',
  },
  tr: {
    question: 'Mavi, orsa ayağında sancak kontrada senden iki boy açık önde; sen uzak duruyorsun. Tam önünde iskele kontraya tramola atıyor ve bir buçuk boy önünde orsaya oturuyor. Tramolası sırasında kim uzak durur, sonrasında kim?',
    options: {
      A: 'Tramola sırasında Mavi, sonra sen: tramolası bitince yine açık arkadaki tekne sensin',
      B: 'İki durumda da Mavi: tramola sırasında kural 13 gereği uzak durur, iskele kontrada orsaya oturunca da sancak kontradaki sana karşı kural 10 gereği uzak durur',
      C: 'Onun tramolası sırasında sen, sonra Mavi: tramola atan tekne orsaya oturana kadar geçiş hakkına sahiptir',
      D: 'İki durumda da sen: arkadaki tekne, öndeki ne yaparsa yapsın ondan uzak durur (kural 12)',
    },
    why: 'Kural 12, Mavi rüzgârın içinden geçtiğinde sona erer; tramola sırasında kural 13, sonrasında kontralar farklı olduğu için kural 10 uygulanır.',
  },
  de: {
    question: 'Blau liegt zwei Längen klar voraus auf Steuerbordbug an der Kreuz; du hältst dich frei. Sie wendet direkt vor dir auf Backbordbug und liegt anderthalb Längen vor dir hoch am Wind. Wer hält sich während ihrer Wende frei, und wer danach?',
    options: {
      A: 'Blau während der Wende, danach du: sobald ihre Wende beendet ist, bist du wieder das Boot klar achteraus',
      B: 'Beide Male Blau: während der Wende hält sie sich nach Regel 13 frei, und hoch am Wind auf Backbordbug hält sie sich von dir auf Steuerbordbug nach Regel 10 frei',
      C: 'Du während ihrer Wende, danach Blau: ein wendendes Boot hat Wegerecht, bis es hoch am Wind liegt',
      D: 'Beide Male du: das Boot dahinter hält sich vom Boot davor frei, was es auch tut (Regel 12)',
    },
    why: 'Regel 12 endet, wenn Blau durch den Wind geht; während der Wende gilt Regel 13 und danach Regel 10, weil die Bugs verschieden sind.',
  },
  es: {
    question: 'Azul va libre por la proa dos esloras delante de ti, amurada a estribor en ceñida; tú te mantienes separado. Vira a babor justo en tu camino y se queda de ceñida una eslora y media por delante de ti. ¿Quién se mantiene separado durante su virada, y quién después?',
    options: {
      A: 'Azul mientras vira, luego tú: una vez completada su virada, vuelves a ser el barco libre por la popa',
      B: 'Azul las dos veces: mientras vira se mantiene separada por la regla 13, y ya de ceñida amurada a babor se mantiene separada de ti, amurado a estribor, por la regla 10',
      C: 'Tú mientras ella vira, luego Azul: un barco que vira tiene derecho de paso hasta que queda de ceñida',
      D: 'Tú las dos veces: el barco que va detrás se mantiene separado del de delante haga lo que haga (regla 12)',
    },
    why: 'La regla 12 deja de aplicarse cuando Azul pasa proa al viento; durante la virada se aplica la regla 13 y después la regla 10, porque van en amuras distintas.',
  },
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
    figure: Q.figure[lang === 'ru' ? 'ru' : 'en'], more: `https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/rightofway#questions`,
  };
}
