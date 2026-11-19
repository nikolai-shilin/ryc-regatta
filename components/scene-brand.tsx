import Link from 'next/link';
import type { Lang } from '@/lib/lang';
import { SiteMenu } from './home-client';

// The game's name in the top bar of the pages over the scene (the race hub, the free race, the result, your boat), as
// the broadcast's title block: a blue bar, then UP AND DOWN on the panel. The name is the same in every language, as in
// the site's header, and like a site's logo it takes you home.
// With lang, the site's menu beside it (the one in the site's header: your account, your boat, every page), as these
// pages have no header; the sign-in pages leave it out, to keep to signing in.
export function SceneBrand({ lang }: { lang?: Lang }) {
  const brand = <Link className="bt-brand" href="/"><i aria-hidden="true" /><span>Up and down</span></Link>;
  return lang ? <>{brand}<span className="bt-menu"><SiteMenu lang={lang} /></span></> : brand;
}
