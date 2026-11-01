import { describe, expect, it } from "vitest";
import { abschnitte, dauerText, kwhText, laufzeit, seit, stundenmittel, tageswerte, zustand, type Punkt } from "../src-www/features/luftentfeuchter";

const M = 60_000;
const T0 = new Date(2026, 9, 15, 20, 0).getTime();

describe("zustand", () => {
  it("unterscheidet läuft, bereit, aus und nicht erreichbar", () => {
    expect(zustand({ an: true, leistung: 152, erreichbar: true })).toBe("läuft");
    expect(zustand({ an: true, leistung: 22, erreichbar: true })).toBe("bereit");
    expect(zustand({ an: false, leistung: 0, erreichbar: true })).toBe("aus");
    expect(zustand({ an: true, leistung: 152, erreichbar: false })).toBe("weg");
  });
});

describe("abschnitte", () => {
  // so wie am 15.10. abends: an, 22:49 per Knopf aus, 22:55 kurz an, 22:56 wieder aus (doppelte Punkte inklusive)
  const punkte: Punkt[] = [[true, T0], [true, T0 + 10 * M], [false, T0 + 29 * M], [false, T0 + 34 * M], [true, T0 + 35 * M], [true, T0 + 35 * M + 1], [false, T0 + 36 * M]];
  it("fasst gleiche Werte zusammen und lässt den letzten Abschnitt bis jetzt laufen", () => {
    const a = abschnitte(punkte, 0, T0 + 60 * M);
    expect(a.map((x) => [x.an, (x.von - T0) / M, (x.bis - T0) / M])).toEqual([
      [true, 0, 29], [false, 29, 35], [true, 35, 36], [false, 36, 60],
    ]);
  });
  it("beginnt am Fensteranfang mit dem Zustand davor", () => {
    const a = abschnitte(punkte, T0 + 30 * M, T0 + 60 * M);
    expect(a.map((x) => [x.an, (x.von - T0) / M])).toEqual([[false, 30], [true, 35], [false, 36]]);
  });
  it("seit: Beginn des aktuellen Zustands, null bei Widerspruch", () => {
    expect(seit(punkte, false, T0 + 60 * M)).toBe(T0 + 36 * M);
    expect(seit(punkte, true, T0 + 60 * M)).toBeNull();
    expect(seit([], true, T0)).toBeNull();
  });
});

describe("laufzeit", () => {
  it("zählt nur Zeit über der Schwelle, als Treppe", () => {
    // wie die Steckdose schreibt: bei jeder Änderung und spätestens alle 10 Minuten
    const p: Punkt[] = [[150, T0], [150, T0 + 10 * M], [150, T0 + 20 * M], [20, T0 + 30 * M], [152, T0 + 40 * M], [0, T0 + 50 * M]];
    expect(laufzeit(p, T0, T0 + 120 * M)).toBe(40 * M);
  });
  it("hört nach einer Lücke auf zu zählen (Steckdose verstummt)", () => {
    const p: Punkt[] = [[150, T0]];
    expect(laufzeit(p, T0, T0 + 120 * M)).toBe(15 * M);
  });
  it("schneidet am Fensteranfang ab", () => {
    const p: Punkt[] = [[150, T0], [0, T0 + 10 * M]];
    expect(laufzeit(p, T0 + 5 * M, T0 + 60 * M)).toBe(5 * M);
  });
});

describe("stundenmittel", () => {
  it("liefert 24 Werte und rechnet eine halbe Stunde 150 W als 75 W im Stundenmittel", () => {
    const jetzt = T0 + 24 * 3600_000;
    const p: Punkt[] = [[150, jetzt - 3600_000], [150, jetzt - 3600_000 + 10 * M], [150, jetzt - 3600_000 + 20 * M], [0, jetzt - 30 * M]];
    const s = stundenmittel(p, jetzt);
    expect(s).toHaveLength(24);
    expect(s[23]).toBe(75);
    expect(s.slice(0, 23).every((x) => x === 0)).toBe(true);
  });
});

describe("tageswerte", () => {
  it("nimmt je Tag den höchsten Zählerstand", () => {
    const p: Punkt[] = [[0.2, new Date(2026, 9, 14, 12).getTime()], [1.4, new Date(2026, 9, 14, 23, 50).getTime()],
      [0, new Date(2026, 9, 15, 0, 5).getTime()], [0.6, new Date(2026, 9, 15, 18).getTime()]];
    expect(tageswerte(p)).toEqual([{ tag: "2026-10-14", kwh: 1.4 }, { tag: "2026-10-15", kwh: 0.6 }]);
  });
});

describe("Texte", () => {
  it("formatiert Dauer und kWh deutsch", () => {
    expect(dauerText(25 * M)).toBe("25 min");
    expect(dauerText(80 * M)).toBe("1 h 20 min");
    expect(dauerText(120 * M)).toBe("2 h");
    expect(kwhText(0.036)).toBe("0,04 kWh");
    expect(kwhText(643.4)).toBe("643,4 kWh");
  });
});
