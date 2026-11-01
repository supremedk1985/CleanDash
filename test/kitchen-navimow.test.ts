/**
 * Tests für die reine Logik der Rasenmäher-Kachel. Kein Test hier ruft setState auf --
 * lib/iobroker ist komplett gemockt, ein Befehl an den echten Mäher ist damit unmöglich.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rawConfig } from "../src-www/lib/store";

const mock = vi.hoisted(() => ({
  werte: new Map<string, unknown>(),
  fetchState: vi.fn(async (id: string) => {
    if (!mock.werte.has(id)) throw new Error(`kein Fixture für ${id}`);
    const v = mock.werte.get(id);
    return v === null ? 0 : v; // fetchState macht null zu 0
  }),
  setState: vi.fn(async () => true),
}));

vi.mock("../src-www/compat/iobroker", () => ({
  fetchState: mock.fetchState,
  setState: mock.setState,
  backendErreichbar: { value: true },
  letzterKontakt: { value: null },
}));

import {
  PREFIX,
  navimow,
  navimowFeature,
  navimowAktionen,
  navimowBefehl,
  navimowTippen,
  maeherMeldungen,
  kartenPosition,
  kartenLadenNoetig,
  istGueltigeKarte,
  parseKartenFrame,
  parseStation,
  rueckmeldung,
  fortschrittBewerten,
  hinweisText,
  zustandText,
  akkuAnzeige,
  flaecheAnzeige,
  karte,
  karteStand,
  karteFehlgeschlagen,
  befehlOffen,
  befehlMeldung,
  befehlLaeuft,
  bestaetigung,
  karteLaden,
  KARTE_MAEHEN_MS,
  KARTE_SICHERHEITSNETZ_MS,
  KARTE_DIALOG_MS,
  ERWARTUNG_MS,
  _zuruecksetzenFuerTests,
  POSITION_STUMM_MIN,
} from "../src-www/features/navimow";
import type { BefehlOffen, KartenFrame, KartenVersuch, Navimow } from "../src-www/features/navimow";

const ALLE_ZUSTAENDE = [
  "isRunning", "isDocked", "isIdle", "isPaused", "isDocking", "isMapping", "isLifted",
  "Error", "inSoftwareUpdate", "Self-Checking", "Offline", "", "irgendwasNeues",
];

/** Das echte mapFrame vom 12.09.2026 (800×686 px, scale 22,857). */
const FRAME: KartenFrame = { minX: -19, maxX: 16, minY: -4, maxY: 26, width: 800, height: 686, scale: 22.857142857142858 };
const FRAME_JSON = JSON.stringify(FRAME);

/** Ein gültiger Kartenwert: PNG-Präfix, aufgefüllt auf > 1000 Zeichen. */
const KARTE_A = "data:image/png;base64," + "A".repeat(1500);
const KARTE_B = "data:image/png;base64," + "B".repeat(1500);

function fixtures(ueberschreiben: Record<string, unknown> = {}) {
  const w: Record<string, unknown> = {
    "navimow.0.info.connection": true,
    [`${PREFIX()}.status.vehicleState`]: "isDocked",
    [`${PREFIX()}.status.battery`]: 95,
    [`${PREFIX()}.status.descriptiveCapacityRemaining`]: "HIGH",
    [`${PREFIX()}.status.timestamp`]: Date.now(),
    [`${PREFIX()}.location.mowingPercentage`]: 25,
    [`${PREFIX()}.location.postureX`]: 4.75,
    [`${PREFIX()}.location.postureY`]: -1.25,
    [`${PREFIX()}.location.subtotalArea`]: 87.58,
    [`${PREFIX()}.location.mowingWeekArea`]: 1873.07,
    [`${PREFIX()}.location.taskDelay`]: false,
    [`${PREFIX()}.diagnostics.lastLocationAgeSeconds`]: 0,
    [`${PREFIX()}.diagnostics.locationMqttStale`]: false,
    [`${PREFIX()}.map`]: KARTE_A,
    [`${PREFIX()}.mapFrame`]: FRAME_JSON,
    [`${PREFIX()}.dockPosition`]: JSON.stringify({ x: 4.75, y: -1 }),
    [`${PREFIX()}.location.postureTheta`]: 1.2,
    // ohne Spur: die Kachel bleibt beim PNG des Adapters (der Umriss hat eigene Tests in rasenUmriss.test.ts)
    [`${PREFIX()}.mapTrack`]: 0,
    ...ueberschreiben,
  };
  mock.werte = new Map(Object.entries(w));
}
function setze(id: string, wert: unknown) {
  mock.werte.set(id.startsWith("navimow.0.") ? id : `${PREFIX()}.${id}`, wert);
}
/** Wie oft wurde genau dieser Datenpunkt abgerufen? (".map" darf nicht ".mapFrame" mitzählen) */
function abrufe(name: string) {
  return mock.fetchState.mock.calls.filter((c) => c[0] === `${PREFIX()}.${name}`).length;
}

