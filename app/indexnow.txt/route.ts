import { INDEXNOW_KEY } from '@/lib/seo';

// The IndexNow key, where scripts/indexnow.mjs tells the search engines to find it (keyLocation).
export const dynamic = 'force-static';
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
