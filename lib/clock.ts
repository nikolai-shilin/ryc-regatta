// A race time as m:ss.d. The tenths are rounded before the minutes are split off, so 119.97 s reads 2:00.0, never 1:60.0.
export const clock = (s: number) => {
  const t = Number(s.toFixed(1)), m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
};
