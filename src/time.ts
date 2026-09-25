export function formatClock(minutes: number): string {
  const day = Math.floor(minutes / 1440);
  const withinDay = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(withinDay / 60);
  const mm = withinDay % 60;
  const hhText = String(hh).padStart(2, '0');
  const mmText = String(mm).padStart(2, '0');
  if (day === 0) return `${hhText}:${mmText}`;
  return `${hhText}:${mmText}(+D${day})`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

export function timeInputToMinutes(value: string): number {
  const parts = value.split(':');
  if (parts.length !== 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return NaN;
  return h * 60 + m;
}
