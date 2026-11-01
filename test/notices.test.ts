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
