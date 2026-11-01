import { describe, expect, it } from "vitest";
import {
  anteile, ansicht, blaettern, kwhText, leistungText, punktText, schluesselFuer, sichtbareFelder, verschieben, zeitraumText,
  type EnergieZeitraum,
} from "../src-www/lib/energyHistory";

const tag = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("Schlüssel und Blättern", () => {
  it("findet den Zeitraum eines Datums (Woche = Montag)", () => {
    expect(schluesselFuer("tag", tag(2026, 10, 1))).toBe("2026-10-01");
    expect(schluesselFuer("woche", tag(2026, 10, 1))).toBe("2026-09-28"); // Donnerstag → Montag davor
    expect(schluesselFuer("woche", tag(2026, 10, 4))).toBe("2026-09-28"); // Sonntag gehört noch dazu
    expect(schluesselFuer("woche", tag(2026, 10, 5))).toBe("2026-10-05");
    expect(schluesselFuer("monat", tag(2026, 10, 1))).toBe("2026-10");
    expect(schluesselFuer("jahr", tag(2026, 10, 1))).toBe("2026");
  });

  it("blättert über Monats- und Jahresgrenzen", () => {
    expect(verschieben("tag", "2026-10-01", -1)).toBe("2026-09-30");
    expect(verschieben("tag", "2026-12-31", 1)).toBe("2027-01-01");
    expect(verschieben("woche", "2026-09-28", 1)).toBe("2026-10-05");
    expect(verschieben("monat", "2026-01", -1)).toBe("2025-12");
    expect(verschieben("monat", "2026-12", 1)).toBe("2027-01");
    expect(verschieben("jahr", "2026", -1)).toBe("2025");
  });

  it("über die Zeitumstellung bleibt der Tag ein Tag", () => {
    expect(verschieben("tag", "2026-10-25", -1)).toBe("2026-10-24");
    expect(verschieben("tag", "2026-03-29", 1)).toBe("2026-03-30");
  });

  it("geht nicht über heute hinaus und nicht vor die ältesten Daten", () => {
    const index = { tag: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"], woche: [], monat: [], jahr: [] };
    const heute = tag(2026, 10, 1);
    expect(blaettern("tag", "2026-10-01", index, heute)).toEqual({ zurueck: "2026-09-30", vor: null });
    expect(blaettern("tag", "2026-09-28", index, heute)).toEqual({ zurueck: null, vor: "2026-09-29" });
    expect(blaettern("woche", "2026-09-28", index, heute)).toEqual({ zurueck: null, vor: null });
  });
});

describe("Beschriftung", () => {
  it("schreibt Zeiträume auf Deutsch", () => {
    expect(zeitraumText("tag", "2026-10-01")).toBe("Do., 01.10.2026");
    expect(zeitraumText("woche", "2026-09-28")).toBe("28.09. – 04.10.2026");
    expect(zeitraumText("monat", "2026-10")).toBe("Oktober 2026");
    expect(zeitraumText("jahr", "2026")).toBe("2026");
  });

  it("beschriftet die Achse je Art", () => {
    expect(punktText("tag", "02:20")).toBe("02:20");
    expect(punktText("woche", "2026-09-28")).toBe("Mo.");
    expect(punktText("monat", "2026-09-07")).toBe("7.");
    expect(punktText("jahr", "2026-03")).toBe("Mär");
  });

  it("formatiert Energie und Leistung", () => {
    expect(kwhText(5.13)).toBe("5,13 kWh");
    expect(kwhText(279.32)).toBe("279,3 kWh");
    expect(kwhText(3260.32)).toBe("3.260 kWh");
    expect(leistungText(434.5)).toBe("434,5 W");
    expect(leistungText(1880)).toBe("1,88 kW");
  });
});

describe("Anteile", () => {
  it("rechnet wie die Anker-App (5,13 kWh: 2,76 Speicher = 53,8 %)", () => {
    const a = anteile([
      { schluessel: "speicher", titel: "Vom Speicher", kwh: 2.76 },
      { schluessel: "solar", titel: "Aus Solar", kwh: 0.36 },
      { schluessel: "netz", titel: "Aus dem Netz", kwh: 2.01 },
    ]);
    expect(a.map((x) => x.prozent)).toEqual([53.8, 7, 39.2]);
  });

  it("ergibt nach dem Runden immer genau 100", () => {
    const a = anteile([1, 1, 1].map((kwh, i) => ({ schluessel: String(i), titel: "", kwh })));
    expect(a.reduce((s, x) => s + x.prozent, 0)).toBeCloseTo(100, 6);
  });

  it("teilt nichts durch null: ohne Energie sind alle Anteile 0", () => {
    const a = anteile([{ schluessel: "a", titel: "", kwh: 0 }, { schluessel: "b", titel: "", kwh: 0 }]);
    expect(a.map((x) => x.prozent)).toEqual([0, 0]);
  });
});

const beispiel = (art: EnergieZeitraum["art"], schluessel: string, felder = 73): EnergieZeitraum => ({
  art, schluessel, von: schluessel, bis: schluessel, stand: "", einheit: art === "tag" ? "W" : "kWh",
  punkte: Array.from({ length: felder }, (_, i) => `${String(Math.floor(i / 3)).padStart(2, "0")}:${String((i % 3) * 20).padStart(2, "0")}`),
  haus: { werte: [], summe: 5.42, herkunft: { speicher: 2.76, solar: 0.42, netz: 2.24 } },
  solar: { werte: [], summe: 0.5, verbleib: { haus: 0.42, speicher: 0.08, netz: 0 } },
  akku: { werte: [], laden: [], geladen: 1.2, entladen: 2.79, herkunft: { solar: 0.08, netz: 1.12 }, insHaus: 2.76 },
  netz: { werte: [], einspeisung: [], bezug: 3.36, eingespeist: 0, verbleib: { haus: 2.24, speicher: 1.12 } },
});

describe("Ansicht je Größe", () => {
  it("Haus: Herkunft Speicher, Solar, Netz", () => {
    const v = ansicht(beispiel("tag", "2026-10-01"), "haus");
    expect(v.titel).toBe("Einsatz zu Hause");
    expect(v.teile.map((t) => t.titel)).toEqual(["Vom Speicher", "Aus Solar", "Aus dem Netz"]);
  });
  it("Akku nennt die entladene Menge neben der geladenen", () => {
    const v = ansicht(beispiel("tag", "2026-10-01"), "akku");
    expect(v.summe).toBe(1.2);
    expect(v.neben).toBe("entladen 2,79 kWh");
  });
});

describe("Die heutige Kurve endet bei jetzt", () => {
  it("zeigt heute nur die vergangenen Felder, frühere Tage ganz", () => {
    expect(sichtbareFelder(beispiel("tag", "2026-10-01"), tag(2026, 10, 1, 10, 45))).toBe(33); // ohne Stand: bis jetzt
    const abgerufen = { ...beispiel("tag", "2026-10-01"), stand: tag(2026, 10, 1, 10, 34).toISOString() };
    expect(sichtbareFelder(abgerufen, tag(2026, 10, 1, 10, 45))).toBe(32); // 00:00 … 10:20, das 10:40-Feld gab es beim Abruf noch nicht
    expect(sichtbareFelder(beispiel("tag", "2026-09-30"), tag(2026, 10, 1, 10, 45))).toBe(73);
    expect(sichtbareFelder(beispiel("woche", "2026-09-28", 7), tag(2026, 10, 1))).toBe(7);
  });
});
