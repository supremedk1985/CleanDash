import { describe, expect, it } from "vitest";
import { arrange, moveTile, PINNED, toggleHidden, type TileDef } from "../src-www/lib/layout";

const defs: TileDef[] = [
  { id: "energy", col: 0 }, { id: "weather", col: 0 },
  { id: "trash", col: 1 }, { id: "mower", col: 1 }, { id: "printer", col: 1 },
  { id: "fuel", col: 2 }, { id: PINNED, col: 2 },
];

describe("arrange", () => {
  it("uses the default columns without a saved layout, settings last", () => {
    expect(arrange(defs, null).cols).toEqual([["energy", "weather"], ["trash", "mower", "printer"], ["fuel", PINNED]]);
  });

  it("keeps a saved order and puts newly set up tiles into their default column", () => {
    const l = arrange(defs, { cols: [["weather"], ["fuel", "trash"], []], hidden: [] });
    expect(l.cols).toEqual([["energy", "weather"], ["fuel", "trash", "mower", "printer"], [PINNED]]);
  });

  it("drops tiles that are no longer set up", () => {
    const l = arrange(defs.filter((d) => d.id !== "mower"), { cols: [["mower", "energy"], [], []], hidden: ["mower"] });
    expect(l.cols[0]).toEqual(["energy", "weather"]);
    expect(l.hidden).toEqual([]);
  });

  it("puts the `top` tile first in the right column, wherever it was saved", () => {
    const mit = [...defs.slice(0, 6), { id: "stove", col: 2 }, defs[6]];
    expect(arrange(mit, null, { top: "stove" }).cols[2]).toEqual(["stove", "fuel", PINNED]);
    const saved = { cols: [["stove", "energy"], [], []], hidden: [] };
    expect(arrange(mit, saved, { top: "stove" }).cols).toEqual([["energy", "weather"], ["trash", "mower", "printer"], ["stove", "fuel", PINNED]]);
    // not while moving (the saved place stays editable), not when hidden
    expect(arrange(mit, saved, { top: "stove", moving: true }).cols[0]).toEqual(["stove", "energy", "weather"]);
    expect(arrange(mit, { cols: [[], [], []], hidden: ["stove"] }, { top: "stove" }).cols[2]).toEqual(["fuel", PINNED]);
  });

  it("hides hidden tiles except while moving, and never hides settings", () => {
    const saved = { cols: [[], [], []], hidden: ["fuel", PINNED] };
    expect(arrange(defs, saved).cols[2]).toEqual([PINNED]);
    expect(arrange(defs, saved, { moving: true }).cols[2]).toEqual(["fuel", PINNED]);
  });

  it("raises a running print to second place in its column", () => {
    expect(arrange(defs, null, { raise: "printer" }).cols[1]).toEqual(["trash", "printer", "mower"]);
  });
});

describe("moveTile", () => {
  it("moves a tile into another column at the given place", () => {
    const l = moveTile({ cols: [["energy", "weather"], ["trash"], ["fuel"]], hidden: [] }, "fuel", 1, 0);
    expect(l.cols).toEqual([["energy", "weather"], ["fuel", "trash"], []]);
  });

  it("toggles hidden but never for settings", () => {
    const l = { cols: [[], [], []], hidden: [] };
    expect(toggleHidden(l, "fuel").hidden).toEqual(["fuel"]);
    expect(toggleHidden(toggleHidden(l, "fuel"), "fuel").hidden).toEqual([]);
    expect(toggleHidden(l, PINNED).hidden).toEqual([]);
  });
});
