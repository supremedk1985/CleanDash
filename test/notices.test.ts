import { describe, expect, it } from "vitest";
import { config, values } from "../src-www/lib/store";
import { dismiss, notices } from "../src-www/lib/notices";
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

  it("stays hidden after dismissing until the cause changes", () => {
    config.value = buildConfig({
      rooms: [{ name: "A", window: "w", heating: "h" }],
      lights: [{ name: "Lamp", room: "A", on: "l", reachable: "r" }],
    });
    values.w = true;
    values.h = true;
    values.l = false;
    values.r = false;
    expect(notices.value).toHaveLength(2);
    dismiss(notices.value[0]);
    expect(notices.value.map((n) => n.key)).toEqual(["unreachable"]);
  });
});
