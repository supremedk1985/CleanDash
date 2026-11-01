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
  text: string;
  /** optional: a colour (e.g. the bin's) and an MDI icon class for the notice */
  color?: string;
  icon?: string;
  /** label of the dismiss button; without it the notice has an X */
  done?: string;
}

const heatingWithOpenWindow = computed<Notice[]>(() =>
  (config.value?.rooms ?? []).flatMap((r): Notice[] => {
    if (!r.window || !r.heating) return [];
    const w = windowState(values[r.window], r.windowMode);
    const h = values[r.heating];
    if ((w !== "open" && w !== "tilted") || !(truthy(h) || (num(h) ?? 0) > 0)) return [];
    const state = t(w === "open" ? "stateOpen" : "stateTilted");
    return [{ key: `window-heating:${r.name}`, level: "alert", text: t("noticeWindowHeating", { room: r.name, state }) }];
  }),
);

const unreachableLamps = computed<Notice[]>(() => {
  const names = (config.value?.lamps ?? [])
    .filter((l) => lampStates.value[l.key] && !lampStates.value[l.key].reachable)
    .map((l) => (l.room ? `${l.name} (${l.room})` : l.name));
  return names.length ? [{ key: "unreachable", level: "info", text: t("noticeUnreachable", { lamps: names.join(", ") }) }] : [];
});

const binDay = computed<Notice[]>(() => {
  const tr = config.value?.trash;
  if (!tr) return [];
  const [days, types] = trashIds(tr);
  const p = pickup(values[days], values[types]);
  if (!p || p.daysLeft > 1) return [];
  const key = p.daysLeft === 0 ? "noticeTrashToday" : "noticeTrashTomorrow";
  return [{
    key: `trash:${p.daysLeft}`, level: "alert", text: t(key, { types: p.types.join(", ") }),
    color: trashColorMap.value[p.types[0]], icon: "mdi mdi-delete", done: t("done"),
  }];
});

const dishwasherNotices = computed<Notice[]>(() => {
  const dw = config.value?.dishwasher;
  if (!dw) return [];
  const m = machine(values, dishwasherIds(dw));
  if (!m.connected) return [{ key: "dishwasher", level: "info", text: t("noticeDwOffline") }];
  if (m.state === "finished") return [{ key: "dishwasher", level: "info", text: t("noticeDwFinished") }];
  if (m.state === "paused") return [{ key: "dishwasher", level: "alert", text: t("noticeDwPaused") }];
  if (m.state === "error") return [{ key: "dishwasher", level: "alert", text: t("noticeDwError") }];
  return [];
});

/** Tiles add their own sources here (mower stuck, …). Order = order on screen. */
// Lamps that are not reachable are not announced (Daniel, 01.11.: "kann weg"); unreachableLamps stays for a later setting.
export const noticeSources: ComputedRef<Notice[]>[] = [binDay, heatingWithOpenWindow, dishwasherNotices];
void unreachableLamps;

const dismissed = ref<Record<string, string>>({});

export const notices = computed(() =>
  noticeSources.flatMap((s) => s.value).filter((n) => dismissed.value[n.key] !== n.text),
);

export function dismiss(n: Notice) {
  dismissed.value = { ...dismissed.value, [n.key]: n.text };
}
