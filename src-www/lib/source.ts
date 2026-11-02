/**
 * Where the values come from. In ioBroker it is the socket of the web adapter, with ioBroker's own login and
 * user rights. Without ioBroker (development, screenshots, the README demo) it is a made-up house.
 */
import { Connection } from "@iobroker/socket-client";
import type { RawConfig } from "./config";
import { DEMO_NATIVE, DEMO_VALUES, demoConfig } from "./demo";

export interface SystemInfo {
  language?: string;
  latitude?: number;
  longitude?: number;
}

export interface Source {
  readonly demo: boolean;
  loadConfig(): Promise<RawConfig>;
  systemInfo(): Promise<SystemInfo>;
  /** Initial values plus every later change; returns when the initial values are in. */
  watch(ids: string[], onValue: (id: string, value: unknown) => void): Promise<void>;
  write(id: string, value: string | number | boolean): Promise<void>;
  /** Recorded values from the default history adapter: [value, ms] per datapoint, optionally averaged per step (ms). */
  history(ids: string[], from: number, to: number, step?: number): Promise<Record<string, [unknown, number][]>>;
  /** One-off read of several states (value or null each). */
  read(ids: string[]): Promise<Record<string, unknown>>;
  /** The native part of an object, e.g. the settings of another adapter instance. */
  readNative(id: string): Promise<unknown>;
  onConnection(handler: (connected: boolean) => void): void;
  /** State that holds the "done" marks of the notices for all dashboards of this instance (none in the demo). */
  readonly doneId?: string;
}

export class IoBrokerSource implements Source {
  readonly demo = false;
  private conn: Connection;
  private ready: Promise<void>;

  readonly doneId: string;

  constructor(private instance: number) {
    this.doneId = `cleandash.${instance}.notices.done`;
    this.conn = new Connection({ name: `cleandash.${instance}`, port: globalThis.location.port, doNotLoadAllObjects: true });
    this.ready = this.conn.waitForFirstConnection();
  }

  async loadConfig(): Promise<RawConfig> {
    await this.ready;
    const obj = await this.conn.getObject(`system.adapter.cleandash.${this.instance}`);
    return ((obj as { native?: RawConfig } | null | undefined)?.native ?? {}) as RawConfig;
  }

  async systemInfo(): Promise<SystemInfo> {
    await this.ready;
    const sys = await this.conn.getSystemConfig();
    const c = (sys?.common ?? {}) as { language?: string; latitude?: string | number; longitude?: string | number };
    const lat = Number(c.latitude);
    const lon = Number(c.longitude);
    return {
      language: c.language,
      latitude: Number.isFinite(lat) && c.latitude !== "" ? lat : undefined,
      longitude: Number.isFinite(lon) && c.longitude !== "" ? lon : undefined,
    };
  }

  async watch(ids: string[], onValue: (id: string, value: unknown) => void): Promise<void> {
    if (!ids.length) return;
    await this.ready;
    const states = await this.conn.getStates(ids);
    for (const id of ids) onValue(id, states?.[id]?.val ?? null);
    await this.conn.subscribeState(ids, (id: string, state: ioBroker.State | null | undefined) => onValue(id, state?.val ?? null));
  }

  async write(id: string, value: string | number | boolean): Promise<void> {
    await this.ready;
    await this.conn.setState(id, value);
  }

  async history(ids: string[], from: number, to: number, step?: number): Promise<Record<string, [unknown, number][]>> {
    await this.ready;
    const out: Record<string, [unknown, number][]> = {};
    await Promise.all(ids.map(async (id) => {
      const r = (await this.conn.getHistory(id, {
        start: from, end: to, aggregate: step ? "average" : "none", ...(step ? { step } : {}), ignoreNull: true, from: false, ack: false, q: false,
      } as ioBroker.GetHistoryOptions)) as unknown as { val: unknown; ts: number }[] | { values?: { val: unknown; ts: number }[] };
      const list = Array.isArray(r) ? r : r?.values ?? [];
      out[id] = list.map((p) => [p.val, p.ts]);
    }));
    return out;
  }

