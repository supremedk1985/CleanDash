/**
 * Notices: things that want attention appear as banners at the top of the page, not hidden inside a tile.
 *
 * Every tile can contribute through `noticeSources`; a notice is derived from the current values, so it goes away
 * by itself when the cause is gone. Dismissing hides it until its text changes (a new cause is a new notice).
 */
import { computed, ref, type ComputedRef } from "vue";
import { config, lampStates, trashColorMap, values } from "./store";
import { num, truthy, windowState } from "./values";
import { dishwasherIds, trashIds } from "./config";
import { machine, pickup } from "./tiles";
import { t } from "./i18n";

export interface Notice {
  /** stable per cause, e.g. "window-heating:Kitchen" */
  key: string;
  level: "alert" | "info";
  /** small line above the title (what it is about), the title, and a line below */
  eyebrow?: string;
  title: string;
  detail?: string;
  /** colour of the frame and the symbol; an MDI icon class, or a bin in that colour with a word on it */
  color?: string;
  icon?: string;
  bin?: { label: string };
  /** offers "Done" besides the snooze: the notice then stays away until its cause changes */
  done?: boolean;
}

const heatingWithOpenWindow = computed<Notice[]>(() =>
  (config.value?.rooms ?? []).flatMap((r): Notice[] => {
    if (!r.window || !r.heating) return [];
    const w = windowState(values[r.window], r.windowMode);
    const h = values[r.heating];
    if ((w !== "open" && w !== "tilted") || !(truthy(h) || (num(h) ?? 0) > 0)) return [];
    return [{
      key: `window-heating:${r.name}`, level: "alert", eyebrow: r.name, title: t(w === "open" ? "windowOpen" : "windowTilted"),
      detail: t("heatingRuns"), color: "#f08a4b", icon: "mdi mdi-window-open-variant",
    }];
  }),
);

const unreachableLamps = computed<Notice[]>(() => {
  const names = (config.value?.lamps ?? [])
    .filter((l) => lampStates.value[l.key] && !lampStates.value[l.key].reachable)
    .map((l) => (l.room ? `${l.name} (${l.room})` : l.name));
  return names.length ? [{ key: "unreachable", level: "info", title: t("noticeUnreachable", { lamps: names.join(", ") }) }] : [];
});

const binDay = computed<Notice[]>(() => {
  const tr = config.value?.trash;
  if (!tr) return [];
  const [days, types] = trashIds(tr);
  const p = pickup(values[days], values[types]);
  if (!p || p.daysLeft > 1) return [];
  const color = trashColorMap.value[p.types[0]] ?? "#9ca3af";
  return [{
    key: `trash:${p.daysLeft}:${p.types.join(",")}`, level: "alert", eyebrow: t("trash"), title: p.types.join(", "),
    detail: t(p.daysLeft === 0 ? "trashToday" : "trashTomorrow"), color,
    bin: { label: (p.daysLeft === 0 ? t("today") : t("tomorrow")).toUpperCase() }, done: true,
  }];
});

const dishwasherNotices = computed<Notice[]>(() => {
  const dw = config.value?.dishwasher;
  if (!dw) return [];
  const m = machine(values, dishwasherIds(dw));
  const base = { key: "dishwasher", eyebrow: t("dishwasher"), icon: "mdi mdi-dishwasher" };
  if (!m.connected) return [{ ...base, key: "dishwasher:offline", level: "info", title: t("dwNoCloud"), color: "#94a3b8", icon: "mdi mdi-cloud-off-outline" }];
  if (m.state === "finished") return [{ ...base, key: "dishwasher:finished", level: "info", title: t("dwFinished"), detail: t("dwEmpty"), color: "#22c55e", done: true }];
  if (m.state === "paused") return [{ ...base, key: "dishwasher:paused", level: "alert", title: t("dwPaused"), color: "#f08a4b" }];
  if (m.state === "error") return [{ ...base, key: "dishwasher:error", level: "alert", title: t("dwError"), color: "#ef4444" }];
  return [];
});

/** Tiles add their own sources here (mower stuck, …). Order = order on screen. */
// Lamps that are not reachable are not announced (Daniel, 01.11.: "kann weg"); unreachableLamps stays for a later setting.
export const noticeSources: ComputedRef<Notice[]>[] = [binDay, heatingWithOpenWindow, dishwasherNotices];
void unreachableLamps;

/** A notice can be put on snooze for a few minutes; then it comes back if its cause is still there. "Done" hides it
 *  until its cause changes (a new key); that survives a reload where the browser allows storage. */
export const SNOOZE_MS = 5 * 60_000;
const DONE_KEY = "cleandash.done";
const snoozed = ref<Record<string, number>>({});
const done = ref<Record<string, true>>(loadDone());
const now = ref(Date.now());
if (typeof window !== "undefined") window.setInterval(() => (now.value = Date.now()), 10_000);

function loadDone(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}"); } catch { return {}; }
}

export const notices = computed(() =>
  noticeSources.flatMap((s) => s.value).filter((n) => !done.value[n.key] && (snoozed.value[n.key] ?? 0) <= now.value),
);

export function snooze(n: Notice, ms = SNOOZE_MS) {
  now.value = Date.now();
  snoozed.value = { ...snoozed.value, [n.key]: now.value + ms };
}

export function dismiss(n: Notice) {
  done.value = { ...done.value, [n.key]: true };
  try { localStorage.setItem(DONE_KEY, JSON.stringify(done.value)); } catch { /* only for this page */ }
}
