import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The RYC badge (public/images/ryc-badge.svg, the red square with the logo) as a PNG of px × px, for app/icon.tsx and
// app/apple-icon.tsx.
export async function badge(px: number) {
  const svg = await readFile(join(process.cwd(), 'public/images/ryc-badge.svg'));
  return new ImageResponse(<img src={`data:image/svg+xml;base64,${svg.toString('base64')}`} width={px} height={px} />, { width: px, height: px });
}
