import { describe, expect, it } from "vitest";
import { config, values } from "../src-www/lib/store";
import { dismiss, notices, snooze } from "../src-www/lib/notices";
import { buildConfig } from "../src-www/lib/config";

describe("notices", () => {
  it("warns about an open window while the heating runs, and forgets it when the window closes", () => {
    config.value = buildConfig({ rooms: [{ name: "Kitchen", window: "w", heating: "h", windowMode: "handle" }] });
    values.w = 1;
    values.h = 25;
    expect(notices.value.map((n) => n.key)).toEqual(["window-heating:Kitchen"]);
    values.w = 0;
    expect(notices.value).toEqual([]);
  });

  it("comes back after the snooze when the cause is still there", () => {
    config.value = buildConfig({ rooms: [{ name: "B", window: "w2", heating: "h2" }] });
    values.w2 = true;
    values.h2 = true;
    const n = notices.value[0];
    snooze(n, -1);
    expect(notices.value.map((x) => x.key)).toEqual([n.key]);
    snooze(n);
    expect(notices.value).toEqual([]);
  });

  it("stays hidden after dismissing", () => {
    config.value = buildConfig({
      rooms: [{ name: "A", window: "w", heating: "h" }],
      lights: [{ name: "Lamp", room: "A", on: "l", reachable: "r" }],
    });
    values.w = true;
    values.h = true;
    values.l = false;
    values.r = false;
    expect(notices.value).toHaveLength(1);
    dismiss(notices.value[0]);
    expect(notices.value).toEqual([]);
  });
});

import { nextTick } from "vue";
import { navimow } from "../src-www/features/navimow";

describe("done marks", () => {
  it("forget a done bin once the collection has passed, so next week's comes again", async () => {
    config.value = buildConfig({ trashInstance: "trashschedule.0" });
    values["trashschedule.0.next.daysLeft"] = 1;
    values["trashschedule.0.next.types"] = "Paper";
    await nextTick();
    const n = notices.value.find((x) => x.key.startsWith("trash:"))!;
    dismiss(n);
    await nextTick();
    expect(notices.value.some((x) => x.key.startsWith("trash:"))).toBe(false);
    values["trashschedule.0.next.daysLeft"] = 6; // collected, next one in six days
    await nextTick();
    values["trashschedule.0.next.daysLeft"] = 1; // a week later: the same bin again
    await nextTick();
    expect(notices.value.map((x) => x.key)).toContain(n.key);
  });

  it("turns the mower's help call into a notice that can be done", async () => {
    config.value = buildConfig({});
    navimow.value = { ...navimow.value, adapterVerbunden: true, zustand: "Error" };
    await nextTick();
    const n = notices.value.find((x) => x.key === "mower:stoerung")!;
    expect(n.done).toBe(true);
    dismiss(n);
    await nextTick();
    expect(notices.value.find((x) => x.key === "mower:stoerung")).toBeUndefined();
    navimow.value = { ...navimow.value, zustand: "isDocked" };
    await nextTick();
    navimow.value = { ...navimow.value, zustand: "Error" };
    await nextTick();
    expect(notices.value.find((x) => x.key === "mower:stoerung")).toBeDefined();
  });
});
