import { faqGroups } from '@/lib/faq';
import { glossaryGroups } from '@/lib/glossary';
import { rulebook, RULEBOOK_SOURCE } from '@/lib/rulebook';
import { GUIDES, GUIDE_DATES, guide } from '@/lib/guides';
import { VENUES } from '@/lib/venues';
import { VENUE_GUIDES } from '@/lib/venue-guides';
import { YACHTS } from '@/lib/yachts';
import { tx } from '@/lib/lang';
import { SITE, NAME, HOME_DESC, AUTHOR } from '@/lib/seo';

// /llms-full.txt: the site's reading in one Markdown file, for AI assistants and answer engines that read a site whole
// (llmstxt.org): every guide, the glossary, the venues, the yachts and the questions, in English. /llms.txt is the
// short version with the links. Built from the pages' own text, so it changes with them.
export const dynamic = 'force-static';

export function GET() {
  const t = tx('en');
  const by = `${AUTHOR.name[0]}, ${AUTHOR.org}`;
  const guides = GUIDES.map((slug) => {
    const g = guide(slug, t, 'en');
    return [`## ${g.title}`, '', `${SITE}/learn/${slug} · by ${by} · updated ${GUIDE_DATES[slug].modified}`, '', g.intro, '',
      ...g.sections.map((s) => [`### ${s.h}`, '', ...s.p, ...(s.tip ? [`Tip: ${s.tip}`] : [])].join('\n\n')), ''].join('\n');
  }).join('\n');
  const glossary = glossaryGroups(t).map((g) => [`### ${g.title}`, '', ...g.terms.map((x) => `- **${x.term}**: ${x.def}`)].join('\n')).join('\n\n');
  const rules = rulebook(t).map((p) => [`## ${p.title}`, '', p.intro, '', ...p.sections.flatMap((s) => [
    ...(s.title ? [`### ${s.title}`, '', ...(s.intro ? [s.intro, ''] : [])] : []),
    ...s.entries.map((x) => `- **${x.no ? `${x.no} ` : ''}${x.title}**: ${x.text}`), '',
  ])].join('\n')).join('\n');
  const venues = VENUES.map((v) => {
    const g = VENUE_GUIDES[v.id];
    return [`## ${g.title[0]}`, '', `${SITE}/venues/${v.id} · ${v.place[0]} · wind in the game: ${v.wind[0]}`, '', g.intro[0], '',
      ...g.sections.map((s) => [`### ${s.h[0]}`, '', ...s.p.map((p) => p[0])].join('\n\n')), ''].join('\n');
  }).join('\n');
  const yachts = YACHTS.map((y) => [`## ${y.name[0]}: ${y.kind[0]}`, '', `${SITE}/yachts/${y.id}`, '', y.tagline[0], '', ...y.about.map((p) => p[0]), '',
    `In the game: ${y.race[0]} In 12 knots of wind she makes about ${y.speed.up} kn close-hauled and ${y.speed.down} kn at her best angle downwind.`, '',
    y.specs.map((s) => `- ${s.k[0]}: ${s.v[0]}`).join('\n'), ''].join('\n')).join('\n');
  const faq = faqGroups(t).map((g) => [`### ${g.title}`, '', ...g.items.map((f) => `**${f.q}**\n${f.a}\n`)].join('\n')).join('\n');
  const body = `# ${NAME}: the full text

> ${HOME_DESC[0]}

This is the reading on ${SITE} in one file: the guides to sailboat racing, the glossary, the regatta venues, the yachts and the questions about the game. The short version, with the site's pages, is ${SITE}/llms.txt. Every page is also in Russian at the same address with ?lang=ru.

# Racing guides

${guides}
# Sailing racing glossary

${glossary}

# The racing rules, rule by rule

${SITE}/rulebook · a summary in our own words of the Racing Rules of Sailing 2025–2028, not the official text, which is World Sailing's: ${RULEBOOK_SOURCE}

${rules}
# The venues

${venues}
# The yachts

${yachts}
# FAQ

${faq}`;
  return new Response(body, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
