import { Merriweather, Carlito, Sofia_Sans, Sofia_Sans_Condensed } from 'next/font/google';

// The site's faces, for its two root documents: every page's (app/[lang]/layout.tsx) and the 404's
// (app/global-not-found.tsx). Each sets its CSS variable on <html> through FONT_VARS.
// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
const merri = Merriweather({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap' });
const carlito = Carlito({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });
// The broadcast look (public/ui/tokens.css, on a screen marked .bc): Sofia Sans Condensed for numbers, names, labels and
// headlines, Sofia Sans for sentences. Both are variable fonts, so one file each covers the weights 500 to 800.
const sofia = Sofia_Sans({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--f-sofia', display: 'swap' });
const sofiaC = Sofia_Sans_Condensed({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--f-sofia-c', display: 'swap' });

export const FONT_VARS = `${merri.variable} ${carlito.variable} ${sofia.variable} ${sofiaC.variable}`;
