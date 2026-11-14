import { appIcon } from '@/lib/app-icon';

// The broadcast title block (UP / AND / DOWN by the blue bar) as a PNG: the icon a browser, Google's results and an
// installed app show. favicon.ico stays for the small sizes; apple-icon.tsx draws it at 180.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return appIcon(size.width);
}
