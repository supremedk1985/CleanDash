/**
 * Pure interpretation for the adapter-based tiles (weather, trash, dishwasher, shopping list, energy).
 * Like values.ts: unknown stays null, adapter quirks live here and have tests.
 */
import {
  mdiWeatherCloudy, mdiWeatherFog, mdiWeatherLightningRainy, mdiWeatherNight, mdiWeatherNightPartlyCloudy,
  mdiWeatherPartlyCloudy, mdiWeatherPartlyRainy, mdiWeatherPouring, mdiWeatherRainy, mdiWeatherSnowy, mdiWeatherSunny,
} from "@mdi/js";
import { num, truthy, type Values } from "./values";

// --- weather (openweathermap adapter) ---------------------------------------------------------------

/** The adapter only gives an icon URL like ".../w/10d.png"; "10d" is the OpenWeatherMap code. */
export function owmCode(v: unknown): string {
  const m = typeof v === "string" ? /(\d\d[dn])(?:@\dx)?\.png$/.exec(v) : null;
  return m ? m[1] : "";
}

const ICONS: Record<string, string> = {
  "01d": mdiWeatherSunny, "01n": mdiWeatherNight,
  "02d": mdiWeatherPartlyCloudy, "02n": mdiWeatherNightPartlyCloudy,
  "03d": mdiWeatherCloudy, "03n": mdiWeatherCloudy, "04d": mdiWeatherCloudy, "04n": mdiWeatherCloudy,
  "09d": mdiWeatherPouring, "09n": mdiWeatherPouring,
  "10d": mdiWeatherPartlyRainy, "10n": mdiWeatherRainy,
  "11d": mdiWeatherLightningRainy, "11n": mdiWeatherLightningRainy,
  "13d": mdiWeatherSnowy, "13n": mdiWeatherSnowy,
  "50d": mdiWeatherFog, "50n": mdiWeatherFog,
};

export function weatherIcon(code: string): string {
  return ICONS[code] ?? mdiWeatherCloudy;
}

/** The adapter reports wind in m/s. */
export function kmh(ms: number | null): number | null {
  return ms === null ? null : Math.round(ms * 3.6);
}

export function time(v: unknown): Date | null {
  const n = num(v);
  return n === null || n <= 0 ? null : new Date(n < 1e12 ? n * 1000 : n);
}

// --- trash (trashschedule adapter) ---------------------------------------------------------------------

export interface Pickup {
  daysLeft: number;
  types: string[];
}

export function pickup(days: unknown, types: unknown): Pickup | null {
  const d = num(days);
  if (d === null || d < 0 || typeof types !== "string" || !types.trim()) return null;
  return { daysLeft: Math.round(d), types: types.split(",").map((s) => s.trim()).filter(Boolean) };
}

/** Colours as configured in the trashschedule instance (native.trashtypes[].color). */
export function trashColors(native: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const list = (native as { trashtypes?: { name?: unknown; color?: unknown }[] } | null)?.trashtypes;
  for (const t of Array.isArray(list) ? list : []) {
    if (typeof t?.name === "string" && typeof t.color === "string" && /^#[0-9a-f]{3,8}$/i.test(t.color)) out[t.name] = t.color;
  }
  return out;
}

// --- dishwasher (homeconnect adapter) --------------------------------------------------------------------

export type MachineState = "running" | "delayed" | "ready" | "finished" | "paused" | "error" | "off" | "unknown";

/** BSH.Common.EnumType.OperationState.<X> → what the tile shows */
export function machineState(v: unknown): MachineState {
  if (typeof v !== "string" || !v) return "unknown";
  const s = v.split(".").pop() ?? "";
  switch (s) {
    case "Run": return "running";
    case "DelayedStart": return "delayed";
    case "Ready": return "ready";
    case "Finished": return "finished";
    case "Pause": case "ActionRequired": return "paused";
    case "Error": case "Aborting": return "error";
    case "Inactive": return "off";
    default: return "unknown";
  }
}

export interface Machine {
  state: MachineState;
  connected: boolean;
  progress: number | null;
  /** seconds */
  remaining: number | null;
}

export function machine(values: Values, ids: { state: string; progress: string; remaining: string; connected: string }): Machine {
  const c = values[ids.connected];
  return {
    state: machineState(values[ids.state]),
    // no value says nothing; only an explicit false means the cloud lost the machine
    connected: c === undefined || c === null || truthy(c),
    progress: num(values[ids.progress]),
    remaining: num(values[ids.remaining]),
  };
}

export function hhmm(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}

// --- shopping list (bring adapter) -------------------------------------------------------------------------

export interface Item {
  name: string;
  specification?: string;
}

export function items(v: unknown): Item[] | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const l = JSON.parse(v);
    return Array.isArray(l)
      ? l.filter((e) => e && typeof e.name === "string").map((e) => ({ name: e.name, specification: typeof e.specification === "string" && e.specification ? e.specification : undefined }))
      : [];
  } catch {
    return [];
  }
}

/** What the adapter's saveItemTranslated expects: "Name" or "Name, specification". */
export function itemText(i: Item): string {
  return i.specification ? `${i.name}, ${i.specification}` : i.name;
}

/** "Milk 2 l" → name "Milk", specification "2 l": everything after the first comma is the specification. */
export function parseItem(input: string): Item | null {
  const t = input.trim();
  if (!t) return null;
  const i = t.indexOf(",");
  if (i < 0) return { name: t };
  const name = t.slice(0, i).trim();
  const specification = t.slice(i + 1).trim();
  return name ? { name, specification: specification || undefined } : null;
}

// --- energy --------------------------------------------------------------------------------------------------

/** Share of the day's consumption that came from the grid, in percent; null when it cannot be said. */
export function gridShare(consumption: number | null, grid: number | null): number | null {
  if (consumption === null || grid === null || consumption <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (grid / consumption) * 100)));
}
