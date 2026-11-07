import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Lagerfeuer } from "../src-www/lib/lagerfeuer";
import { kaminBrennt } from "../src-www/features/kamin";

describe("fireplace tile", () => {
  it("draws the same campfire as the Kaminwacht firmware", () => {
    const zeilen = readFileSync(new URL("./kamin-feuer-referenz.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
    const feuer = new Lagerfeuer();
    let schlimmstes = 0, kern = false;
    for (const z of zeilen) {
      const [k, zeit, felder] = z.split(" ");
      feuer.malen(Number(k), Number(zeit));
      let anders = 0;
      for (let i = 0; i < 32 * 32; i++) {
        if (feuer.e[i] !== Number(felder[i])) anders++;
        if (feuer.e[i] === 6) kern = true;
      }
      schlimmstes = Math.max(schlimmstes, anders);
    }
    expect(zeilen.length).toBe(48);
    expect(kern).toBe(true);
    expect(schlimmstes).toBeLessThanOrEqual(10); // at most 1 % of the cells differ (sin rounding at edges)
  });

  it("is shown only while the fire burns and the device answers", () => {
    expect(kaminBrennt({ zustand: "brennt", erreichbar: true })).toBe(true);
    expect(kaminBrennt({ zustand: "nachlegen", erreichbar: true })).toBe(true);
    expect(kaminBrennt({ zustand: "kalt", erreichbar: true })).toBe(false);
    expect(kaminBrennt({ zustand: "brennt", erreichbar: false })).toBe(false);
    expect(kaminBrennt(undefined)).toBe(false);
  });
});
