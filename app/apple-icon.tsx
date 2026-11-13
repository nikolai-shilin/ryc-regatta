import { badge } from '@/lib/badge';

// The home-screen icon on an iPhone or iPad: the RYC badge at 180 px.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return badge(size.width);
}
