/**
 * Was die Speedtest-Kachel aus der Messdatei macht.
 *
 * Der wichtigste Test ist die Bewertung: Sie hat bewusst KEINEN festen
 * Sollwert, denn was „gut" ist, hängt am Vertrag. Verglichen wird gegen den
 * eigenen Mittelwert der letzten Messungen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rawConfig } from "../src-www/lib/store";
import { speedtest, poll, bewertung } from "../src-www/features/speedtest";

function antwortMit(daten: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => daten });
}

const messung = {
  ok: true, stand: "2026-09-14T20:40:00", runter: 95.4, hoch: 85.2,
  ping: 10.5, jitter: 1.3, server: "Frankfurt, Germany (FS IT-Systeme GmbH)",
  mittel_runter: 92.0,
  verlauf: [{ wann: "2026-09-14T06:10:00", runter: 90.1, hoch: 84, ping: 11 },
            { wann: "2026-09-14T13:10:00", runter: 95.4, hoch: 85, ping: 10 }],
};

beforeEach(() => {
  rawConfig.value = { speedtestUrl: "http://192.168.1.20/speedtest.json" };
  speedtest.value = {
    ok: false, stand: null, runter: 0, hoch: 0, ping: 0, jitter: 0,
    server: "", mittelRunter: 0, verlauf: [], erreichbar: true,
  };
  vi.restoreAllMocks();
});

describe("Messwerte holen", () => {
  it("übernimmt die letzte Messung samt Verlauf", async () => {
    vi.stubGlobal("fetch", antwortMit(messung));
    await poll();
    expect(speedtest.value.runter).toBe(95.4);
    expect(speedtest.value.hoch).toBe(85.2);
    expect(speedtest.value.mittelRunter).toBe(92);
    expect(speedtest.value.verlauf).toHaveLength(2);
    expect(speedtest.value.stand?.getHours()).toBe(20);
  });

  it("merkt sich, wenn die Datei fehlt, statt Nullen zu zeigen", async () => {
    vi.stubGlobal("fetch", antwortMit({}, false));
    await poll();
    expect(speedtest.value.erreichbar).toBe(false);
  });

  it("übernimmt eine fehlgeschlagene Messung als solche", async () => {
    vi.stubGlobal("fetch", antwortMit({ ok: false, stand: "2026-09-14T20:40:00" }));
    await poll();
    expect(speedtest.value.ok).toBe(false);
  });
});

describe("Die Bewertung misst gegen den eigenen Mittelwert", () => {
  const basis = { ...speedtest.value, mittelRunter: 90 };

  it("nennt eine normale Messung gut", () => {
    expect(bewertung({ ...basis, runter: 88 })).toBe("gut");
  });

  it("nennt zwei Drittel schwach", () => {
    expect(bewertung({ ...basis, runter: 55 })).toBe("schwach");
  });

  it("nennt ein Drittel schlecht", () => {
    expect(bewertung({ ...basis, runter: 30 })).toBe("schlecht");
  });

  it("urteilt nicht, solange es keinen Mittelwert gibt", () => {
    expect(bewertung({ ...basis, mittelRunter: 0, runter: 5 })).toBe("gut");
  });

  it("ein schnellerer Anschluss als sonst ist kein Fehler", () => {
    expect(bewertung({ ...basis, runter: 250 })).toBe("gut");
  });
});
