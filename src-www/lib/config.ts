/**
 * The dashboard configuration, as the admin page stores it in the instance object (`native`).
 *
 * Everything the dashboard shows comes from here: no datapoint is written into the code. The admin tables are
 * flat (one row per room, per light device, per shutter); this module turns them into the shape the tiles use.
 */

export type WindowMode = "contact" | "handle" | "text";
export type ConfirmMode = "all" | "bulk";
export type ThemeMode = "auto" | "light" | "dark";

export interface RoomRow {
  name: string;
  floor?: string;
  temperature?: string;
  setpoint?: string;
  humidity?: string;
  heating?: string;
  window?: string;
  windowMode?: WindowMode;
}

export interface LightRow {
  name: string;
  room?: string;
  on: string;
  level?: string;
  levelMax?: number;
  reachable?: string;
}

export interface ShutterRow {
  room: string;
  name?: string;
  position: string;
  max?: number;
  closedAt?: "max" | "min";
}

export interface RawConfig {
  title?: string;
  confirmWrites?: ConfirmMode;
  theme?: ThemeMode;
  rooms?: RoomRow[];
  lights?: LightRow[];
  shutters?: ShutterRow[];
}

/** One lamp as the user sees it; it may switch several devices at once. */
export interface Lamp {
  key: string;
  name: string;
  room: string;
  devices: { on: string; level?: string; levelMax: number; reachable?: string }[];
}

export interface Shutter {
  key: string;
  name: string;
  position: string;
  max: number;
  closedAt: "max" | "min";
}

export interface Room {
  name: string;
  floor: string;
  temperature?: string;
  setpoint?: string;
  humidity?: string;
  heating?: string;
  window?: string;
  windowMode: WindowMode;
  lamps: Lamp[];
  shutters: Shutter[];
}

export interface Config {
  title: string;
  confirmWrites: ConfirmMode;
  theme: ThemeMode;
  /** Floors in the order they first appear in the room list; "" means no floor given. */
  floors: { name: string; rooms: Room[] }[];
  rooms: Room[];
  /** Lamps whose room is not in the room list. */
  otherLamps: Lamp[];
  lamps: Lamp[];
}

const id = (s: unknown): string | undefined => {
  const v = typeof s === "string" ? s.trim() : "";
  return v ? v : undefined;
};
const text = (s: unknown): string => (typeof s === "string" ? s.trim() : "");
const positive = (n: unknown, fallback: number): number => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function buildConfig(raw: RawConfig | null | undefined): Config {
  const r = raw ?? {};

  const lampMap = new Map<string, Lamp>();
  for (const row of r.lights ?? []) {
    const on = id(row?.on);
    const name = text(row?.name);
    if (!on || !name) continue;
    const room = text(row.room);
    const key = `${room}\u0000${name}`;
    let lamp = lampMap.get(key);
    if (!lamp) {
      lamp = { key: `lamp-${lampMap.size}`, name, room, devices: [] };
      lampMap.set(key, lamp);
    }
    lamp.devices.push({ on, level: id(row.level), levelMax: positive(row.levelMax, 100), reachable: id(row.reachable) });
  }
  const lamps = [...lampMap.values()];

  const rooms: Room[] = [];
  for (const row of r.rooms ?? []) {
    const name = text(row?.name);
    if (!name || rooms.some((x) => x.name === name)) continue;
    rooms.push({
      name,
      floor: text(row.floor),
      temperature: id(row.temperature),
      setpoint: id(row.setpoint),
      humidity: id(row.humidity),
      heating: id(row.heating),
      window: id(row.window),
      windowMode: row.windowMode === "handle" || row.windowMode === "text" ? row.windowMode : "contact",
      lamps: lamps.filter((l) => l.room === name),
      shutters: [],
    });
  }

  let n = 0;
  for (const row of r.shutters ?? []) {
    const position = id(row?.position);
    const room = rooms.find((x) => x.name === text(row?.room));
    if (!position || !room) continue;
    room.shutters.push({
      key: `shutter-${n++}`,
      name: text(row.name),
      position,
      max: positive(row.max, 100),
      closedAt: row.closedAt === "min" ? "min" : "max",
    });
  }

  const floors: Config["floors"] = [];
  for (const room of rooms) {
    let f = floors.find((x) => x.name === room.floor);
    if (!f) floors.push((f = { name: room.floor, rooms: [] }));
    f.rooms.push(room);
  }

  return {
    title: text(r.title),
    confirmWrites: r.confirmWrites === "bulk" ? "bulk" : "all",
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : "auto",
    floors,
    rooms,
    otherLamps: lamps.filter((l) => !rooms.some((x) => x.name === l.room)),
    lamps,
  };
}

/** Every datapoint the dashboard needs to read, without duplicates. */
export function datapoints(c: Config): string[] {
  const ids = new Set<string>();
  const add = (s?: string) => s && ids.add(s);
  for (const r of c.rooms) {
    [r.temperature, r.setpoint, r.humidity, r.heating, r.window].forEach(add);
    r.shutters.forEach((s) => add(s.position));
  }
  for (const l of c.lamps) for (const d of l.devices) [d.on, d.level, d.reachable].forEach(add);
  return [...ids];
}
