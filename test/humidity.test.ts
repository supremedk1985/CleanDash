import { describe, expect, it } from "vitest";
import { dryRooms } from "../src-www/features/humidity";
import { config, values } from "../src-www/lib/store";
import { buildConfig } from "../src-www/lib/config";
import { dismiss, notices } from "../src-www/lib/notices";

const none = new Set<string>();

describe("dryRooms", () => {
  it("is off without a limit", () => {
    expect([...dryRooms([{ name: "K", value: 10 }], 0, none)]).toEqual([]);
  });
  it("flags rooms below the limit and keeps them until 3 % above", () => {
    let dry = dryRooms([{ name: "K", value: 29 }, { name: "W", value: 30 }], 30, none);
    expect([...dry]).toEqual(["K"]);
    dry = dryRooms([{ name: "K", value: 31 }, { name: "W", value: 30 }], 30, dry);
    expect([...dry]).toEqual(["K"]); // wobbling just above the limit does not end it
    dry = dryRooms([{ name: "K", value: 33 }, { name: "W", value: 30 }], 30, dry);
    expect([...dry]).toEqual([]);
  });
  it("keeps the previous state while a reading is unknown or zero", () => {
    expect([...dryRooms([{ name: "K", value: null }], 30, new Set(["K"]))]).toEqual(["K"]);
    expect([...dryRooms([{ name: "K", value: 0 }], 30, none)]).toEqual([]);
  });
});

describe("dry air notice", () => {
  it("names the dry rooms, driest first, and goes away when the air is fine again", () => {
    config.value = buildConfig({ humidityMin: 30, rooms: [{ name: "Küche", humidity: "hk" }, { name: "Bad", humidity: "hb" }, { name: "Flur", humidity: "hf" }] });
    values.hk = 24; values.hb = 28; values.hf = 48;
    const n = notices.value.find((x) => x.key.startsWith("humidity:"))!;
    expect(n.key).toBe("humidity:Bad,Küche");
    expect(n.detail).toContain("Küche 24 %, Bad 28 %");
    expect(n.done).toBe(true);
    values.hk = 40; values.hb = 40;
    expect(notices.value.some((x) => x.key.startsWith("humidity:"))).toBe(false);
  });
  it("stays away after done while the same rooms are dry", () => {
    config.value = buildConfig({ humidityMin: 30, rooms: [{ name: "Küche", humidity: "hk2" }] });
    values.hk2 = 22;
    dismiss(notices.value.find((x) => x.key.startsWith("humidity:"))!);
    values.hk2 = 21;
    expect(notices.value.some((x) => x.key.startsWith("humidity:"))).toBe(false);
  });
  it("says nothing without a limit", () => {
    config.value = buildConfig({ rooms: [{ name: "Küche", humidity: "hk3" }] });
    values.hk3 = 10;
    expect(notices.value.some((x) => x.key.startsWith("humidity:"))).toBe(false);
  });
});