beforeEach(() => {
  rawConfig.value = { mowerDevice: "navimow.0.DEMO0001" };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T14:00:00"));
  _zuruecksetzenFuerTests();
  mock.fetchState.mockClear();
  mock.setState.mockClear();
  mock.setState.mockImplementation(async () => true);
  fixtures();
});
afterEach(() => {
  _zuruecksetzenFuerTests();
  vi.useRealTimers();
});

// ───────── Tasten ─────────

describe("navimowAktionen", () => {
  it("bietet in jedem Zustand genau die abgesprochenen Tasten an", () => {
    expect(navimowAktionen("isDocked", true, true)).toEqual(["start"]);
    expect(navimowAktionen("isIdle", true, true)).toEqual(["start", "station"]);
    expect(navimowAktionen("isRunning", true, true)).toEqual(["pause", "station"]);
    expect(navimowAktionen("isPaused", true, true)).toEqual(["weiter", "station"]);
    expect(navimowAktionen("Error", true, true)).toEqual(["station"]);
    for (const z of ["isDocking", "isLifted", "isMapping", "inSoftwareUpdate", "Self-Checking", "Offline", "", "irgendwasNeues"]) {
      expect(navimowAktionen(z, true, true), z).toEqual([]);
    }
  });

  it("bietet NIE stop oder resetMap an und verträgt Leerzeichen im Wert", () => {
    for (const z of ALLE_ZUSTAENDE) {
      for (const a of navimowAktionen(z, true, true)) expect(["start", "weiter", "pause", "station"]).toContain(a);
    }
    expect(navimowAktionen(" isDocked ", true, true)).toEqual(["start"]);
  });

  it("zeigt in keinem Zustand Tasten, wenn Adapter oder ioBroker fehlen", () => {
    for (const z of ALLE_ZUSTAENDE) {
      expect(navimowAktionen(z, false, true), `${z} ohne Adapter`).toEqual([]);
      expect(navimowAktionen(z, true, false), `${z} ohne Backend`).toEqual([]);
      expect(navimowAktionen(z, false, false), `${z} ohne beides`).toEqual([]);
    }
  });
});

// ───────── Karte ─────────

describe("kartenPosition", () => {
  it("trifft die Station und den Mäher am echten PNG (y-Achse invertiert)", () => {
    const st = kartenPosition(FRAME, 4.75, -1);
    expect((st.leftProzent / 100) * FRAME.width).toBeCloseTo(543, 0);
    expect((st.topProzent / 100) * FRAME.height).toBeCloseTo(617, 0);
    expect(st.leftProzent).toBeCloseTo(67.9, 0);
    expect(st.topProzent).toBeCloseTo(89.9, 0);

    const mw = kartenPosition(FRAME, 4.75, -1.25);
    expect((mw.topProzent / 100) * FRAME.height).toBeCloseTo(623, 0);

    const spur = kartenPosition(FRAME, 0.5, 13);
    expect((spur.leftProzent / 100) * FRAME.width).toBeCloseTo(446, 0);
    expect((spur.topProzent / 100) * FRAME.height).toBeCloseTo(297, 0);
  });

  it("liefert für die Ecken 0 % und ~100 % (die Bildhöhe 686 ist auf ganze Pixel gerundet)", () => {
    expect(kartenPosition(FRAME, FRAME.minX, FRAME.maxY)).toEqual({ leftProzent: 0, topProzent: 0 });
    const unten = kartenPosition(FRAME, FRAME.maxX, FRAME.minY);
    expect(unten.leftProzent).toBeCloseTo(100, 5);
    expect(unten.topProzent).toBeCloseTo(100, 0);
  });
});

