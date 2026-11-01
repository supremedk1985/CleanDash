/**
 * How raw ioBroker values become what a tile shows. Pure functions, so every adapter quirk is testable.
 *
 * A missing value (datapoint not configured, not yet received, or null) is always `null` here, never 0:
 * a dashboard that shows "0.0°" or "light off" for "I don't know" is worse than one that shows a dash.
 */
import type { Lamp, Shutter, WindowMode } from "./config";

export type Values = Record<string, unknown>;
export type WindowState = "open" | "tilted" | "closed";

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function truthy(v: unknown): boolean {
  if (typeof v === "string") return ["true", "on", "1", "open", "yes"].includes(v.trim().toLowerCase());
  return v === true || (typeof v === "number" && v !== 0);
}

export function windowState(v: unknown, mode: WindowMode): WindowState | null {
  if (v === null || v === undefined) return null;
  // Texts are understood in every mode: some contacts report "OPEN" although they were set up as a contact.
  if (typeof v === "string" && Number.isNaN(Number(v))) {
    const s = v.trim().toUpperCase();
    if (s === "OPEN" || s === "OPENED") return "open";
    if (s === "TILTED") return "tilted";
    if (s === "CLOSED") return "closed";
    if (mode === "text") return null;
  }
  if (mode === "handle") {
    const n = num(v);
    if (n === null) return null;
    return n >= 2 ? "open" : n >= 1 ? "tilted" : "closed";
  }
  return truthy(v) ? "open" : "closed";
}

/** Shutter position as "percent closed" (0 = open, 100 = closed), whatever the device calls it. */
export function shutterClosed(v: unknown, s: Pick<Shutter, "max" | "closedAt">): number | null {
  const n = num(v);
  if (n === null) return null;
  const p = Math.max(0, Math.min(100, (n / s.max) * 100));
  return Math.round(s.closedAt === "max" ? p : 100 - p);
}

/** The raw value to write for "percent closed". */
export function shutterRaw(closed: number, s: Pick<Shutter, "max" | "closedAt">): number {
  const p = Math.max(0, Math.min(100, closed));
  const share = s.closedAt === "max" ? p : 100 - p;
  return Math.round((share / 100) * s.max * 100) / 100;
}

export interface LampState {
  on: boolean | null;
  /** 0–100, null when the lamp cannot be dimmed or the value is unknown */
  level: number | null;
  dimmable: boolean;
  reachable: boolean;
}

/** A lamp made of several devices is on when any device is on; its brightness is the mean of the ones that are on. */
export function lampState(l: Lamp, values: Values): LampState {
  let known = false;
  let on = false;
  let reachable = false;
  const levels: number[] = [];
  for (const d of l.devices) {
    const raw = values[d.on];
    if (raw !== undefined && raw !== null) known = true;
    const dOn = truthy(raw);
    // an empty "reachable" datapoint (null) says nothing; only an explicit false counts as unreachable
    const r = d.reachable ? values[d.reachable] : undefined;
    const dReach = d.reachable ? r === undefined || r === null || truthy(r) : raw !== undefined;
    if (dReach) reachable = true;
    if (dOn) {
      on = true;
      const lv = d.level ? num(values[d.level]) : null;
      if (lv !== null) levels.push(Math.max(0, Math.min(100, Math.round((lv / d.levelMax) * 100))));
    }
  }
  const dimmable = l.devices.some((d) => d.level);
  const level = dimmable && on && levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  return { on: known ? on : null, level, dimmable, reachable };
}

/** Brightness 0–100 → raw value. Never 0: many lamps treat 0 as invalid; switching off goes through on/off. */
export function levelRaw(percent: number, levelMax: number): number {
  const p = Math.max(1, Math.min(100, Math.round(percent)));
  return Math.round((p / 100) * levelMax);
}

export function roomLight(lamps: Lamp[], states: Record<string, LampState>) {
  const on = lamps.filter((l) => states[l.key]?.on);
  const levels = on.map((l) => states[l.key]?.level).filter((x): x is number => typeof x === "number");
  const level = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : on.length ? 100 : 0;
  return { on: on.length, of: lamps.length, level };
}

/** Setpoints move in 0.5 steps between 5 and 30 °C, the range almost every thermostat accepts. */
export function clampSetpoint(v: number): number {
  return Math.min(30, Math.max(5, Math.round(v * 2) / 2));
}
