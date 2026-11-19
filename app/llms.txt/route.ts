import { faqGroups } from '@/lib/faq';
import { CHANNELS } from '@/lib/social';
import { tx } from '@/lib/lang';
import { SITE, NAME, HOME_DESC, AUTHOR } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';

// /llms.txt: the site in plain Markdown for AI assistants and answer engines (llmstxt.org), so that when someone asks
// for a sailing game they can say what this one is, quote it right and link the right page. The questions and answers
// are the FAQ page's own (lib/faq.ts), so they change with the game.
export const dynamic = 'force-static';

export function GET() {
  const faq = faqGroups(tx('en')).map((g) => [`### ${g.title}`, '', ...g.items.map((f) => `**${f.q}**\n${f.a}\n`)].join('\n')).join('\n');
  const body = `# ${NAME}

> ${HOME_DESC[0]}

${NAME} is a free 3D sailing race game by RYC that runs in any modern web browser, on a phone or a computer, with nothing to install. You sail a yacht round one of four courses (up and down, a triangle, a trapezoid, or up and down with an upwind finish) at one of 66 famous regatta venues (Göcek, Cowes, Newport, Sydney, San Francisco, Auckland, Hong Kong, Cape Town, New York and more), against up to six computer boats that race by the Racing Rules of Sailing: they hail, give way and do their penalty turns. It is in English, Russian, Spanish, German and Turkish.

## Key facts

- Price: free. Sign-in (Google or email) is optional and only puts your time on the daily ranking.
- Platforms: web browser on phone, tablet or computer. Touch steering on a phone, arrow keys on a computer.
- Today's race: a new race every midnight UTC, the same venue, wind, course and fleet for every player (the venues take turns), so times compare fairly; ranked for signed-in players.
- Custom race: light (7 kn), medium (12 kn) or strong (19 kn) wind; 3, 5 or 7 boats; up and down, triangle, trapezoid or up and down with an upwind finish; short, medium or long; 1 or 2 laps; a 1, 3 or 5 minute start; current on or off.
- Sailing: main and jib on their own sheets or auto-trim, tacks, gybes and a gennaker downwind; wind shifts of 10° and more, gusts and lulls; a real start sequence with the class flag, P, one minute and the gun.
- Made by RYC (https://www.rycrentals.com/), alongside Sailing Certification Test, an app for sailing certification exam practice. The guides and the venue pages are written by ${AUTHOR.name[0]} of RYC.
- The full text of the guides, the glossary, the venues, the yachts and the questions in one file: ${SITE}/llms-full.txt

## Pages

- [Home](${SITE}/): what the game is, today's race and the fastest times
- [Today's race](${SITE}/race): the race of the day and its ranking; start a race from here
- [Custom race](${SITE}/race/free): set up your own wind, fleet, course and start
- [How to play](${SITE}/help): controls, the race screen, camera views and the racing rules, with pictures
- [FAQ](${SITE}/faq): every question about the game, today's race, sailing and the rules
- [Your yacht](${SITE}/boat): hull and sail colours, flag and sail number
- [Racing guides](${SITE}/learn): short guides to sailboat racing
  - [Points of sail](${SITE}/learn/sail): close-hauled, reaching and running, the no-go zone, apparent wind, which point of sail is fastest
  - [How to tack and gybe a sailboat](${SITE}/learn/tack): the steps of a tack and a gybe, the crash gybe, when to choose each, rule 13
  - [The racing rules in five minutes](${SITE}/learn/rules): port and starboard, windward and leeward, clear astern, tacking, room at the mark, penalties
  - [How to win a sailing start](${SITE}/learn/start): the signals, the favoured end, timing the run, holding your spot, over early, clear air
  - [Headers and lifts](${SITE}/learn/shifts): tacking on the wind shifts, laylines, gusts and lulls, gybing on the lifts downwind
  - [Rounding the marks](${SITE}/learn/marks): the windward mark on starboard, the bear-away, picking a side of the gate, wide in and tight out, room in the zone
  - [Sailing downwind](${SITE}/learn/downwind): the gennaker, sailing angles, gybing on the lifts, crash gybes and death rolls, surfing waves
  - [Sail trim and boat speed](${SITE}/learn/trim): the sheets, steering, footing for speed, heel, reefing in a blow
  - [Sailing racing glossary](${SITE}/learn/glossary): beat, overlap, clear astern, header, lift, layline, zone, mark-room, OCS and more
- [The racing rules, rule by rule](${SITE}/rulebook): every rule of the Racing Rules of Sailing 2025–2028 in plain words, with the definitions, appendices and race signals
- [Sailing certification exam practice](${SITE}/iyt): RYC's free practice app for sailing certification theory exams
- [The venues](${SITE}/venues): the 66 regatta venues, each with the water, the wind, its regattas and how to race it
${VENUES.map((v) => `  - [${v.name[0]}, ${v.place[0]}](${SITE}/venues/${v.id})`).join('\n')}
- [The yachts](${SITE}/yachts): the nine yachts in 3D, each with a page of her own
${YACHTS.map((y) => `  - [${y.name[0]}](${SITE}/yachts/${y.id}): ${y.kind[0]}`).join('\n')}
- [The players](${SITE}/players): everyone who races signed in, the most races first: their races, wins and podiums, the yachts and venues they sail, and their boat in 3D in their colours
- [Social media](${SITE}/social): where the game posts its news and best races (${CHANNELS.map((c) => `${c.name} ${c.url}`).join(', ')}), and sending it to a friend

Every page is also in Russian: add ?lang=ru to the address (for example ${SITE}/faq?lang=ru).

## FAQ

${faq}
## На русском

> ${HOME_DESC[1]}

Все страницы есть на русском: добавь ?lang=ru к адресу, например ${SITE}/?lang=ru
`;
  return new Response(body, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
