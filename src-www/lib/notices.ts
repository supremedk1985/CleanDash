/**
 * Notices: things that want attention appear as banners at the top of the page, not hidden inside a tile.
 *
 * Every tile can contribute through `noticeSources`; a notice is derived from the current values, so it goes away
 * by itself when the cause is gone. Dismissing hides it until its text changes (a new cause is a new notice).
 */
import { computed, ref, type ComputedRef } from "vue";
import { config, lampStates, values } from "./store";
import { num, truthy, windowState } from "./values";
import { t } from "./i18n";

export interface Notice {
  /** stable per cause, e.g. "window-heating:Kitchen" */
  key: string;
  level: "alert" | "info";
  text: string;
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

/** Tiles add their own sources here (mower stuck, bin day, …). */
export const noticeSources: ComputedRef<Notice[]>[] = [heatingWithOpenWindow, unreachableLamps];

const dismissed = ref<Record<string, string>>({});

export const notices = computed(() =>
  noticeSources.flatMap((s) => s.value).filter((n) => dismissed.value[n.key] !== n.text),
);

export function dismiss(n: Notice) {
  dismissed.value = { ...dismissed.value, [n.key]: n.text };
}
