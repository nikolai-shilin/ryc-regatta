// Two languages, English and Russian. Copy sits inline as pairs: t('Settings', 'Настройки').
export type Lang = 'en' | 'ru';
export type T = (en: string, ru: string) => string;
export const tx = (lang: Lang): T => (en, ru) => (lang === 'ru' ? ru : en);
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ru';
