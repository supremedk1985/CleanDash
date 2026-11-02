/**
 * Notices: things that want attention appear as banners at the top of the page, not hidden inside a tile.
 *
 * Every tile can contribute through `noticeSources`; a notice is derived from the current values, so it goes away
 * by itself when the cause is gone. Dismissing hides it until its text changes (a new cause is a new notice).
 */
import { computed, ref, watch, type ComputedRef } from "vue";
import { config, lampStates, sharedDoneId, trashColorMap, values, writeShared } from "./store";
import { num, truthy, windowState } from "./values";
import { dishwasherIds, trashIds } from "./config";
import { machine, pickup } from "./tiles";
import { maeherMeldungen, navimow } from "../features/navimow";
import { f25, f25Meldungen, roborock, stationsMeldungen } from "../features/roborock";
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
/** The robot mower asks for help: fault, lifted, stuck, no position (the kitchen tile's former pop-up). */
const mowerNotices = computed<Notice[]>(() =>
  maeherMeldungen(navimow.value).map((m) => ({
    key: `mower:${m.schluessel}`, level: "alert", eyebrow: t("mower"), title: t("mowerHelp"), detail: m.text,
    color: "#f08a4b", icon: `mdi ${m.icon}`, done: true,
  })),
);

/** The vacuum's station (tanks, bag, filter) and the second robot's self-cleaning (former pop-up of the tile). */
const vacuumNotices = computed<Notice[]>(() => [
  ...(roborock.value ? stationsMeldungen(roborock.value) : []).map((m): Notice => ({
    key: `vacuum:${m.schluessel}`, level: "alert", eyebrow: t("vacuum"), title: m.text, color: "#f08a4b", icon: `mdi ${m.icon}`, done: true,
  })),
  ...f25Meldungen(f25.value).map((m): Notice => ({
    key: `vacuum:${m.schluessel}`, level: "alert", eyebrow: "F25 Ultra", title: m.text, color: "#f08a4b", icon: `mdi ${m.icon}`, done: true,
  })),
]);

/**
 * Sources of notices. `ready` says whether the source knows its state yet: only then are "done" marks of causes that
 * are gone forgotten, so the same problem announces itself again next time (and a reload right after start, before
 * the first values arrive, does not bring back what was already done).
 * Lamps that are not reachable are not announced; unreachableLamps stays for a later setting.
 */
export const noticeSources: { prefix: string; ready: () => boolean; list: ComputedRef<Notice[]> }[] = [
  // both days AND types: with only one of them known there is no notice yet, and the done mark must not be forgotten
  { prefix: "trash:", ready: () => !!config.value?.trash && trashIds(config.value.trash).slice(0, 2).every((id) => values[id] !== undefined && values[id] !== null), list: binDay },
  { prefix: "window-heating:", ready: () => true, list: heatingWithOpenWindow },
  { prefix: "dishwasher:", ready: () => !!config.value?.dishwasher && values[dishwasherIds(config.value.dishwasher).state] !== undefined, list: dishwasherNotices },
  { prefix: "mower:", ready: () => !!navimow.value.zustand, list: mowerNotices },
  { prefix: "vacuum:", ready: () => !!roborock.value, list: vacuumNotices },
];
void unreachableLamps;

/** A notice can be put on snooze for a few minutes; then it comes back if its cause is still there. "Done" hides it
 *  until its cause changes (a new key). The marks live in the state `cleandash.<n>.notices.done` (JSON), so every
 *  dashboard of the house knows that the bin is already out, and a reload or a browser that forgets its storage does
 *  not bring it back; without that state (demo, older instance) they stay in this browser's localStorage. */
export const SNOOZE_MS = 5 * 60_000;
const DONE_KEY = "cleandash.done";
const snoozed = ref<Record<string, number>>({});
const local = ref<Record<string, true>>(loadDone());
/** the shared marks, or null while that state is unknown */
const shared = computed<Record<string, true> | null>(() => {
  const raw = sharedDoneId.value ? values[sharedDoneId.value] : undefined;
  if (raw === undefined) return null;
  try {
    const o = typeof raw === "string" && raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch { return {}; }
});
const done = computed(() => shared.value ?? local.value);
const now = ref(Date.now());
if (typeof window !== "undefined") window.setInterval(() => (now.value = Date.now()), 10_000);

function loadDone(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}"); } catch { return {}; }
}

const active = computed(() => noticeSources.flatMap((s) => s.list.value));

export const notices = computed(() => active.value.filter((n) => !done.value[n.key] && (snoozed.value[n.key] ?? 0) <= now.value));

/** Forget "done" for causes that are gone, per source that knows its state. */
watch(active, (list) => {
  const keys = new Set(list.map((n) => n.key));
  let changed = false;
  const next = { ...done.value };
  for (const k of Object.keys(next)) {
    const src = noticeSources.find((s) => k.startsWith(s.prefix));
    if (src && src.ready() && !keys.has(k)) { delete next[k]; changed = true; }
  }
  if (changed) saveDone(next);
});

function saveDone(next: Record<string, true>) {
  local.value = next;
  try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* only for this page */ }
  if (sharedDoneId.value && shared.value !== null) void writeShared(sharedDoneId.value, JSON.stringify(next));
}

export function snooze(n: Notice, ms = SNOOZE_MS) {
  now.value = Date.now();
  snoozed.value = { ...snoozed.value, [n.key]: now.value + ms };
}

export function dismiss(n: Notice) {
  saveDone({ ...done.value, [n.key]: true });
}
