import { appIcon } from '@/lib/app-icon';

// The home-screen icon on an iPhone or iPad: the broadcast title block at 180 px.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return appIcon(size.width);
}