  async read(ids: string[]): Promise<Record<string, unknown>> {
    if (!ids.length) return {};
    await this.ready;
    const states = await this.conn.getStates(ids);
    const out: Record<string, unknown> = {};
    for (const id of ids) out[id] = states?.[id]?.val ?? null;
    return out;
  }

  async readNative(id: string): Promise<unknown> {
    await this.ready;
    const obj = await this.conn.getObject(id);
    return (obj as { native?: unknown } | null | undefined)?.native ?? null;
  }

  onConnection(handler: (connected: boolean) => void): void {
    this.conn.registerConnectionHandler(handler);
  }
}

/** A made-up house that answers like ioBroker: writes arrive a moment later as changes. */
export class DemoSource implements Source {
  readonly demo = true;
  private values = new Map<string, unknown>(Object.entries(DEMO_VALUES));
  private listeners: ((id: string, value: unknown) => void)[] = [];

  private lang = navigator.language?.startsWith("de") ? "de" : "en";

  async loadConfig(): Promise<RawConfig> {
    return demoConfig(this.lang);
  }

  async systemInfo(): Promise<SystemInfo> {
    // a made-up place in central Germany, for sunrise/sunset and the hourly forecast
    return { language: this.lang, latitude: 51.0, longitude: 10.0 };
  }

  async watch(ids: string[], onValue: (id: string, value: unknown) => void): Promise<void> {
    for (const id of ids) onValue(id, this.values.has(id) ? this.values.get(id) : null);
    this.listeners.push(onValue);
  }

  async write(id: string, value: string | number | boolean): Promise<void> {
    // the bring adapter's commands change the list, like the real adapter does a moment later
    const m = /^(.*)\.(saveItemTranslated|removeItemTranslated)$/.exec(id);
    if (m) {
      const contentId = `${m[1]}.content`;
      const list = JSON.parse(String(this.values.get(contentId) ?? "[]")) as { name: string; specification?: string }[];
      const [name, ...spec] = String(value).split(",");
      const next = m[2] === "saveItemTranslated"
        ? [...list.filter((i) => i.name !== name.trim()), { name: name.trim(), specification: spec.join(",").trim() || undefined }]
        : list.filter((i) => i.name !== name.trim());
      id = contentId;
      value = JSON.stringify(next);
    }
    this.values.set(id, value);
    setTimeout(() => this.listeners.forEach((l) => l(id, value)), 300);
  }

  async history(ids: string[], from: number, to: number): Promise<Record<string, [unknown, number][]>> {
    // a made-up day: the value now and then, every 20 minutes, with some wobble
    const out: Record<string, [unknown, number][]> = {};
    for (const id of ids) {
      const v = this.values.get(id);
      const pts: [unknown, number][] = [];
      for (let t = from; t <= to; t += 20 * 60_000) pts.push([typeof v === "number" ? Math.max(0, v * (0.6 + 0.4 * Math.sin(t / 3.6e6))) : v ?? null, t]);
      out[id] = pts;
    }
    return out;
  }

  async read(ids: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const id of ids) out[id] = this.values.has(id) ? this.values.get(id) : null;
    return out;
  }

  async readNative(id: string): Promise<unknown> {
    return DEMO_NATIVE[id] ?? null;
  }

  onConnection(handler: (connected: boolean) => void): void {
    handler(true);
  }
}

export function chooseSource(): Source {
  const params = new URLSearchParams(globalThis.location.search);
  const g = globalThis as { io?: unknown; iob?: unknown };
  if (params.has("demo") || (!g.io && !g.iob)) return new DemoSource();
  const instance = Number(params.get("instance") ?? 0);
  return new IoBrokerSource(Number.isInteger(instance) && instance >= 0 ? instance : 0);
}
