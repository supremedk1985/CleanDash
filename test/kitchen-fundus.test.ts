import { describe, expect, it } from "vitest";
import { serverAdresse, ortText, kistenText, mengeText, filtern, nachStapel, rausText, fotoUrl, mengeZahl, nachRaum, kistenAussehen, naechsterStapel, istLeer, nachkaufliste } from "../src-www/features/fundus";
import type { FuKiste, FuSache } from "../src-www/features/fundus";

const k = (code: string, stapel: string, position: number, darueber: number, extra: Partial<FuKiste> = {}): FuKiste =>
  ({ code, stapel, position, darueber, ...extra });
const s = (id: number, name: string, bereich: string, kiste: FuKiste | null, extra: Partial<FuSache> = {}): FuSache =>
  ({ id, name, beschreibung: "", bereich, menge: "", notiz: "", foto: null, fotos: [], raus_seit: null, raus_anzahl: null, kiste, ...extra });

describe("Fundus auf dem Küchen-Dashboard", () => {
  it("ohne Server-Angabe keine Adresse (dann keine Kachel)", () => {
    expect(serverAdresse("")).toBe("");
    expect(serverAdresse("  ")).toBe("");
    expect(serverAdresse("http://x:1/")).toBe("http://x:1");
  });

  it("sagt den Ort wie die App", () => {
    expect(ortText(k("K-01", "A", 1, 0))).toBe("Stapel A · ganz oben");
    expect(ortText(k("K-02", "A", 2, 1))).toBe("Stapel A · 2. von oben – eine Kiste obendrauf");
    expect(ortText(k("K-03", "A", 3, 2))).toBe("Stapel A · 3. von oben – 2 Kisten obendrauf");
    expect(ortText(k("K-06", "", 1, 0))).toBe("ohne Stapel");
    expect(ortText(null)).toBe("");
  });

  it("beschreibt Kiste und Menge", () => {
    expect(kistenText(k("K-01", "A", 1, 0, { art: "IKEA UPPSNOFSAD", laenge: 350, breite: 250, hoehe: 140 })))
      .toBe("IKEA UPPSNOFSAD · 35 × 25 × 14 cm");
    expect(kistenText(k("K-01", "A", 1, 0, { hoehe: 225 }))).toBe("22,5 cm hoch");
    expect(mengeText("3")).toBe("3 ×");
    expect(mengeText("50 Stück")).toBe("50 Stück");
    expect(mengeText("")).toBe("");
  });

  it("filtert nach Bereich und Kiste", () => {
    const a = k("K-01", "A", 1, 0), b = k("K-02", "A", 2, 1);
    const liste = [s(1, "Zange", "Werkzeug", a), s(2, "Relais", "Elektro", a), s(3, "Schraube", "Werkzeug", b)];
    expect(filtern(liste, null, null)).toHaveLength(3);
    expect(filtern(liste, "Werkzeug", null).map((x) => x.id)).toEqual([1, 3]);
    expect(filtern(liste, "Werkzeug", "K-02").map((x) => x.id)).toEqual([3]);
  });

  it("lässt Aufgebrauchtes aus der Kiste und führt es auf der Nachkaufliste (08.10.2026)", () => {
    const a = k("K-01", "A", 1, 0);
    const liste = [s(1, "Riegel", "PC", a, { menge: "0", leer: true }), s(2, "Relais", "Elektro", a, { menge: "3" }),
      s(3, "Schraube", "Werkzeug", a, { menge: "0 Stück" }), s(4, "Lötzinn", "Elektro", a, { menge: "Rolle" })];
    // Server-Kennzeichen zählt; ohne Kennzeichen entscheidet die erste Zahl, ohne Zahl nie leer
    expect(liste.map(istLeer)).toEqual([true, false, true, false]);
    expect(filtern(liste, null, null).map((x) => x.id)).toEqual([2, 4]);
    expect(filtern(liste, null, "K-01", true).map((x) => x.id)).toEqual([1, 3]);
    expect(nachkaufliste(liste).map((x) => x.name)).toEqual(["Riegel", "Schraube"]);
  });

  it("ordnet Kisten nach Stapel, oben zuerst, ohne Stapel zuletzt", () => {
    const g = nachStapel([k("K-06", "", 1, 0), k("K-02", "A", 2, 1), k("K-01", "A", 1, 0), k("K-05", "B", 1, 0)]);
    expect(g.map((x) => x.stapel)).toEqual(["A", "B", ""]);
    expect(g[0].kisten.map((x) => x.code)).toEqual(["K-01", "K-02"]);
  });

  it("gruppiert nach Raum in Daniels Reihenfolge, „ohne Raum“ zuletzt", () => {
    const g = nachStapel([k("K-01", "A", 1, 0), k("K-02", "A", 1, 0, { raum: "Werkstatt" }), k("K-03", "", 1, 0, { raum: "Keller" }),
      k("K-04", "A", 1, 0, { raum: "Keller" })], ["Werkstatt", "Keller"]);
    expect(g.map((x) => `${x.raum}|${x.stapel}`)).toEqual(["Werkstatt|A", "Keller|A", "Keller|", "|A"]);
    expect(ortText(k("K-04", "A", 1, 0, { raum: "Keller" }))).toBe("Keller · Stapel A · ganz oben");
    expect(ortText(k("K-03", "", 1, 0, { raum: "Keller" }))).toBe("Keller · ohne Stapel");
  });

  it("zeigt Rausgenommenes und baut Fotoadressen", () => {
    expect(rausText(s(1, "x", "", null, { raus_seit: "2026-10-03", raus_anzahl: 2 }))).toBe("2 rausgenommen");
    expect(rausText(s(1, "x", "", null))).toBeNull();
    expect(fotoUrl(null)).toBeNull();
    expect(fotoUrl("abc", true)).toMatch(/\/api\/kachel\/fundus\/foto\/abc\?gross=1$/);
  });
});

