import type { VenueId } from './venues';
import { PART_1 } from './venue-guides/part-1';
import { PART_2 } from './venue-guides/part-2';
import { PART_3 } from './venue-guides/part-3';
import { PART_4 } from './venue-guides/part-4';
import { PART_5 } from './venue-guides/part-5';

// The venue pages (/venues/<id>): what each place is like to sail and race in, for people who search for it and for
// the AI assistants that answer them. The game's own facts about a venue (its wind, the courses laid there) come from
// lib/venues.ts and public/game/venues.js and are added by the page; these are the place itself: the water, the
// wind, the regattas and a few local tactics, true of the real place.
type Pair = [string, string]; // English, Russian
export type VenueGuide = {
  title: Pair; // the page's <title>, without the site's name: 'Sailing in Cowes: the Solent and Cowes Week'
  description: Pair; // the search result's line, at most 155 characters
  intro: Pair; // two or three sentences under the name
  sections: { h: Pair; p: Pair[] }[]; // three: the water and the wind, the regattas, racing here (local tactics)
};

// when the venue and yacht pages were written: their bylines and the sitemap's lastmod
export const PAGES_DATE = '2026-11-17';

export const VENUE_GUIDES: Record<VenueId, VenueGuide> = { ...PART_1, ...PART_2, ...PART_3, ...PART_4, ...PART_5 } as Record<VenueId, VenueGuide>;