describe("istGueltigeKarte", () => {
  it("nimmt nur einen langen PNG-data-URL-String", () => {
    expect(istGueltigeKarte(KARTE_A)).toBe(true);
    expect(istGueltigeKarte("")).toBe(false);
    expect(istGueltigeKarte(0)).toBe(false);
    expect(istGueltigeKarte(null)).toBe(false);
    expect(istGueltigeKarte("data:text/html;base64," + "A".repeat(2000))).toBe(false);
    expect(istGueltigeKarte("data:image/png;base64," + "A".repeat(200))).toBe(false);
  });
});

describe("parseKartenFrame / parseStation", () => {
  it("liest das echte JSON und lehnt Unsinn ab", () => {
    expect(parseKartenFrame(FRAME_JSON)).toEqual(FRAME);
    expect(parseKartenFrame("")).toBeNull();
    expect(parseKartenFrame(0)).toBeNull();
    expect(parseKartenFrame("{kein json")).toBeNull();
    expect(parseKartenFrame(JSON.stringify({ ...FRAME, width: 0 }))).toBeNull();
    expect(parseKartenFrame(JSON.stringify({ minX: -19 }))).toBeNull();
    expect(parseStation('{"x":4.75,"y":-1}')).toEqual({ x: 4.75, y: -1 });
    expect(parseStation("")).toBeNull();
    expect(parseStation('{"x":"a","y":1}')).toBeNull();
  });
});

describe("kartenLadenNoetig", () => {
  const t0 = 1_000_000;
  const letzter: KartenVersuch = { zeit: t0, zustand: "isDocked", fortschritt: 25, flaeche: 87.58 };
  const gleich = (dt: number, aenderung: Partial<KartenVersuch> = {}): KartenVersuch => ({ ...letzter, zeit: t0 + dt, ...aenderung });

  it("lädt, wenn noch nie geladen wurde", () => {
    expect(kartenLadenNoetig(null, gleich(0))).toBe(true);
  });
  it("lädt beim Zustandswechsel, sofort", () => {
    expect(kartenLadenNoetig(letzter, gleich(1000, { zustand: "isRunning" }))).toBe(true);
  });
  it("lädt, wenn Fortschritt oder Fläche sich geändert haben", () => {
    expect(kartenLadenNoetig(letzter, gleich(1000, { fortschritt: 26 }))).toBe(true);
    expect(kartenLadenNoetig(letzter, gleich(1000, { flaeche: 90 }))).toBe(true);
  });
  it("lädt beim Mähen und Kartieren je Tick, im Stand nicht", () => {
    const maeht: KartenVersuch = { ...letzter, zustand: "isRunning" };
    expect(kartenLadenNoetig(maeht, { ...maeht, zeit: t0 + KARTE_MAEHEN_MS - 1 })).toBe(false);
    expect(kartenLadenNoetig(maeht, { ...maeht, zeit: t0 + KARTE_MAEHEN_MS })).toBe(true);
    const kartiert: KartenVersuch = { ...letzter, zustand: "isMapping" };
    expect(kartenLadenNoetig(kartiert, { ...kartiert, zeit: t0 + 90_000 })).toBe(true);
    expect(kartenLadenNoetig(letzter, gleich(90_000))).toBe(false);
    expect(kartenLadenNoetig(letzter, gleich(20 * 60_000))).toBe(false);
  });
  it("hat ein Sicherheitsnetz von 30 Minuten, egal welcher Zustand", () => {
    expect(kartenLadenNoetig(letzter, gleich(KARTE_SICHERHEITSNETZ_MS - 1))).toBe(false);
    expect(kartenLadenNoetig(letzter, gleich(KARTE_SICHERHEITSNETZ_MS))).toBe(true);
  });
  it("lädt beim Öffnen des Dialogs nur, wenn der letzte Abruf > 30 s her ist", () => {
    expect(kartenLadenNoetig(letzter, gleich(KARTE_DIALOG_MS), "dialog")).toBe(false);
    expect(kartenLadenNoetig(letzter, gleich(KARTE_DIALOG_MS + 1), "dialog")).toBe(true);
    // ein Zustandswechsel allein zählt beim Dialog nicht -- dafür ist der Tick da
    expect(kartenLadenNoetig(letzter, gleich(1000, { zustand: "isRunning" }), "dialog")).toBe(false);
    expect(kartenLadenNoetig(null, gleich(0), "dialog")).toBe(true);
  });
});

