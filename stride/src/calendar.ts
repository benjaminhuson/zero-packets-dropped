// Manager availability. PROTOTYPE: a mock calendar shaped like Microsoft Graph free/busy.
// Live version: Graph findMeetingTimes or getSchedule for the line manager, which needs
// delegated Calendars.Read and free/busy visibility. Only free/busy times are read, never event details.

export interface Slot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  label: string; // e.g. "Tue 12 Nov, 10:00"
}

// Busy blocks in minutes from midnight, varied by day so the offers differ.
function busyFor(d: Date): [number, number][] {
  const patterns: [number, number][][] = [
    [[9 * 60 + 30, 10 * 60], [11 * 60, 12 * 60], [14 * 60, 14 * 60 + 30], [15 * 60, 16 * 60]],
    [[9 * 60, 9 * 60 + 60], [10 * 60 + 30, 11 * 60], [13 * 60, 14 * 60], [16 * 60, 16 * 60 + 30]],
    [[10 * 60, 11 * 60], [12 * 60, 13 * 60 + 30], [15 * 60 + 30, 16 * 60 + 30]],
  ];
  return patterns[d.getDate() % patterns.length];
}

const pad = (n: number) => String(n).padStart(2, '0');

// Free slots in working hours (09:00 to 17:00), skipping weekends, the past, and busy blocks.
export function freeSlots(from: Date = new Date(), options: { days?: number; durationMin?: number; count?: number } = {}): Slot[] {
  const days = options.days ?? 10;
  const duration = options.durationMin ?? 30;
  const count = options.count ?? 3;
  const out: Slot[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < days && out.length < count; i++) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const busy = busyFor(day);
    for (let m = 9 * 60; m + duration <= 17 * 60 && out.length < count; m += 30) {
      const clash = busy.some(([s, e]) => m < e && m + duration > s);
      if (clash) continue;
      const slotDate = new Date(day);
      slotDate.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (slotDate.getTime() <= from.getTime() + 2 * 3600 * 1000) continue; // at least 2 hours ahead
      const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const label = slotDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + `, ${time}`;
      out.push({ date, time, label });
    }
  }
  return out;
}
