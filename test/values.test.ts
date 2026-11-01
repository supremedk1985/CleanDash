import { describe, expect, it } from "vitest";
import { clampSetpoint, lampState, levelRaw, roomLight, shutterClosed, shutterRaw, windowState } from "../src-www/lib/values";
import type { Lamp } from "../src-www/lib/config";

describe("windowState", () => {
  it("reads contacts, handles and texts", () => {
    expect(windowState(true, "contact")).toBe("open");
    expect(windowState(false, "contact")).toBe("closed");
    expect(windowState(0, "handle")).toBe("closed");
    expect(windowState(1, "handle")).toBe("tilted");
    expect(windowState(2, "handle")).toBe("open");
    expect(windowState("TILTED", "text")).toBe("tilted");
    expect(windowState("closed", "contact")).toBe("closed");
  });
  it("says nothing when it knows nothing", () => {
    expect(windowState(null, "contact")).toBeNull();
    expect(windowState(undefined, "handle")).toBeNull();
    expect(windowState("maybe", "text")).toBeNull();
  });
});

describe("shutters", () => {
  it("turns any range into percent closed and back", () => {
    expect(shutterClosed(100, { max: 100, closedAt: "max" })).toBe(100);
    expect(shutterClosed(0, { max: 100, closedAt: "min" })).toBe(100);
    expect(shutterClosed(0.25, { max: 1, closedAt: "max" })).toBe(25);
    for (const s of [{ max: 100, closedAt: "max" as const }, { max: 100, closedAt: "min" as const }, { max: 1, closedAt: "max" as const }]) {
      for (const p of [0, 30, 100]) expect(shutterClosed(shutterRaw(p, s), s)).toBe(p);
    }
  });
  it("does not invent a position", () => {
    expect(shutterClosed(null, { max: 100, closedAt: "max" })).toBeNull();
  });
});

const lamp = (devices: Lamp["devices"]): Lamp => ({ key: "k", name: "n", room: "r", devices });

describe("lampState", () => {
  it("is on when any device is on, brightness is the mean of those that are on", () => {
    const l = lamp([
      { on: "a", level: "al", levelMax: 255 },
      { on: "b", level: "bl", levelMax: 100 },
      { on: "c", level: "cl", levelMax: 100 },
    ]);
    const s = lampState(l, { a: true, al: 255, b: true, bl: 50, c: false, cl: 10 });
    expect(s.on).toBe(true);
    expect(s.level).toBe(75);
  });
  it("is unknown until a value arrives", () => {
    expect(lampState(lamp([{ on: "a", levelMax: 100 }]), {}).on).toBeNull();
  });
  it("is unreachable only when every device says so", () => {
    const l = lamp([{ on: "a", reachable: "ar", levelMax: 100 }, { on: "b", reachable: "br", levelMax: 100 }]);
    expect(lampState(l, { a: false, b: false, ar: false, br: true }).reachable).toBe(true);
    expect(lampState(l, { a: false, b: false, ar: false, br: false }).reachable).toBe(false);
  });
});

describe("writing", () => {
  it("never dims to 0 and respects the device range", () => {
    expect(levelRaw(0, 100)).toBe(1);
    expect(levelRaw(50, 255)).toBe(128);
    expect(levelRaw(120, 100)).toBe(100);
  });
  it("keeps setpoints in half steps between 5 and 30", () => {
    expect(clampSetpoint(21.3)).toBe(21.5);
    expect(clampSetpoint(2)).toBe(5);
    expect(clampSetpoint(40)).toBe(30);
  });
});

describe("roomLight", () => {
  it("counts lamps that are on", () => {
    const a = lamp([{ on: "a", levelMax: 100 }]);
    const b = { ...lamp([{ on: "b", levelMax: 100 }]), key: "k2" };
    const r = roomLight([a, b], { k: { on: true, level: 40, dimmable: true, reachable: true }, k2: { on: false, level: null, dimmable: false, reachable: true } });
    expect(r).toEqual({ on: 1, of: 2, level: 40 });
  });
});