describe("karteLaden über poll()", () => {
  it("holt die Karte beim ersten Tick und danach im Stand nicht mehr", async () => {
    await navimowFeature.poll();
    expect(abrufe("map")).toBe(1);
    expect(karte.value).toBe(KARTE_A);
    expect(karteStand.value).toBe(Date.now());
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(90_000);
      await navimowFeature.poll();
    }
    expect(abrufe("map")).toBe(1);
  });

  it("lässt ein unverändertes Bild in Ruhe und setzt karteStand nur bei neuem Inhalt", async () => {
    await navimowFeature.poll();
    const standA = karteStand.value;
    vi.advanceTimersByTime(60_000);
    setze("status.vehicleState", "isRunning"); // Zustandswechsel → Abruf
    await navimowFeature.poll();
    expect(abrufe("map")).toBe(2);
    expect(karteStand.value).toBe(standA); // gleicher Inhalt → gleicher Stand
    vi.advanceTimersByTime(KARTE_MAEHEN_MS);
    setze("map", KARTE_B);
    await navimowFeature.poll();
    expect(karte.value).toBe(KARTE_B);
    expect(karteStand.value).toBe(Date.now());
  });

  it("lässt bei ungültigem oder scheiterndem Abruf das alte Bild stehen und markiert es", async () => {
    await navimowFeature.poll();
    setze("status.vehicleState", "isRunning");
    setze("map", "");
    await navimowFeature.poll();
    expect(karte.value).toBe(KARTE_A);
    expect(karteFehlgeschlagen.value).toBe(true);
    setze("status.vehicleState", "isPaused");
    setze("map", KARTE_A);
    await navimowFeature.poll();
    expect(karteFehlgeschlagen.value).toBe(false);
  });

  it("friert den Status NICHT ein, wenn nur der Kartenabruf wirft", async () => {
    mock.werte.delete(`${PREFIX()}.map`); // fetchState wirft dafür
    await expect(navimowFeature.poll()).resolves.toBeUndefined();
    expect(navimow.value.zustand).toBe("isDocked");
    expect(karte.value).toBeNull();
    expect(karteFehlgeschlagen.value).toBe(true);
  });

  it("lädt beim Dialog nur, wenn der letzte Abruf länger als 30 s her ist", async () => {
    await navimowFeature.poll();
    await karteLaden("dialog");
    expect(abrufe("map")).toBe(1);
    vi.advanceTimersByTime(KARTE_DIALOG_MS + 1);
    await karteLaden("dialog");
    expect(abrufe("map")).toBe(2);
  });
});

// ───────── Stillstand und Hilferufe ─────────

