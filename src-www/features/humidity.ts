/**
 * Dry air: which rooms are below the humidity limit. A room counts as dry below the limit and stays dry until it is
 * HYSTERESIS above it, so a value wobbling around the limit does not make the notice come and go (and does not
 * forget its "done" mark every few minutes).
 */
export const HYSTERESIS = 3;

export interface RoomHumidity {
  name: string;
  /** relative humidity in percent, null when unknown */
  value: number | null;
}

/** The rooms that are dry now, given which were dry before. Unknown values keep the room's previous state. */
export function dryRooms(rooms: RoomHumidity[], min: number, before: ReadonlySet<string>): Set<string> {
  const dry = new Set<string>();
  if (!(min > 0)) return dry;
  for (const r of rooms) {
    if (r.value === null || !Number.isFinite(r.value) || r.value <= 0) {
      if (before.has(r.name)) dry.add(r.name);
    } else if (r.value < min || (before.has(r.name) && r.value < min + HYSTERESIS)) {
      dry.add(r.name);
    }
  }
  return dry;
}
