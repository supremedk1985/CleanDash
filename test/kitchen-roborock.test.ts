import { describe, it, expect } from "vitest";
import { roborockAktionen, stationsMeldungen, f25Meldungen, F25_HOECHSTENS_ALT_MS } from "../src-www/features/roborock";

describe("roborockAktionen", () => {
  it("bietet Start an, wenn der Roboter lädt, bereit ist oder schläft", () => {
    expect(roborockAktionen(8, false, true)).toEqual(["start"]);
    expect(roborockAktionen(3, false, true)).toEqual(["start"]);
    expect(roborockAktionen(2, false, true)).toEqual(["start"]);
    expect(roborockAktionen(100, false, true)).toEqual(["start"]);
  });

  it("bietet Pause und Heimfahrt an, wenn er reinigt", () => {
    expect(roborockAktionen(5, true, true)).toEqual(["pause", "station"]);
    expect(roborockAktionen(18, true, true)).toEqual(["pause", "station"]);
    // in_cleaning zählt auch dann, wenn der Zustandscode noch nachhinkt
    expect(roborockAktionen(3, true, true)).toEqual(["pause", "station"]);
  });

  it("bietet Weiter und Heimfahrt an, wenn er pausiert", () => {
    expect(roborockAktionen(10, false, true)).toEqual(["weiter", "station"]);
  });

  it("zeigt nichts, wenn der Roboter offline ist", () => {
    expect(roborockAktionen(8, false, false)).toEqual([]);
  });

  it("zeigt nichts, wenn der Adapter keine Cloud-Verbindung hat (Werte wären Konserve)", () => {
    expect(roborockAktionen(8, false, true, false)).toEqual([]);
  });
});

describe("stationsMeldungen", () => {
  const ok = { adapterVerbunden: true, clearWaterBoxStatus: 2, dirtyWaterBoxStatus: 2, dustBagStatus: 2, cleanFluidStatus: 2, waterBoxFilterStatus: 2 };

  it("meldet nichts, wenn alles OK ist", () => {
    expect(stationsMeldungen(ok)).toEqual([]);
  });

  it("meldet leeres Reinwasser und vollen Schmutzwassertank", () => {
    const m = stationsMeldungen({ ...ok, clearWaterBoxStatus: 1, dirtyWaterBoxStatus: 1 });
    expect(m.map((x) => x.schluessel)).toEqual(["reinwasser", "schmutzwasser"]);
  });

  it("ignoriert unbekannt oder nicht verbaut (0 und 3)", () => {
    expect(stationsMeldungen({ ...ok, cleanFluidStatus: 0, waterBoxFilterStatus: 3 })).toEqual([]);
  });

  it("meldet nichts ohne Adapter-Verbindung - die Werte wären alt", () => {
    expect(stationsMeldungen({ ...ok, adapterVerbunden: false, dustBagStatus: 1 })).toEqual([]);
  });
});

describe("f25Meldungen", () => {
  const jetzt = 1_800_000_000_000;
  const stand = (hinweis: string, akku: number, alt = 60_000) => ({ hinweis, akku, lebenszeichen: jetzt - alt });

  it("meldet nichts ohne Hinweis - auch wenn er die Selbstreinigung selbst gestartet hat", () => {
    expect(f25Meldungen(stand("", 40), jetzt)).toEqual([]);
  });
  it("meldet nichts, solange er noch auf genug Akku wartet (Daniel: nur wenn es so weit ist)", () => {
    expect(f25Meldungen(stand("wartet", 9), jetzt)).toEqual([]);
  });
  it("fordert bei genug Akku zum Starten auf, mit eigenem Schlüssel", () => {
    const m = f25Meldungen(stand("bereit", 15), jetzt);
    expect(m[0].schluessel).toBe("f25-bereit");
    expect(m[0].text).toContain("Selbstreinigung starten");
    expect(m[0].text).toContain("15 %");
  });
  it("schweigt, wenn das Skript sich zu lange nicht gemeldet hat", () => {
    expect(f25Meldungen(stand("bereit", 20, F25_HOECHSTENS_ALT_MS + 1), jetzt)).toEqual([]);
    expect(f25Meldungen({ hinweis: "bereit", akku: 20, lebenszeichen: 0 }, jetzt)).toEqual([]);
    expect(f25Meldungen(undefined, jetzt)).toEqual([]);
  });
});
