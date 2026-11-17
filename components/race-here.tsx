'use client';

import { saveOpts } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import type { YachtId } from '@/lib/yachts';
import { IconArrow } from '@/components/ui';

// A venue's or a yacht's page: race there, or in her. Keeps the choice as the free race's (localStorage 'regatta', as
// the set-up page keeps it) and opens the set-up with it chosen, the rest as the player last left it.
export function RaceHere({ venue, yacht, label, className = 'gd-try-go vn-go' }: { venue?: VenueId; yacht?: YachtId; label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => {
      saveOpts({ ...(venue && { venue }), ...(yacht && { yacht }) });
      location.href = '/race/free';
    }}>{label}<IconArrow /></button>
  );
}