describe("mengeZahl", () => {
  it("nimmt die erste Zahl wie die App", () => {
    expect(mengeZahl("50 Stück")).toBe(50);
    expect(mengeZahl("ca. 25")).toBe(25);
    expect(mengeZahl("Rolle")).toBeNull();
    expect(mengeZahl("")).toBeNull();
    expect(mengeZahl(null)).toBeNull();
  });
});

describe("Ansicht Räume", () => {
  it("fasst je Raum Stapel und lose Kisten zusammen, mit Summen", () => {
    const r = nachRaum([k("K-01", "A", 1, 0, { raum: "Keller", anzahl: 3 }), k("K-02", "A", 2, 1, { raum: "Keller", anzahl: 2 }),
      k("K-03", "", 1, 0, { raum: "Keller", anzahl: 1 }), k("K-04", "B", 1, 0, { anzahl: 5 })], ["Keller"]);
    expect(r.map((x) => x.raum)).toEqual(["Keller", ""]);
    expect(r[0].stapel.map((s) => [s.stapel, s.kisten.map((x) => x.code)])).toEqual([["A", ["K-01", "K-02"]]]);
    expect(r[0].lose.map((x) => x.code)).toEqual(["K-03"]);
    expect([r[0].kisten, r[0].sachen, r[1].sachen]).toEqual([3, 6, 5]);
  });

  it("erkennt die Kistenart wie die App", () => {
    expect(kistenAussehen(k("K-01", "A", 1, 0, { art: "IKEA UPPSNOFSAD" }))).toBe("dunkel");
    expect(kistenAussehen(k("K-07", "", 1, 0, { art: "IKEA SAMLA 11 l" }))).toBe("milchig");
    expect(kistenAussehen(k("K-05", "B", 1, 0))).toBe("neutral");
  });
});

describe("naechsterStapel", () => {
  it("zählt je Raum", () => {
    const ks = [k("K-01", "A", 1, 0, { raum: "Keller" }), k("K-02", "B", 1, 0, { raum: "Keller" }), k("K-03", "A", 1, 0)];
    expect(naechsterStapel(ks, "Keller")).toBe("C");
    expect(naechsterStapel(ks, "")).toBe("B");
    expect(naechsterStapel(ks, "Garage")).toBe("A");
  });
});
