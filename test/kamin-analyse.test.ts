import { describe, expect, it } from "vitest";
import {
  feuerAbschnitte, feuerFenster, feuerJeTag, feuerMitNachlegen, feuerStatistik, nachlegenMarken, type Feuer, type VPunkt,
} from "../src-www/features/kamin";

const T0 = 1_700_000_000_000;
const min = (n: number) => T0 + n * 60_000;

describe("fireplace analysis", () => {
  it("findet ein einzelnes Feuer mit Höchststand und Dauer", () => {
    const temps: VPunkt[] = [[20, min(0)], [80, min(5)], [200, min(10)], [120, min(20)], [45, min(30)]];
    const f = feuerAbschnitte(temps, min(31));
    expect(f).toHaveLength(1);
    expect(f[0].von).toBe(min(5));
    expect(f[0].bis).toBe(min(30));
    expect(f[0].hoechst).toBe(200);
    expect(f[0].hoechstZeit).toBe(min(10));
    expect(f[0].laeuft).toBe(false);
  });

  it("erkennt ein noch brennendes Feuer am frischen letzten Punkt", () => {
    const temps: VPunkt[] = [[20, min(0)], [80, min(5)], [200, min(10)]];
    const f = feuerAbschnitte(temps, min(11));
    expect(f).toHaveLength(1);
    expect(f[0].laeuft).toBe(true);
    expect(f[0].bis).toBe(min(10));
  });

  it("beendet ein Feuer, wenn der Verlauf lange abreißt", () => {
    const temps: VPunkt[] = [[80, min(0)], [200, min(5)], [200, min(60)], [45, min(65)]];
    const f = feuerAbschnitte(temps, min(66));
    expect(f).toHaveLength(2);
    expect(f[0].bis).toBe(min(5)); // am letzten Punkt vor der Lücke beendet
    expect(f[1].von).toBe(min(60));
  });

  it("trennt zwei Feuer, die lange genug auskühlen", () => {
    const temps: VPunkt[] = [
      [80, min(0)], [200, min(10)], [40, min(20)], [40, min(60)], [90, min(65)], [150, min(75)], [30, min(85)],
    ];
    const f = feuerAbschnitte(temps, min(86));
    expect(f).toHaveLength(2);
    expect(f[0].hoechst).toBe(200);
    expect(f[1].hoechst).toBe(150);
  });

  it("fasst ein Feuer mit kurzem Aussetzer (Fühlerfehler) zu einem zusammen", () => {
    const temps: VPunkt[] = [
      [80, min(0)], [200, min(10)], [40, min(20)], [90, min(28)], [150, min(35)], [30, min(45)],
    ];
    const f = feuerAbschnitte(temps, min(46));
    expect(f).toHaveLength(1);
    expect(f[0].hoechst).toBe(200);
    expect(f[0].von).toBe(min(0));
    expect(f[0].bis).toBe(min(45));
  });

  it("sortiert unsortierte Punkte und ignoriert Lücken (null)", () => {
    const temps: VPunkt[] = [[200, min(10)], [80, min(5)], [null, min(8)], [45, min(30)]];
    const f = feuerAbschnitte(temps, min(31));
    expect(f).toHaveLength(1);
    expect(f[0].von).toBe(min(5));
  });

  it("liest die Nachlege-Zeitpunkte aus dem Zustandsverlauf", () => {
    const z: VPunkt[] = [
      ["kalt" as unknown as number, min(0)], ["brennt" as unknown as number, min(5)],
      ["nachlegen" as unknown as number, min(20)], ["nachlegen" as unknown as number, min(25)],
      ["brennt" as unknown as number, min(30)], ["nachlegen" as unknown as number, min(40)],
    ];
    expect(nachlegenMarken(z)).toEqual([min(20), min(40)]);
  });

  it("markiert das Feuer, in dessen Zeitspanne nachgelegt wurde", () => {
    const f = feuerAbschnitte([[80, min(0)], [200, min(10)], [40, min(30)]], min(31));
    const mit = feuerMitNachlegen(f, [min(15)]);
    expect(mit[0].nachlegen).toBe(true);
    const ohne = feuerMitNachlegen(f, [min(100)]);
    expect(ohne[0].nachlegen).toBe(false);
  });

  it("rechnet die Kennzahlen über mehrere Feuer", () => {
    const feuer = [
      { von: min(0), bis: min(30), hoechst: 200, hoechstZeit: min(10), nachlegen: false, laeuft: false },
      { von: min(60), bis: min(80), hoechst: 150, hoechstZeit: min(70), nachlegen: true, laeuft: false },
    ];
    const s = feuerStatistik(feuer);
    expect(s.anzahl).toBe(2);
    expect(s.maxHoechst).toBe(200);
    expect(s.mittelHoechst).toBe(175);
    expect(s.brenndauerMs).toBe((30 + 20) * 60_000);
  });

  it("liefert für keine Feuer leere Kennzahlen", () => {
    expect(feuerStatistik([])).toEqual({ anzahl: 0, brenndauerMs: 0, maxHoechst: 0, mittelHoechst: 0 });
  });

  it("zählt die Feuer je Kalendertag", () => {
    // von einer lokalen Mitternacht aus, damit die Tagesgrenze zeitzonenunabhängig stimmt
    const mitternacht = new Date(2023, 10, 14, 0, 0, 0).getTime();
    const std = 3600_000;
    const f = (start: number, hoechst: number): Feuer => ({ von: start, bis: start + std, hoechst, hoechstZeit: start, nachlegen: false, laeuft: false });
    const je = feuerJeTag([
      f(mitternacht + 2 * std, 200), // Tag 1, früh
      f(mitternacht + 18 * std, 180), // Tag 1, abends
      f(mitternacht + 26 * std, 150), // Tag 2
    ]);
    expect(je).toHaveLength(2);
    expect(je[0].anzahl).toBe(2);
    expect(je[1].anzahl).toBe(1);
  });

  it("legt das Fenster um das letzte Feuer", () => {
    const feuer = [
      { von: min(0), bis: min(30), hoechst: 200, hoechstZeit: min(10), nachlegen: false, laeuft: false },
      { von: min(60), bis: min(80), hoechst: 150, hoechstZeit: min(70), nachlegen: false, laeuft: false },
    ];
    const w = feuerFenster(feuer, min(200), 15 * 60_000);
    expect(w?.feuer.von).toBe(min(60));
    expect(w?.von).toBe(min(45));
    expect(w?.bis).toBe(min(95));
    expect(feuerFenster([], min(200))).toBeNull();
  });
});
