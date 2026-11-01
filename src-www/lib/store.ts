/**
 * The dashboard's state: configuration, current values, connection. Tiles read from here and write through
 * `ask()`, which goes through the confirmation dialog when the configuration asks for one.
 */
import { computed, reactive, ref } from "vue";
import { buildConfig, datapoints, type Config, type Lamp, type RawConfig, type Room, type Shutter } from "./config";
import { clampSetpoint, lampState, levelRaw, shutterRaw, type LampState } from "./values";
import { chooseSource, type Source } from "./source";
import { itemText, trashColors, type Item } from "./tiles";
import type { ShoppingList } from "./config";
import { setLanguage, t } from "./i18n";
import { isDarkAt } from "./sun";

export const values = reactive<Record<string, unknown>>({});
export const config = ref<Config | null>(null);
export const connected = ref(true);
export const lastContact = ref<Date | null>(null);
export const loading = ref(true);
export const demo = ref(false);
/** true while the dark theme is shown (charts pick their colours from it) */
export const isDark = ref(false);
export const errorText = ref<string | null>(null);
/** trashschedule colours by type name */
export const trashColorMap = ref<Record<string, string>>({});

let source: Source;
/** the configuration exactly as stored, for tiles that read their own settings */
export const rawConfig = ref<RawConfig>({});
/** Run when the configuration is known, before any tile is shown (kitchen tiles set themselves up here). */
export const onConfig: ((raw: RawConfig) => void)[] = [];

export function getSource(): Source {
  return source;
}
/** location from the ioBroker system settings (sunrise/sunset, hourly weather) */
export const location = ref<{ latitude?: number; longitude?: number }>({});

export const lampStates = computed<Record<string, LampState>>(() => {
  const out: Record<string, LampState> = {};
  for (const l of config.value?.lamps ?? []) out[l.key] = lampState(l, values);
  return out;
});

export async function start() {
  source = chooseSource();
  demo.value = source.demo;
  source.onConnection((c) => {
    connected.value = c;
    if (c) lastContact.value = new Date();
  });
  try {
    const [raw, sys] = await Promise.all([source.loadConfig(), source.systemInfo()]);
    setLanguage(sys.language);
    location.value = { latitude: sys.latitude, longitude: sys.longitude };
    rawConfig.value = raw;
    config.value = buildConfig(raw);
    for (const f of onConfig) f(raw);
    applyTheme();
    setInterval(() => applyTheme(), 60_000);
    if (config.value.trash) {
      source.readNative(`system.adapter.${config.value.trash.instance}`).then((n) => (trashColorMap.value = trashColors(n)), () => undefined);
    }
    await source.watch(datapoints(config.value), (id, v) => {
      values[id] = v;
      lastContact.value = new Date();
    });
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

/** `force` comes from the switch in the settings panel; otherwise: a stored manual choice, then the setting. */
export function applyTheme(force?: boolean) {
  const mode = config.value?.theme ?? "auto";
  let manual: boolean | null = null;
  try { const v = localStorage.getItem("darkMode"); manual = v === "1" ? true : v === "0" ? false : null; } catch { /* blocked */ }
  let dark: boolean;
  if (typeof force === "boolean") dark = force;
  else if (manual !== null) dark = manual;
  else if (mode === "dark") dark = true;
  else if (mode === "light") dark = false;
  else if (location.value.latitude !== undefined && location.value.longitude !== undefined) dark = isDarkAt(new Date(), location.value.latitude, location.value.longitude);
  else dark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  isDark.value = dark;
}

// --- writing, always behind a question when the configuration wants one ---------------------------

export interface Question {
  text: string;
  detail?: string;
  run: () => Promise<void>;
}
export const question = ref<Question | null>(null);

/** `bulk` marks actions that switch several devices; with confirmWrites "bulk" only those ask. */
export function ask(q: Question, bulk = false) {
  const mode = config.value?.confirmWrites ?? "all";
  if (mode === "all" || bulk) question.value = q;
  else void perform(q.run);
}

export async function answer(yes: boolean) {
  const q = question.value;
  question.value = null;
  if (yes && q) await perform(q.run);
}

async function perform(run: () => Promise<void>) {
  try {
    await run();
    errorText.value = null;
  } catch (e) {
    errorText.value = t("writeFailed", { error: e instanceof Error ? e.message : String(e) });
  }
}

/** Shows the new value at once; the next change from ioBroker confirms or corrects it. */
async function put(id: string, value: string | number | boolean) {
  values[id] = value;
  await source.write(id, value);
}

export async function switchLamp(l: Lamp, on: boolean) {
  await Promise.all(l.devices.map((d) => put(d.on, on)));
}

export async function dimLamp(l: Lamp, percent: number) {
  await Promise.all(
    l.devices.map(async (d) => {
      // many lamps do not switch on when dimmed: on first, then the level
      await put(d.on, true);
      if (d.level) await put(d.level, levelRaw(percent, d.levelMax));
    }),
  );
}

export async function switchLamps(lamps: Lamp[], on: boolean) {
  const todo = lamps.filter((l) => (lampStates.value[l.key]?.on ?? !on) !== on);
  await Promise.all(todo.map((l) => switchLamp(l, on)));
}

export async function moveShutter(s: Shutter, closedPercent: number) {
  await put(s.position, shutterRaw(closedPercent, s));
}

export async function setSetpoint(r: Room, v: number) {
  if (r.setpoint) await put(r.setpoint, clampSetpoint(v));
}

export async function addItem(l: ShoppingList, i: Item) {
  await source.write(l.add, itemText(i));
}

export async function removeItem(l: ShoppingList, i: Item) {
  await source.write(l.remove, i.name);
}
