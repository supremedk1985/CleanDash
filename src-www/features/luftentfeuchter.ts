/**
 * luftentfeuchter.ts
 * ------------------
 * Ein Luftentfeuchter an einer Steckdose mit Tasmota (ioBroker-Adapter sonoff): Verbrauch, An-/Aus-Zeiten, Schalter, Verlauf.
 *
 * Zwei Quellen:
 *   - die aktuellen Werte (Schalter, Leistung, kWh heute/gestern/gesamt, erreichbar) per getBulk im schnellen Takt,
 *   - der Verlauf aus dem Standard-History-Adapter (Aufzeichnung für POWER und ENERGY_Power einschalten). Die Steckdose
 *     schreibt Leistung bei jeder Änderung und spätestens alle 10 Minuten, den Schalter bei jedem Wechsel.
 *
 * Ein Entfeuchter steht oft eingeschaltet herum, ohne zu laufen (Wassertank voll, Zielfeuchte erreicht). Deshalb zwei
 * Begriffe: „an" = die Steckdose gibt Strom, „läuft" = er zieht mehr als LAEUFT_AB_W (der Verdichter arbeitet).
 *
 * Alles, was rechnet, steht hier als reine Funktion — getestet in luftentfeuchter.test.ts.
 */
import { ref } from "vue";
import { fetchBulk, history, setState } from "../compat/iobroker";
import { rawConfig } from "../lib/store";
import type { FeatureModule } from "./registry";

/** The Tasmota plug of the dehumidifier (sonoff adapter) from the settings, e.g. sonoff.0.<device> */
export const P = () => rawConfig.value.dehumidifierDevice ?? "";
export const ID = {
  get an() { return `${P()}.POWER`; },
  get leistung() { return `${P()}.ENERGY_Power`; },
  get heute() { return `${P()}.ENERGY_Today`; },
  get gestern() { return `${P()}.ENERGY_Yesterday`; },
  get gesamt() { return `${P()}.ENERGY_Total`; },
  get erreichbar() { return `${P()}.alive`; },
};

/** Ab dieser Leistung „läuft" er (Verdichter). Im Leerlauf zieht er ~20 W, im Betrieb ~150 W (an einem Gerät gemessen). */
export const LAEUFT_AB_W = 60;

/** Ein Messpunkt aus dem History-Adapter: Wert und Zeit in ms */
export type Punkt = [number | boolean | null, number];

export interface Luftentfeuchter {
  geladen: boolean;
  an: boolean;
  leistung: number;
  heute: number;
  gestern: number;
  gesamt: number;
  erreichbar: boolean;
  /** Letzte 24 Stunden: Schalter und Leistung (für „an seit", Laufzeit heute und die kleine Kurve) */
  schalter24: Punkt[];
  leistung24: Punkt[];
}

export const luftentfeuchter = ref<Luftentfeuchter>({
  geladen: false, an: false, leistung: 0, heute: 0, gestern: 0, gesamt: 0, erreichbar: true, schalter24: [], leistung24: [],
});

// --- reine Funktionen ---------------------------------------------------------------------------------------------

export type Zustand = "läuft" | "bereit" | "aus" | "weg";

export function zustand(l: Pick<Luftentfeuchter, "an" | "leistung" | "erreichbar">): Zustand {
  if (!l.erreichbar) return "weg";
  if (!l.an) return "aus";
  return l.leistung >= LAEUFT_AB_W ? "läuft" : "bereit";
}

export interface Abschnitt {
  an: boolean;
  von: number;
  bis: number;
}

/**
 * Schaltzeiten aus den Schalter-Punkten: aufeinanderfolgende gleiche Werte zusammengefasst (history schreibt manche
 * Werte doppelt), der letzte Abschnitt reicht bis `jetzt`. Punkte vor `ab` zählen nur für den Anfangszustand.
 */
export function abschnitte(punkte: Punkt[], ab: number, jetzt: number): Abschnitt[] {
  const sortiert = punkte.filter((p) => p[0] !== null).sort((a, b) => a[1] - b[1]);
  const aus: Abschnitt[] = [];
  const setzen = (an: boolean, von: number) => {
    const letzter = aus[aus.length - 1];
    if (letzter && letzter.an === an) return;
    if (letzter) letzter.bis = von;
    aus.push({ an, von, bis: jetzt });
  };
  // Zustand am Fensteranfang: der letzte Punkt davor
  let davor: boolean | null = null;
  for (const [w, t] of sortiert) { if (t <= ab) davor = w === true || w === 1; else break; }
  if (davor !== null) setzen(davor, ab);
  for (const [w, t] of sortiert) {
    if (t <= ab) continue;
    if (t >= jetzt) break;
    setzen(w === true || w === 1, t);
  }
  return aus;
}

/** Seit wann gilt der aktuelle Schaltzustand? null, wenn der Verlauf es nicht hergibt. */
export function seit(punkte: Punkt[], an: boolean, jetzt: number): number | null {
  const a = abschnitte(punkte, 0, jetzt);
  const letzter = a[a.length - 1];
  return letzter && letzter.an === an && letzter.von > 0 ? letzter.von : null;
}