describe("Stillstandsuhr", () => {
  it("pausiert bei veralteter Position: 10 Polls mit stale=true und gleicher Position ergeben 0", async () => {
    setze("status.vehicleState", "isRunning");
    setze("location.postureX", 3);
    setze("location.postureY", 7);
    setze("diagnostics.locationMqttStale", true);
    for (let i = 0; i < 10; i++) {
      await navimowFeature.poll();
      vi.advanceTimersByTime(90_000);
    }
    expect(navimow.value.stillstandMin).toBe(0);
    // Die Stillstandsuhr schweigt zu Recht -- sie hat nichts gemessen. Seit dem 13.09. meldet
    // stattdessen die Funkstille selbst: „mäht, sendet aber seit 13 Minuten keine Position".
    // Vorher blieb genau diese Lage (festgefahren UND funkstill) völlig stumm.
    expect(maeherMeldungen(navimow.value).map((m) => m.schluessel)).toEqual(["keine-position"]);
  });

  it("pausiert ebenso bei lastLocationAgeSeconds > 300 und bei Position 0/0", async () => {
    setze("status.vehicleState", "isRunning");
    setze("location.postureX", 3);
    setze("location.postureY", 7);
    setze("diagnostics.lastLocationAgeSeconds", 900);
    for (let i = 0; i < 10; i++) { await navimowFeature.poll(); vi.advanceTimersByTime(90_000); }
    expect(navimow.value.stillstandMin).toBe(0);

    setze("diagnostics.lastLocationAgeSeconds", 0);
    setze("location.postureX", 0);
    setze("location.postureY", 0);
    for (let i = 0; i < 10; i++) { await navimowFeature.poll(); vi.advanceTimersByTime(90_000); }
    expect(navimow.value.stillstandMin).toBe(0);
    expect(navimow.value.x).toBe(0);
  });

  it("zählt bei gültiger, stehender Position weiter und meldet ab 8 min „festgefahren“", async () => {
    setze("status.vehicleState", "isRunning");
    setze("location.postureX", 3);
    setze("location.postureY", 7);
    for (let i = 0; i < 6; i++) { await navimowFeature.poll(); vi.advanceTimersByTime(90_000); }
    expect(navimow.value.stillstandMin).toBeGreaterThanOrEqual(7);
    await navimowFeature.poll();
    expect(navimow.value.stillstandMin).toBeGreaterThanOrEqual(8);
    expect(maeherMeldungen(navimow.value).map((m) => m.schluessel)).toEqual(["festgefahren"]);

    // Bewegung > 40 cm setzt die Uhr zurück
    setze("location.postureX", 4);
    await navimowFeature.poll();
    expect(navimow.value.stillstandMin).toBe(0);
  });
});

describe("maeherMeldungen", () => {
  const basis: Pick<Navimow, "zustand" | "stillstandMin" | "adapterVerbunden"> = { zustand: "isRunning", stillstandMin: 0, adapterVerbunden: true };

  it("liefert dieselben Schlüssel und Texte wie bisher", () => {
    expect(maeherMeldungen({ ...basis, zustand: "Error" })).toEqual([
      { schluessel: "stoerung", text: "Der Mäher meldet eine Störung und steht.", icon: "mdi-alert-circle" },
    ]);
    expect(maeherMeldungen({ ...basis, zustand: "isLifted" })).toEqual([
      { schluessel: "angehoben", text: "Der Mäher wurde angehoben oder sitzt auf einem Hindernis auf.", icon: "mdi-arrow-up-bold-box" },
    ]);
    expect(maeherMeldungen({ ...basis, stillstandMin: 9 })).toEqual([
      {
        schluessel: "festgefahren",
        text: "Der Mäher steht seit 9 Minuten an derselben Stelle, obwohl er mäht. Wahrscheinlich hat er sich festgefahren.",
        icon: "mdi-help-rhombus",
      },
    ]);
    expect(maeherMeldungen({ ...basis, stillstandMin: 7 })).toEqual([]);
    expect(maeherMeldungen({ ...basis, zustand: "isDocked" })).toEqual([]);
  });

  it("liefert ohne Adapterverbindung leer -- die Werte wären Konserve", () => {
    expect(maeherMeldungen({ ...basis, adapterVerbunden: false, zustand: "Error", stillstandMin: 20 })).toEqual([]);
  });
});

// ───────── Fortschritt ─────────

