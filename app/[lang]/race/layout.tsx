import { RaceMusic } from '@/components/race-music';

// Every /race page. The music of the race's pause screen (components/race-music.tsx) is mounted here, once, so it plays
// on from the hub to the free race's set-up and back; it plays on those two only.
export default function RaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<RaceMusic /></>;
}
