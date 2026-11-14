import type { MetadataRoute } from 'next';
import { HOME_DESC, NAME } from '@/lib/seo';

// What a phone shows when the site is added to the home screen: the name, the RYC badge and the start page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${NAME} — a sailing race game`, short_name: NAME, description: HOME_DESC[0],
    start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
    background_color: '#070d16', theme_color: '#070d16', categories: ['games', 'sports'], lang: 'en',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