describe("fortschrittBewerten", () => {
  it("zeigt die Konserve aus dem Dock nicht und wartet auf die erste Änderung nach dem Start", () => {
    let g = { gesehen: false, vorStart: 0 };
    let r = fortschrittBewerten("isDocked", "", 25, g);
    expect(r.anzeige).toBeNull();
    r = fortschrittBewerten("isRunning", "isDocked", 25, r.gedaechtnis); // Start, Wert steht noch
    expect(r.anzeige).toBeNull();
    r = fortschrittBewerten("isRunning", "isRunning", 0, r.gedaechtnis); // Reset auf 0: nie „0 % gemäht"
    expect(r.anzeige).toBeNull();
    r = fortschrittBewerten("isRunning", "isRunning", 3, r.gedaechtnis);
    expect(r.anzeige).toBe(3);
    r = fortschrittBewerten("isPaused", "isRunning", 3, r.gedaechtnis); // Pause behält ihn
    expect(r.anzeige).toBe(3);
    r = fortschrittBewerten("isRunning", "isPaused", 4, r.gedaechtnis); // Weiter ist kein neuer Start
    expect(r.anzeige).toBe(4);
    r = fortschrittBewerten("isDocked", "isRunning", 40, r.gedaechtnis); // im Dock nie
    expect(r.anzeige).toBeNull();
  });

  it("wird über poll() wirksam", async () => {
    await navimowFeature.poll(); // isDocked, 25
    expect(navimow.value.fortschritt).toBeNull();
    setze("status.vehicleState", "isRunning");
    await navimowFeature.poll();
    expect(navimow.value.fortschritt).toBeNull();
    setze("location.mowingPercentage", 26);
    await navimowFeature.poll();
    expect(navimow.value.fortschritt).toBe(26);
  });
});

// ───────── Hinweiszeile, Texte ─────────

describe("hinweisText", () => {
  const m = (t: Partial<Navimow>): Navimow => ({
    adapterVerbunden: true, zustand: "isRunning", akku: 80, akkuText: "HIGH", statusZeit: Date.now(), fortschritt: null,
    x: 1, y: 1, winkel: 0, stillstandMin: 0, positionStummMin: 0, positionAlterSek: 0, positionVeraltet: false, maehenVerschoben: false,
    wochenFlaeche: 0, letzteFlaeche: 0, ...t,
  });

  it("hält die Reihenfolge Stillstand > Position veraltet > verschoben > Stand", () => {
    const jetzt = Date.now();
    const alt = jetzt - 11 * 60_000;
    expect(hinweisText(m({ stillstandMin: 3, positionVeraltet: true, maehenVerschoben: true, statusZeit: alt }), jetzt)?.text).toBe("steht seit 3 min an derselben Stelle");
    expect(hinweisText(m({ stillstandMin: 2, positionVeraltet: true, maehenVerschoben: true, statusZeit: alt }), jetzt)?.text).toBe("Position veraltet");
    expect(hinweisText(m({ positionAlterSek: 301, maehenVerschoben: true }), jetzt)?.text).toBe("Position veraltet");
    expect(hinweisText(m({ maehenVerschoben: true, statusZeit: alt }), jetzt)).toEqual({ text: "Mähen verschoben, z. B. wegen Regen", farbe: "orange" });
    const stand = hinweisText(m({ statusZeit: alt }), jetzt);
    expect(stand?.farbe).toBe("grau");
    expect(stand?.text).toMatch(/^Stand \d\d:\d\d$/);
    expect(hinweisText(m({}), jetzt)).toBeNull();
  });

  it("meldet „Position veraltet“ nur beim Mähen oder Pausieren", () => {
    const jetzt = Date.now();
    expect(hinweisText(m({ zustand: "isDocked", positionVeraltet: true }), jetzt)).toBeNull();
    expect(hinweisText(m({ zustand: "isPaused", positionVeraltet: true }), jetzt)?.text).toBe("Position veraltet");
  });
});

