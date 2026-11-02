/**
 * Prüft die Kachel-Logik ohne Oberfläche.
 *
 * Der Schwerpunkt liegt auf dem, was im Alltag schiefgehen kann: Server weg,
 * Antwort unvollständig, Abhaken scheitert. Eine Küchenkachel, die bei einem
 * Netzfehler eine leere oder falsche Liste zeigt, ist schlimmer als eine, die
 * sagt "ich komme nicht dran".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rawConfig } from "../src-www/lib/store";
import { aufgaben, poll, abhaken, nebenzeile, HOECHSTENS, serverAdresse, notizZeilen, vorWieLange } from "../src-www/features/aufgaben";
import type { KachelAufgabe } from "../src-www/features/aufgaben";

const personen = {
  max: { name: "Max", farbe: "#0f6e6e" },
  anna: { name: "Anna", farbe: "#6b4e9e" },
};

const werkstatt: KachelAufgabe = {
  id: "a1", titel: "Bei der Werkstatt anrufen", prio: "dringend",
  beteiligte: ["anna"], anhaenge: 1, versuche: 2,
  letzter_versuch: "2026-09-13T11:40:00+00:00",
  schritt: null,
};

const schrank: KachelAufgabe = {
  id: "a2", titel: "Schrank im Keller aufbauen", prio: "normal",
  beteiligte: ["max", "anna"], anhaenge: 3, versuche: 0, letzter_versuch: null,
  schritt: { id: "s1", text: "Aussortieren, was weg kann", nr: 1, von: 2, zustaendig: "beide" },
};

function antwortMit(daten: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok, status: ok ? 200 : 503, json: async () => daten,
  });
}

beforeEach(() => {
  rawConfig.value = { aufgabenUrl: "http://192.168.1.20:8091" };
  aufgaben.value = { aufgaben: [], personen: {}, dringend: 0, wartend: 0, stand: null,
                     erreichbar: true, bilanz: { erledigt: 0, je_person: {} } };
  vi.restoreAllMocks();
});

describe("Daten holen", () => {
  it("übernimmt Aufgaben, Personen und die Zahl der dringenden", async () => {
    vi.stubGlobal("fetch", antwortMit({ aufgaben: [werkstatt, schrank], personen, dringend: 1 }));
    await poll();
    expect(aufgaben.value.aufgaben).toHaveLength(2);
    expect(aufgaben.value.dringend).toBe(1);
    expect(aufgaben.value.personen.max.farbe).toBe("#0f6e6e");
    expect(aufgaben.value.erreichbar).toBe(true);
    expect(aufgaben.value.stand).toBeInstanceOf(Date);
  });

  it("behält den letzten Stand, wenn der Server weg ist, markiert ihn aber als alt", async () => {
    vi.stubGlobal("fetch", antwortMit({ aufgaben: [werkstatt], personen, dringend: 1 }));
    await poll();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("kein Netz")));
    await poll();
    expect(aufgaben.value.aufgaben).toHaveLength(1);      // nicht leer geräumt
    expect(aufgaben.value.erreichbar).toBe(false);
  });

  it("wertet einen Fehlercode als nicht erreichbar, nicht als leere Liste", async () => {
    vi.stubGlobal("fetch", antwortMit({}, false));
    await poll();
    expect(aufgaben.value.erreichbar).toBe(false);
  });

  it("kommt mit einer unvollständigen Antwort zurecht", async () => {
    vi.stubGlobal("fetch", antwortMit({}));
    await poll();
    expect(aufgaben.value.aufgaben).toEqual([]);
    expect(aufgaben.value.dringend).toBe(0);
    expect(aufgaben.value.erreichbar).toBe(true);
  });
});

describe("Abhaken in der Küche", () => {
  it("hakt den nächsten offenen SCHRITT ab, nicht die ganze Aufgabe", async () => {
    const ruf = antwortMit({ ok: true });
    vi.stubGlobal("fetch", ruf);
    await abhaken(schrank);
    const [, optionen] = ruf.mock.calls[0];
    expect(JSON.parse(optionen.body)).toEqual({ aufgabe_id: "a2", schritt_id: "s1" });
  });

  it("schickt ohne Schritte nur die Aufgabe", async () => {
    const ruf = antwortMit({ ok: true });
    vi.stubGlobal("fetch", ruf);
    await abhaken(werkstatt);
    expect(JSON.parse(ruf.mock.calls[0][1].body)).toEqual({ aufgabe_id: "a1", schritt_id: null });
  });

  it("meldet false, wenn der Server nicht mitspielt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("weg")));
    expect(await abhaken(werkstatt)).toBe(false);
  });

  it("zeigt sofort an, dass der Server weg ist — wer tippt, darf nicht raten", async () => {
    aufgaben.value = { ...aufgaben.value, aufgaben: [werkstatt], erreichbar: true };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("weg")));
    await abhaken(werkstatt);
    expect(aufgaben.value.erreichbar).toBe(false);
    expect(aufgaben.value.aufgaben).toHaveLength(1);      // die Zeile bleibt stehen
  });

  it("auch ein abgelehnter Haken (HTTP-Fehler) setzt das Band", async () => {
    aufgaben.value = { ...aufgaben.value, aufgaben: [werkstatt], erreichbar: true };
    vi.stubGlobal("fetch", antwortMit({}, false));
    await abhaken(werkstatt);
    expect(aufgaben.value.erreichbar).toBe(false);
  });
});

describe("Die Zeile unter dem Titel", () => {
  it("nennt Schritt von wievielen und wer zuständig ist", () => {
    const t = nebenzeile(schrank, personen);
    expect(t).toContain("Schritt 1 von 2");
    expect(t).toContain("Aussortieren");
    expect(t).toContain("beide");
  });

  it("zählt Versuche, damit niemand für untätig gehalten wird", () => {
    expect(nebenzeile(werkstatt, personen)).toContain("2-mal versucht");
  });

  it("bleibt bei einer schlichten Aufgabe leer", () => {
    expect(nebenzeile({ ...werkstatt, versuche: 0, schritt: null }, personen)).toBe("");
  });

  it("erfindet keinen Namen für eine unbekannte Person", () => {
    const fremd = { ...schrank, schritt: { ...schrank.schritt!, zustaendig: "gast" } };
    expect(nebenzeile(fremd, personen)).not.toContain("undefined");
  });
});

describe("Die Kachel bleibt eine Kachel", () => {
  it("zeigt höchstens sechs Zeilen", () => {
    expect(HOECHSTENS).toBe(6);
  });
});

describe("Die Adresse des Servers", () => {
  it("nimmt die eingebaute Adresse, wenn nichts gesetzt ist", () => {
    expect(serverAdresse(undefined)).toBe("");
    expect(serverAdresse(null)).toBe("");
  });

  it("nimmt sie auch bei einem LEEREN Wert — genau das ging am 13.09. schief", () => {
    // Vite ersetzt die Variable beim Bauen durch "", wenn sie in der Shell
    // fehlt. Mit `??` blieb die Adresse leer, die Kachel fragte den falschen
    // Server und meldete „nicht erreichbar".
    expect(serverAdresse("")).toBe("");
    expect(serverAdresse("   ")).toBe("");
  });

  it("übernimmt eine gesetzte Adresse", () => {
    expect(serverAdresse("http://127.0.0.1:9/aufgaben")).toBe("http://127.0.0.1:9/aufgaben");
  });

  it("schneidet einen Schrägstrich am Ende ab, damit keine doppelten entstehen", () => {
    expect(serverAdresse("http://beispiel.de/")).toBe("http://beispiel.de");
  });
});


describe("Was die Küche im Popup sieht", () => {
  it("übernimmt die Bilanz vom Server -- sie überlebt das Aufräumen in der App", async () => {
    vi.stubGlobal("fetch", antwortMit({
      aufgaben: [], personen, dringend: 0, bilanz: { erledigt: 42, je_person: { max: 40 } },
    }));
    await poll();
    expect(aufgaben.value.bilanz.erledigt).toBe(42);
  });

  it("kommt ohne Bilanz zurecht (älterer Server)", async () => {
    vi.stubGlobal("fetch", antwortMit({ aufgaben: [], personen, dringend: 0 }));
    await poll();
    expect(aufgaben.value.bilanz).toEqual({ erledigt: 0, je_person: {} });
  });

  it("nimmt der Notiz die Auszeichnung, statt sie anzuzeigen", () => {
    const zeilen = notizZeilen("**Wichtig**: _Maße_ pruefen\n- Schrauben ~~M4~~ M5\n\n");
    expect(zeilen).toEqual([
      { text: "Wichtig: Maße pruefen", punkt: false },
      { text: "Schrauben M5", punkt: true },
    ]);
  });

  it("lässt Dateinamen mit Unterstrichen in Ruhe", () => {
    expect(notizZeilen("keller_plan_2026.pdf")[0].text).toBe("keller_plan_2026.pdf");
  });

  it("gibt für eine fehlende Notiz nichts zurück", () => {
    expect(notizZeilen(undefined)).toEqual([]);
    expect(notizZeilen("")).toEqual([]);
  });

  it("sagt, wie lange ein Versuch her ist", () => {
    const jetzt = new Date("2026-09-13T20:00:00Z");
    expect(vorWieLange("2026-09-13T19:59:30Z", jetzt)).toBe("gerade eben");
    expect(vorWieLange("2026-09-13T19:30:00Z", jetzt)).toBe("vor 30 Minuten");
    expect(vorWieLange("2026-09-13T15:00:00Z", jetzt)).toBe("vor 5 Stunden");
    expect(vorWieLange("2026-09-11T20:00:00Z", jetzt)).toBe("vor 2 Tagen");
    expect(vorWieLange("2026-09-12T20:00:00Z", jetzt)).toBe("vor 1 Tag");
  });

  it("erfindet keine Zeitangabe, wenn nichts dasteht", () => {
    expect(vorWieLange(null)).toBe("");
    expect(vorWieLange("kein datum")).toBe("");
  });
});


describe("Wartende Aufgaben", () => {
  it("übernimmt die Zahl der wartenden vom Server", async () => {
    vi.stubGlobal("fetch", antwortMit({ aufgaben: [], personen, dringend: 0, wartend: 3 }));
    await poll();
    expect(aufgaben.value.wartend).toBe(3);
  });

  it("kommt ohne die Angabe zurecht (älterer Server)", async () => {
    vi.stubGlobal("fetch", antwortMit({ aufgaben: [], personen, dringend: 0 }));
    await poll();
    expect(aufgaben.value.wartend).toBe(0);
  });
});