/**
 * Wie lange er zwischen `ab` und `jetzt` gelaufen ist (Leistung >= LAEUFT_AB_W), in ms. Treppenfunktion: ein Wert gilt
 * bis zum nächsten Punkt. Liegt der letzte Punkt mehr als `luecke` zurück (Steckdose weg), zählt danach nichts mehr.
 */
export function laufzeit(punkte: Punkt[], ab: number, jetzt: number, luecke = 15 * 60_000): number {
  const s = punkte.filter((p) => typeof p[0] === "number").sort((a, b) => a[1] - b[1]);
  let summe = 0;
  for (let i = 0; i < s.length; i++) {
    const [w, t] = s[i];
    const ende = Math.min(i + 1 < s.length ? s[i + 1][1] : jetzt, t + luecke, jetzt);
    const anfang = Math.max(t, ab);
    if ((w as number) >= LAEUFT_AB_W && ende > anfang) summe += ende - anfang;
  }
  return summe;
}

/** Mittlere Leistung je Stunde der letzten 24 Stunden (24 Werte, älteste zuerst) — für die kleine Kurve der Kachel */
export function stundenmittel(punkte: Punkt[], jetzt: number, luecke = 15 * 60_000): number[] {
  const s = punkte.filter((p) => typeof p[0] === "number").sort((a, b) => a[1] - b[1]);
  const start = jetzt - 24 * 3600_000;
  const aus: number[] = [];
  for (let h = 0; h < 24; h++) {
    const a = start + h * 3600_000, b = a + 3600_000;
    let energie = 0;
    for (let i = 0; i < s.length; i++) {
      const [w, t] = s[i];
      const ende = Math.min(i + 1 < s.length ? s[i + 1][1] : jetzt, t + luecke, b);
      const anfang = Math.max(t, a);
      if (ende > anfang) energie += (w as number) * (ende - anfang);
    }
    aus.push(Math.round(energie / 3600_000));
  }
  return aus;
}

/** Tagesverbrauch aus dem Verlauf von ENERGY_Today: je Kalendertag der höchste Wert (der Zähler springt um 0 Uhr auf 0) */
export function tageswerte(punkte: Punkt[]): { tag: string; kwh: number }[] {
  const je = new Map<string, number>();
  for (const [w, t] of punkte) {
    if (typeof w !== "number") continue;
    const d = new Date(t);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    je.set(k, Math.max(je.get(k) ?? 0, w));
  }
  return [...je.entries()].sort().map(([tag, kwh]) => ({ tag, kwh }));
}

export function dauerText(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function kwhText(kwh: number): string {
  return `${kwh.toLocaleString("de-DE", { minimumFractionDigits: kwh < 10 ? 2 : 1, maximumFractionDigits: kwh < 10 ? 2 : 1 })} kWh`;
}

export function uhr(t: number): string {
  return new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// --- Abrufe ---------------------------------------------------------------------------------------------------------

/**
 * Verlauf aus dem Standard-History-Adapter. `step` (ms) mit aggregate=average für lange Zeiträume, sonst die Rohwerte.
 * Antwortformat (Grafana-artig): [{ target: id, datapoints: [[wert, zeit], …] }, …].
 */
export async function verlaufLaden(ids: string[], ab: number, bis: number, step?: number): Promise<Record<string, Punkt[]>> {
  return history(ids, ab, bis, step) as Promise<Record<string, Punkt[]>>;
}

let verlaufZuletzt = 0;
const VERLAUF_ALLE_MS = 5 * 60_000;

export async function poll(): Promise<void> {
  const w = await fetchBulk(Object.values(ID));
  const zahl = (id: string) => (typeof w[id] === "number" ? (w[id] as number) : 0);
  const neu: Luftentfeuchter = {
    ...luftentfeuchter.value,
    geladen: true,
    an: w[ID.an] === true,
    leistung: zahl(ID.leistung),
    heute: zahl(ID.heute),
    gestern: zahl(ID.gestern),
    gesamt: zahl(ID.gesamt),
    erreichbar: w[ID.erreichbar] !== false,
  };
  // Hat sich der Schalter geändert, den Verlauf sofort neu holen — sonst stünde „an seit" bis zu 5 Minuten falsch
  const gewechselt = luftentfeuchter.value.geladen && luftentfeuchter.value.an !== neu.an;
  luftentfeuchter.value = neu;
  if (gewechselt || Date.now() - verlaufZuletzt > VERLAUF_ALLE_MS) {
    verlaufZuletzt = Date.now();
    try {
      const jetzt = Date.now();
      const v = await verlaufLaden([ID.an, ID.leistung], jetzt - 24 * 3600_000, jetzt);
      luftentfeuchter.value = { ...luftentfeuchter.value, schalter24: v[ID.an] ?? [], leistung24: v[ID.leistung] ?? [] };
    } catch {
      verlaufZuletzt = 0;   // beim nächsten Takt erneut — die aktuellen Werte bleiben davon unberührt
    }
  }
}

/** Ein- oder ausschalten; der Wert in der Kachel folgt sofort, bestätigt wird er beim nächsten Abruf */
export async function schalten(an: boolean): Promise<boolean> {
  const ok = await setState(ID.an, an);
  if (ok) luftentfeuchter.value = { ...luftentfeuchter.value, an };
  return ok;
}

export const luftentfeuchterFeature: FeatureModule = { name: "luftentfeuchter", interval: "fast", poll };