describe("Texte", () => {
  it("übersetzt Zustände, fängt leer und unbekannt ab", () => {
    expect(zustandText("isRunning")).toBe("mäht");
    expect(zustandText(" isDocked ")).toBe("in der Station");
    expect(zustandText("")).toBe("noch keine Daten");
    expect(zustandText("irgendwasNeues")).toBe("unbekannt");
  });
  it("zeigt den Akku als Prozent oder als Cloud-Stufe", () => {
    expect(akkuAnzeige({ akku: 95, akkuText: "HIGH", adapterVerbunden: true })).toBe("95 %");
    expect(akkuAnzeige({ akku: 0, akkuText: "MEDIUM", adapterVerbunden: true })).toBe("mittel");
    expect(akkuAnzeige({ akku: 0, akkuText: "MEDIUM", adapterVerbunden: false })).toBe("0 %");
  });
  it("rundet Flächen deutsch und zeigt für 0 einen Strich", () => {
    expect(flaecheAnzeige(1873.07)).toBe("1.873 m²");
    expect(flaecheAnzeige(87.58)).toBe("88 m²");
    expect(flaecheAnzeige(0)).toBe("–");
    expect(flaecheAnzeige(NaN)).toBe("–");
  });
});

// ───────── Rückmeldung ─────────

describe("rueckmeldung", () => {
  const b: BefehlOffen = { aktion: "station", ziele: ["isDocking", "isDocked"], zustandVorher: "isRunning", bis: 120_000 };
  it("unterscheidet offen, erfüllt, verfallen und abgelaufen", () => {
    expect(rueckmeldung(b, "isRunning", 10_000)).toBe("offen");
    expect(rueckmeldung(b, "isDocking", 10_000)).toBe("erfuellt");
    expect(rueckmeldung(b, "isDocked", 200_000)).toBe("erfuellt");
    expect(rueckmeldung(b, "Error", 10_000)).toBe("verfallen");
    expect(rueckmeldung(b, "isRunning", 120_000)).toBe("abgelaufen");
  });
});

