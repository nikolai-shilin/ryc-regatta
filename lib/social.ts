import type { ShareTarget } from './share';

// Where the game posts, for the social page (/social): each channel's app (its mark and colour are the share sheet's,
// components/app-marks.tsx, lib/share.ts), its name there, its address, what it posts and in which language. Add a
// channel here and the page, its structured data and llms.txt list it.
export type Channel = { app: ShareTarget; name: string; handle: string; url: string; what: [en: string, ru: string, es?: string, de?: string, tr?: string, fr?: string, it?: string, pt?: string]; lang: 'en' | 'ru' | 'both' };

export const CHANNELS: Channel[] = [
  {
    app: 'telegram', name: 'Telegram', handle: '@sailupanddown', url: 'https://t.me/sailupanddown', lang: 'ru',
    what: ['The game’s news, the day’s best races and the racing rules, a situation at a time.', 'Новости игры, лучшие гонки дня и разборы ситуаций по гоночным правилам.', 'Las novedades del juego, las mejores regatas del día y el reglamento de regatas, situación a situación.', 'Die Neuigkeiten des Spiels, die besten Regatten des Tages und die Wettfahrtregeln, Situation für Situation.', 'Oyunun haberleri, günün en iyi yarışları ve yarış kuralları; her seferinde bir durum.', 'Les nouvelles du jeu, les meilleures régates du jour et les règles de course, une situation à la fois.', 'Le novità del gioco, le regate migliori del giorno e le regole di regata, una situazione alla volta.', 'As novidades do jogo, as melhores regatas do dia e as regras de regata, uma situação de cada vez.'],
  },
];
