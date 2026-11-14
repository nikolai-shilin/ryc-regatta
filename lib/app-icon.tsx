import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The site's icon in the broadcast look, the title block's: the blue bar and UP / AND / DOWN in Sofia Sans Condensed
// Bold on the dark panel (public/images/brand-icon.svg, the letters as outlines), as a PNG of px × px for app/icon.tsx
// and app/apple-icon.tsx. Full bleed: iOS rounds the corners itself. favicon.ico carries 16 and 32 as the bar and
// UD (brand-icon-small.svg) and 48 as the full block.
export async function appIcon(px: number) {
  const svg = await readFile(join(process.cwd(), 'public/images/brand-icon.svg'));
  return new ImageResponse(<img src={`data:image/svg+xml;base64,${svg.toString('base64')}`} width={px} height={px} />, { width: px, height: px });
}
