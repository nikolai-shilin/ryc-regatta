import type { ShareTarget } from './share';

// Where the game posts, for the social page (/social): each channel's app (its mark and colour are the share sheet's,
// components/app-marks.tsx, lib/share.ts), its name there, its address, what it posts and in which language. Add a
// channel here and the page, its structured data and llms.txt list it.
export type Channel = { app: ShareTarget; name: string; handle: string; url: string; what: [en: string, ru: string]; lang: 'en' | 'ru' | 'both' };

export const CHANNELS: Channel[] = [
  {
    app: 'telegram', name: 'Telegram', handle: '@sailupanddown', url: 'https://t.me/sailupanddown', lang: 'ru',
    what: ['The game’s news, the day’s best races and the racing rules, a situation at a time.', 'Новости игры, лучшие гонки дня и разборы ситуаций по гоночным правилам.'],
  },
];