describe("navimowBefehl", () => {
  it("schreibt genau den remote-Datenpunkt und merkt sich die Erwartung", async () => {
    await navimowFeature.poll();
    setze("status.vehicleState", "isRunning");
    await navimowFeature.poll();
    expect(await navimowBefehl("station")).toBe(true);
    expect(mock.setState).toHaveBeenCalledTimes(1);
    expect(mock.setState).toHaveBeenCalledWith(`${PREFIX()}.remote.dock`, true);
    expect(befehlOffen.value).toMatchObject({ aktion: "station", zustandVorher: "isRunning", bis: Date.now() + ERWARTUNG_MS });
  });

  it("verwirft den zweiten Tipp in der Sperre statt ihn zu puffern", async () => {
    await navimowFeature.poll();
    expect(await navimowBefehl("start")).toBe(true);
    expect(await navimowBefehl("start")).toBe(false);
    expect(await navimowTippen("start")).toBe("verworfen");
    expect(mock.setState).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_500);
    expect(befehlLaeuft.value).toBe(false);
  });

  it("meldet rot, wenn ioBroker den Befehl nicht annimmt, und öffnet keine Erwartung", async () => {
    mock.setState.mockImplementation(async () => false);
    await navimowFeature.poll();
    expect(await navimowBefehl("station")).toBe(false);
    expect(befehlOffen.value).toBeNull();
    expect(befehlMeldung.value).toEqual({ art: "fehler", text: "Befehl kam nicht bei ioBroker an." });
    vi.advanceTimersByTime(6_000);
    expect(befehlMeldung.value).toBeNull();
  });

  it("meldet ✓ angekommen, sobald der Nachpoll das Ziel sieht -- ohne Kartenabruf", async () => {
    await navimowFeature.poll();
    const karten = abrufe("map");
    await navimowBefehl("start");
    setze("status.vehicleState", "isRunning");
    await vi.advanceTimersByTimeAsync(2_100);
    expect(befehlOffen.value).toBeNull();
    expect(befehlMeldung.value).toEqual({ art: "ok", text: "✓ angekommen" });
    expect(abrufe("map")).toBe(karten);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(befehlMeldung.value).toBeNull();
  });

  it("meldet nach 120 s ohne Wechsel orange, und ein Zustandswechsel räumt die Zeile", async () => {
    await navimowFeature.poll();
    await navimowBefehl("start");
    await vi.advanceTimersByTimeAsync(ERWARTUNG_MS + 500);
    expect(befehlOffen.value).toBeNull();
    expect(befehlMeldung.value?.art).toBe("warnung");
    expect(befehlMeldung.value?.text).toContain("hat nicht reagiert");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(befehlMeldung.value?.art).toBe("warnung"); // bleibt stehen
    setze("status.vehicleState", "isIdle");
    await navimowFeature.poll();
    expect(befehlMeldung.value).toBeNull();
  });

  it("lässt die Erwartung stumm verfallen, wenn ein anderer Zustand kommt", async () => {
    await navimowFeature.poll();
    await navimowBefehl("start");
    setze("status.vehicleState", "Error");
    await vi.advanceTimersByTimeAsync(2_100);
    expect(befehlOffen.value).toBeNull();
    expect(befehlMeldung.value).toBeNull();
  });

  it("protokolliert im Trockenlauf statt zu schreiben", async () => {
    vi.stubEnv("VITE_NAVIMOW_TROCKEN", "1");
    try {
      await navimowFeature.poll();
      expect(await navimowBefehl("start")).toBe(true);
      expect(mock.setState).not.toHaveBeenCalled();
      expect(befehlOffen.value?.aktion).toBe("start");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("navimowTippen (Zweitbestätigung)", () => {
  it("verlangt für Start zwei Tipps binnen 5 s, für Zur Station einen", async () => {
    await navimowFeature.poll();
    expect(await navimowTippen("start")).toBe("bestaetigen");
    expect(bestaetigung.value?.aktion).toBe("start");
    expect(mock.setState).not.toHaveBeenCalled();
    expect(await navimowTippen("start")).toBe("gesendet");
    expect(mock.setState).toHaveBeenCalledWith(`${PREFIX()}.remote.start`, true);
    expect(bestaetigung.value).toBeNull();

    vi.advanceTimersByTime(3_000);
    expect(await navimowTippen("station")).toBe("gesendet");
    expect(mock.setState).toHaveBeenLastCalledWith(`${PREFIX()}.remote.dock`, true);
  });

  it("fällt ohne zweiten Tipp nach 5 s zurück", async () => {
    await navimowFeature.poll();
    expect(await navimowTippen("weiter")).toBe("bestaetigen");
    vi.advanceTimersByTime(5_100);
    expect(bestaetigung.value).toBeNull();
    expect(await navimowTippen("weiter")).toBe("bestaetigen"); // wieder von vorn
    expect(mock.setState).not.toHaveBeenCalled();
  });
});

// --- Nachgebessert am 2026-09-13 (zwei Review-Befunde) -----------------------------
describe("Stillstandsuhr bei Datenlücken", () => {
  it("meldet »keine Position«, wenn er mäht und lange nichts sendet", () => {
    // Der Zielfall: festgefahren UND funkstill. Die Stillstandsuhr pausiert dann mangels
    // Messung -- ohne diese zweite Meldung bliebe genau diese Lage stumm.
    expect(
      maeherMeldungen({ zustand: "isRunning", stillstandMin: 0, adapterVerbunden: true, positionStummMin: POSITION_STUMM_MIN }),
    ).toEqual([expect.objectContaining({ schluessel: "keine-position" })]);
  });

  it("schweigt, solange die Funkstille kurz ist", () => {
    expect(
      maeherMeldungen({ zustand: "isRunning", stillstandMin: 0, adapterVerbunden: true, positionStummMin: POSITION_STUMM_MIN - 1 }),
    ).toEqual([]);
  });

  it("meldet nichts, wenn er gar nicht mäht", () => {
    expect(
      maeherMeldungen({ zustand: "isDocked", stillstandMin: 0, adapterVerbunden: true, positionStummMin: 99 }),
    ).toEqual([]);
  });

  it("meldet beides, wenn er steht UND nichts sendet", () => {
    const m = maeherMeldungen({ zustand: "isRunning", stillstandMin: 20, adapterVerbunden: true, positionStummMin: 20 });
    expect(m.map((x) => x.schluessel).sort()).toEqual(["festgefahren", "keine-position"]);
  });
});
