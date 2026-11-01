import { describe, expect, it } from "vitest";
import { gridShare, hhmm, items, itemText, kmh, machine, machineState, owmCode, parseItem, pickup, time, trashColors } from "../src-www/lib/tiles";
import { buildConfig, datapoints, dishwasherIds } from "../src-www/lib/config";

describe("weather", () => {
  it("reads the OpenWeatherMap code from the icon URL", () => {
    expect(owmCode("https://openweathermap.org/img/w/10n.png")).toBe("10n");
    expect(owmCode("https://openweathermap.org/img/wn/01d@2x.png")).toBe("01d");
    expect(owmCode(null)).toBe("");
  });
  it("converts wind and timestamps", () => {
    expect(kmh(10)).toBe(36);
    expect(kmh(null)).toBeNull();
    expect(time(1_793_566_800_000)?.getTime()).toBe(1_793_566_800_000);
    expect(time(1_793_566_800)?.getTime()).toBe(1_793_566_800_000);
    expect(time(0)).toBeNull();
  });
});

describe("trash", () => {
  it("splits several types and refuses nonsense", () => {
    expect(pickup(1, "Paper, Residual")).toEqual({ daysLeft: 1, types: ["Paper", "Residual"] });
    expect(pickup(null, "Paper")).toBeNull();
    expect(pickup(-1, "Paper")).toBeNull();
    expect(pickup(3, "")).toBeNull();
  });
  it("takes only valid colours from the trashschedule settings", () => {
    expect(trashColors({ trashtypes: [{ name: "A", color: "#bab827" }, { name: "B", color: "red;x" }, { color: "#fff" }] })).toEqual({ A: "#bab827" });
    expect(trashColors(null)).toEqual({});
  });
});

describe("dishwasher", () => {
  it("maps Home Connect operation states", () => {
    expect(machineState("BSH.Common.EnumType.OperationState.Run")).toBe("running");
    expect(machineState("BSH.Common.EnumType.OperationState.DelayedStart")).toBe("delayed");
    expect(machineState("BSH.Common.EnumType.OperationState.Finished")).toBe("finished");
    expect(machineState("BSH.Common.EnumType.OperationState.ActionRequired")).toBe("paused");
    expect(machineState(null)).toBe("unknown");
  });
  it("is connected unless the cloud explicitly says otherwise", () => {
    const ids = dishwasherIds({ base: "hc" });
    expect(machine({}, ids).connected).toBe(true);
    expect(machine({ [ids.connected]: null }, ids).connected).toBe(true);
    expect(machine({ [ids.connected]: false }, ids).connected).toBe(false);
  });
  it("formats the time left", () => {
    expect(hhmm(2820)).toBe("0:47");
    expect(hhmm(3 * 3600 + 5 * 60)).toBe("3:05");
  });
});

describe("shopping list", () => {
  it("reads the bring adapter's JSON and knows the difference between empty and unknown", () => {
    expect(items('[{"name":"Milk","specification":"2 l"},{"name":"Bread","specification":""},{"x":1}]')).toEqual([{ name: "Milk", specification: "2 l" }, { name: "Bread" }]);
    expect(items("")).toEqual([]);
    expect(items("not json")).toEqual([]);
    expect(items(null)).toBeNull();
  });
  it("splits name and specification at the first comma, both ways", () => {
    expect(parseItem(" Milk, 2 litres, cold ")).toEqual({ name: "Milk", specification: "2 litres, cold" });
    expect(parseItem("Bread")).toEqual({ name: "Bread" });
    expect(parseItem(", 2 l")).toBeNull();
    expect(itemText({ name: "Milk", specification: "2 l" })).toBe("Milk, 2 l");
  });
});

describe("energy", () => {
  it("never shows NaN or more than 100 percent", () => {
    expect(gridShare(8.25, 4.46)).toBe(54);
    expect(gridShare(0, 1)).toBeNull();
    expect(gridShare(null, 1)).toBeNull();
    expect(gridShare(2, 5)).toBe(100);
  });
});

describe("configuration of the adapter tiles", () => {
  it("accepts long and short instance names and derives the bring commands", () => {
    const c = buildConfig({
      weatherInstance: "system.adapter.openweathermap.0",
      trashInstance: "trashschedule.0",
      shoppingLists: [{ name: "Shop", content: "bring.0.abc.content" }, { name: "Wrong", content: "bring.0.abc.recentContent" }],
    });
    expect(c.weather?.base).toBe("openweathermap.0");
    expect(c.trash?.instance).toBe("trashschedule.0");
    expect(c.shoppingLists).toHaveLength(1);
    expect(c.shoppingLists[0].add).toBe("bring.0.abc.saveItemTranslated");
    const ids = datapoints(c);
    expect(ids).toContain("openweathermap.0.forecast.period7.icon");
    expect(ids).toContain("trashschedule.0.nextAfter.types");
    expect(ids).toContain("bring.0.abc.recentContent");
  });
  it("has no energy tile when no energy datapoint is set", () => {
    expect(buildConfig({}).energy).toBeUndefined();
    expect(buildConfig({ energySolar: "x" }).energy?.solar).toBe("x");
  });
});
