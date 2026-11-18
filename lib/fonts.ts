import { Merriweather, Carlito, Sofia_Sans, Sofia_Sans_Condensed } from 'next/font/google';

// The site's faces, for its two root documents: every page's (app/[lang]/layout.tsx) and the 404's
// (app/global-not-found.tsx). Each sets its CSS variable on <html> through FONT_VARS.
// `subsets` says only which files every page preloads: the Cyrillic and Latin Extended ones are still there, and the
// browser fetches them when a page has letters of theirs. Preloaded, they cost an English page 270 KB it never draws.
// The RYC look: Carlito for text and controls, Merriweather Light for headings and big numbers; both carry Cyrillic.
// Merriweather isn't preloaded at all: most pages are in the broadcast look and never draw it.
const merri = Merriweather({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--f-merri', display: 'swap', preload: false });
const carlito = Carlito({ subsets: ['latin'], weight: ['400', '700'], variable: '--f-carlito', display: 'swap' });
// The broadcast look (public/ui/tokens.css, on a screen marked .bc): Sofia Sans Condensed for numbers, names, labels and
// headlines, Sofia Sans for sentences. Both are variable fonts, so one file each covers the weights 500 to 800.
const sofia = Sofia_Sans({ subsets: ['latin'], variable: '--f-sofia', display: 'swap' });
const sofiaC = Sofia_Sans_Condensed({ subsets: ['latin'], variable: '--f-sofia-c', display: 'swap' });

export const FONT_VARS = `${merri.variable} ${carlito.variable} ${sofia.variable} ${sofiaC.variable}`;
