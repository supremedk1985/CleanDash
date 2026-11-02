import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
// A real recorded track; it is not part of the public repository (the shape of a real garden).
const DATEI = new URL("./__testdaten__/mapTrack-20261001.json", import.meta.url);
const echteSpur = existsSync(DATEI) ? readFileSync(DATEI, "utf8") : "";
import { flaeche, glaetten, rasenUmriss, spurLesen, vereinfachen, type Punkt2 } from "../src-www/features/rasenUmriss";

/** Randfahrt um ein Rechteck b × h im 0,25-m-Raster, dazu ein paar Bahnen innen */
function rechteck(b: number, h: number): Punkt2[] {
  const p: Punkt2[] = [];
  for (let x = 0; x <= b; x += 0.25) p.push([x, 0]);
  for (let y = 0; y <= h; y += 0.25) p.push([b, y]);
  for (let x = b; x >= 0; x -= 0.25) p.push([x, h]);
  for (let y = h; y >= 0; y -= 0.25) p.push([0, y]);
  for (let y = 1; y < h; y += 1) { p.push([1, y]); p.push([b - 1, y]); }
  return p;
}

describe("Rasenumriss aus der Spur", () => {
  it("ein Rechteck 10 × 6 m ergibt etwa 60 m²", () => {
    const u = rasenUmriss(rechteck(10, 6))!;
    expect(u).not.toBeNull();
    expect(flaeche(u)).toBeGreaterThan(52);
    expect(flaeche(u)).toBeLessThan(66);
  });

  it("eine lange Bahn ohne Randfahrt ist kein Rasen", () => {
    const linie: Punkt2[] = Array.from({ length: 80 }, (_, i) => [i * 0.25, 0]);
    expect(rasenUmriss(linie)).toBeNull();
  });

  it("ein Sprung über 5 m (GPS-Lücke) zieht keine Linie quer durchs Nichts", () => {
    // zwei getrennte kleine Ringe, verbunden nur durch einen Sprung: es bleibt der größere
    const a = rechteck(4, 4), b = rechteck(2, 2).map(([x, y]) => [x + 20, y] as Punkt2);
    const u = rasenUmriss([...a, ...b])!;
    expect(Math.max(...u.map((p) => p[0]))).toBeLessThan(6);
  });

  it("liest mapTrack als Text und als Objekt", () => {
    const roh = JSON.stringify({ points: rechteck(3, 3).map(([x, y]) => [x, y, 0.5]) });
    expect(spurLesen(roh)?.length).toBeGreaterThan(20);
    expect(spurLesen(JSON.parse(roh))?.length).toBeGreaterThan(20);
    expect(spurLesen(0)).toBeNull();
    expect(spurLesen('{"points":null}')).toBeNull();
  });

  // Braucht eine echte Spur in test/__testdaten__/ (nicht im Repo); ohne sie wird der Fall übersprungen.
  it.skipIf(!echteSpur)("eine echte Spur ergibt eine plausible Fläche", () => {
    const u = rasenUmriss(spurLesen(echteSpur)!)!;
    expect(u).not.toBeNull();
    // Der Garten liegt in einem Rahmen von rund 33 × 27 m; die Rasenfläche ist deutlich kleiner als der Rahmen
    expect(flaeche(u)).toBeGreaterThan(150);
    expect(flaeche(u)).toBeLessThan(600);
  });
});

describe("Hilfen", () => {
  it("vereinfachen hält ein Quadrat bei vier Ecken", () => {
    const q: Punkt2[] = [];
    for (let i = 0; i < 10; i++) q.push([i, 0]);
    for (let i = 0; i < 10; i++) q.push([10, i]);
    for (let i = 10; i > 0; i--) q.push([i, 10]);
    for (let i = 10; i > 0; i--) q.push([0, i]);
    expect(vereinfachen(q, 0.1).length).toBeLessThanOrEqual(6);
  });
  it("glätten verändert die Fläche nur wenig", () => {
    const q: Punkt2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(flaeche(glaetten(q, 2))).toBeGreaterThan(80);
  });
});
