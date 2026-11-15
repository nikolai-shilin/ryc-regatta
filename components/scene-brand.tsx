import Link from 'next/link';

// The game's name in the top bar of the pages over the scene (the race hub, the free race, the result, your boat), as
// the broadcast's title block: a blue bar, then UP AND DOWN on the panel. The name is the same in both languages, as in
// the site's header, and like a site's logo it takes you home.
export function SceneBrand() {
  return <Link className="bt-brand" href="/"><i aria-hidden="true" /><span>Up and down</span></Link>;
}
