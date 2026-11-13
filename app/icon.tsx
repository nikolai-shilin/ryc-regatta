import { badge } from '@/lib/badge';

// The RYC badge as a PNG: the icon a browser, Google's results and an installed app show. favicon.ico stays for the
// small sizes; apple-icon.tsx draws the same at 180.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return badge(size.width);
}
