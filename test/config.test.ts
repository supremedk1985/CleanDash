import { describe, expect, it } from "vitest";
import { buildConfig, datapoints, instanceOf } from "../src-www/lib/config";
import { DEMO_CONFIG } from "../src-www/lib/demo";

describe("buildConfig", () => {
  it("is safe with nothing configured", () => {
    const c = buildConfig(undefined);
    expect(c.rooms).toEqual([]);
    expect(c.lamps).toEqual([]);
    expect(c.confirmWrites).toBe("all");
    expect(c.theme).toBe("auto");
  });

  it("bundles light rows with the same name and room into one lamp", () => {
    const c = buildConfig({
      rooms: [{ name: "Living" }],
      lights: [
        { name: "Strips", room: "Living", on: "a.on", level: "a.bri", levelMax: 255 },
        { name: "Strips", room: "Living", on: "b.on" },
        { name: "Strips", room: "Kitchen", on: "c.on" },
      ],
    });
    expect(c.lamps).toHaveLength(2);
    expect(c.rooms[0].lamps[0].devices.map((d) => d.on)).toEqual(["a.on", "b.on"]);
    expect(c.rooms[0].lamps[0].devices[0].levelMax).toBe(255);
    expect(c.rooms[0].lamps[0].devices[1].levelMax).toBe(100);
    // Kitchen is no room in the list: the lamp goes to "more lights"
    expect(c.otherLamps.map((l) => l.room)).toEqual(["Kitchen"]);
  });

  it("skips incomplete rows instead of failing", () => {
    const c = buildConfig({
      rooms: [{ name: "" }, { name: "A", temperature: "   " }, { name: "A" }],
      lights: [{ name: "No datapoint", on: "" }],
      shutters: [{ room: "Nowhere", position: "x" }, { room: "A", position: "" }],
    });
    expect(c.rooms).toHaveLength(1);
    expect(c.rooms[0].temperature).toBeUndefined();
    expect(c.lamps).toHaveLength(0);
    expect(c.rooms[0].shutters).toHaveLength(0);
  });

  it("keeps floors in the order of the room list", () => {
    const c = buildConfig({ rooms: [{ name: "a", floor: "Up" }, { name: "b", floor: "Down" }, { name: "c", floor: "Up" }] });
    expect(c.floors.map((f) => [f.name, f.rooms.map((r) => r.name)])).toEqual([["Up", ["a", "c"]], ["Down", ["b"]]]);
  });

  it("lists every datapoint once", () => {
    const ids = datapoints(buildConfig(DEMO_CONFIG));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("0_userdata.0.demo.s.bed");
  });
});

describe("instanceOf", () => {
  it("takes the adapter instance from a device id, not a fixed .0", () => {
    expect(instanceOf("navimow.1.SN123")).toBe("navimow.1");
    expect(instanceOf("roborock.0.Devices.abc")).toBe("roborock.0");
  });
});
