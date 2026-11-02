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
  weatherInstance?: string;
  weatherHourly?: boolean;
  trashInstance?: string;
  dishwasherDevice?: string;
  energySolar?: string;
  energyConsumption?: string;
  energyGridImport?: string;
  energyGridExport?: string;
  energyBatteryLevel?: string;
  energyBatteryCharge?: string;
  energyBatteryDischarge?: string;
  energySolarToday?: string;
  energyConsumptionToday?: string;
  energyGridToday?: string;
  energySavings?: string;
  energyTotal?: string;
  energySolarMax?: number;
  energyHomeMax?: number;
  energyTitle?: string;
  energyHistoryUrl?: string;
  shoppingLists?: { name?: string; content?: string }[];
  // kitchen tiles (each shown only when set up)
  aufgabenUrl?: string;
  fundusUrl?: string;
  speedtestUrl?: string;
  fuelInstance?: string;
  printerInstance?: string;
  printerWebcamUrl?: string;
  paperlessCount?: string;
  mowerDevice?: string;
  vacuumDevice?: string;
  f25Prefix?: string;
  /** Name of the second robot in its reminder, e.g. "Der Wischsauger" */
  f25Name?: string;
  dehumidifierDevice?: string;
  callDatapoint?: string;
  callLabel?: string;
  showSettingsPanel?: boolean;
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

export interface Energy {
  solar?: string;
  consumption?: string;
  gridImport?: string;
  gridExport?: string;
  batteryLevel?: string;
  batteryCharge?: string;
  batteryDischarge?: string;
  solarToday?: string;
  consumptionToday?: string;
  gridToday?: string;
  /** money saved so far (€) and energy produced so far (kWh) */
  savings?: string;
  total?: string;
  /** full ring for solar and house, in watts */
  solarMax: number;
  homeMax: number;
  title: string;
  /** folder with day/week/month/year files for the history dialog (docs/energy-history.md) */
  historyUrl?: string;
}

/** Datapoints of the openweathermap adapter (forecast.current, forecast.day0–5, forecast.period0–7). */
export interface Weather {
  base: string;
}

/** The trashschedule adapter: next pickup and the one after. */
export interface Trash {
  instance: string;
}

/** A Home Connect dishwasher (homeconnect adapter), by its device id. */
export interface Dishwasher {
  base: string;
}

/** A Bring! list (bring adapter), by its content datapoint. */
export interface ShoppingList {
  key: string;
  name: string;
  content: string;
  recent: string;
  add: string;
  remove: string;
}

export interface Config {
  title: string;
  weather?: Weather;
  /** hourly rain and temperature from Open-Meteo (internet) */
  weatherHourly: boolean;
  energy?: Energy;
  trash?: Trash;
  dishwasher?: Dishwasher;
  shoppingLists: ShoppingList[];
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

  const energy: Energy = {
    solar: id(r.energySolar),
    consumption: id(r.energyConsumption),
    gridImport: id(r.energyGridImport),
    gridExport: id(r.energyGridExport),
    batteryLevel: id(r.energyBatteryLevel),
    batteryCharge: id(r.energyBatteryCharge),
    batteryDischarge: id(r.energyBatteryDischarge),
    solarToday: id(r.energySolarToday),
    consumptionToday: id(r.energyConsumptionToday),
    gridToday: id(r.energyGridToday),
    savings: id(r.energySavings),
    total: id(r.energyTotal),
    solarMax: positive(r.energySolarMax, 2700),
    homeMax: positive(r.energyHomeMax, 1300),
    title: text(r.energyTitle),
    historyUrl: id(r.energyHistoryUrl)?.replace(/\/+$/, ""),
  };
  const energyIds = [energy.solar, energy.consumption, energy.gridImport, energy.gridExport, energy.batteryLevel, energy.batteryCharge,
    energy.batteryDischarge, energy.solarToday, energy.consumptionToday, energy.gridToday, energy.savings, energy.total];
  // the admin's instance picker may store "system.adapter.x.0" or "x.0"
  const instance = (s: unknown) => id(s)?.replace(/^system\.adapter\./, "");
  const weatherBase = instance(r.weatherInstance);
  const trashInstance = instance(r.trashInstance);
  const dishwasherBase = id(r.dishwasherDevice);
  const shoppingLists: ShoppingList[] = [];
  for (const row of r.shoppingLists ?? []) {
    const content = id(row?.content);
    if (!content || !content.endsWith(".content")) continue;
    const base = content.slice(0, -".content".length);
    shoppingLists.push({ key: `list-${shoppingLists.length}`, name: text(row.name), content, recent: `${base}.recentContent`, add: `${base}.saveItemTranslated`, remove: `${base}.removeItemTranslated` });
  }

  return {
    title: text(r.title),
    weatherHourly: r.weatherHourly === true,
    weather: weatherBase ? { base: weatherBase.replace(/\.forecast.*$/, "") } : undefined,
    energy: energyIds.some(Boolean) ? energy : undefined,
    trash: trashInstance ? { instance: trashInstance } : undefined,
    dishwasher: dishwasherBase ? { base: dishwasherBase } : undefined,
    shoppingLists,
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
  if (c.energy) {
    const e = c.energy;
    [e.solar, e.consumption, e.gridImport, e.gridExport, e.batteryLevel, e.batteryCharge, e.batteryDischarge,
      e.solarToday, e.consumptionToday, e.gridToday, e.savings, e.total].forEach(add);
  }
  if (c.weather) weatherIds(c.weather).forEach(add);
  if (c.trash) trashIds(c.trash).forEach(add);
  if (c.dishwasher) Object.values(dishwasherIds(c.dishwasher)).forEach(add);
  for (const l of c.shoppingLists) [l.content, l.recent].forEach(add);
  return [...ids];
}

export const WEATHER_DAYS = 6;
export const WEATHER_PERIODS = 8;
const CURRENT = ["temperature", "state", "icon", "windSpeed", "windGust", "humidity", "pressure", "sunrise", "sunset"];
const DAY = ["date", "temperatureMax", "temperatureMin", "windSpeed", "state", "precipitation", "title", "icon", "humidity", "pressure"];
const PERIOD = ["date", "temperatureMax", "precipitation", "icon"];

export function weatherIds(w: Weather): string[] {
  const f = `${w.base}.forecast`;
  return [
    ...CURRENT.map((k) => `${f}.current.${k}`),
    ...Array.from({ length: WEATHER_DAYS }, (_, i) => DAY.map((k) => `${f}.day${i}.${k}`)).flat(),
    ...Array.from({ length: WEATHER_PERIODS }, (_, i) => PERIOD.map((k) => `${f}.period${i}.${k}`)).flat(),
  ];
}

export function trashIds(t: Trash): string[] {
  return ["next.daysLeft", "next.types", "nextAfter.daysLeft", "nextAfter.types"].map((k) => `${t.instance}.${k}`);
}

export function dishwasherIds(d: Dishwasher) {
  return {
    state: `${d.base}.status.BSH_Common_Status_OperationState`,
    progress: `${d.base}.programs.active.options.BSH_Common_Option_ProgramProgress`,
    remaining: `${d.base}.programs.active.options.BSH_Common_Option_RemainingProgramTime`,
    connected: `${d.base}.general.connected`,
  };
}

/** The adapter instance a device belongs to: "navimow.1.ABC" → "navimow.1" (for its info.connection). */
export function instanceOf(deviceId: string): string {
  return deviceId.split(".").slice(0, 2).join(".");
}
