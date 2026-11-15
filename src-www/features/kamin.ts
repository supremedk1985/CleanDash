import { computed, ref } from "vue";
import { fetchBulk, history } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

/**
 * Fireplace watched by a thermocouple in the flue pipe (the author's own device, not published) or any script that
 * fills a folder (stovePrefix) with: temperatur, zustand (kalt | brennt | nachlegen), kraft (0–1), hoechst,
 * schwelle, modul, erreichbar, meldung. The tile appears only while the fire burns. Format: README.
 */
export interface Kamin {
  temperatur?: number;
  zustand: string;
  kraft: number;
  hoechst?: number;
  schwelle?: number;
  modul?: number;
  erreichbar: boolean;
  meldung: string;
}

export const kamin = ref<Kamin>();

/** burning (or waiting for wood) and the device answers — then the tile is shown */
export function kaminBrennt(k: Pick<Kamin, "zustand" | "erreichbar"> | undefined): boolean {
  return !!k && k.erreichbar && (k.zustand === "brennt" || k.zustand === "nachlegen");
}
export const kaminSichtbar = computed(() => kaminBrennt(kamin.value));

const NAMEN = ["temperatur", "zustand", "kraft", "hoechst", "schwelle", "modul", "erreichbar", "meldung"] as const;

function zahl(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
}

async function poll() {
  const p = rawConfig.value.stovePrefix;
  if (!p) return;
  const w = await fetchBulk(NAMEN.map((n) => `${p}.${n}`));
  const g = (n: string) => w[`${p}.${n}`];
  kamin.value = {
    temperatur: zahl(g("temperatur")), zustand: String(g("zustand") ?? ""), kraft: zahl(g("kraft")) ?? 0,
    hoechst: zahl(g("hoechst")), schwelle: zahl(g("schwelle")), modul: zahl(g("modul")),
    erreichbar: g("erreichbar") === true || g("erreichbar") === "true", meldung: String(g("meldung") ?? ""),
  };
}

export const kaminFeature: FeatureModule = { name: "kamin", interval: "fast", poll };

// --- Verlauf und Analysen (für das Popup) -------------------------------------------------------------------------
//
// Alles, was rechnet, steht hier als reine Funktion — getestet in test/kamin-analyse.test.ts. Grundlage ist der
// Standard-History-Adapter von ioBroker, der die Datenpunkte unter stovePrefix aufzeichnet (seit 08.11.2026 unbegrenzt).

/** Ein Messpunkt aus dem History-Adapter: Wert und Zeit in ms (der Wert kann fehlen, dann null). */
export type VPunkt = [number | null, number];

/** Ein einzelner Abbrand, aus der Temperaturkurve erschlossen. */
export interface Feuer {
  /** Beginn (erster Punkt über der Anheiz-Schwelle) in ms */
  von: number;
  /** Ende (unter die Aus-Schwelle gefallen oder zuletzt gemessen) in ms */
  bis: number;
  /** höchste gemessene Temperatur */
  hoechst: number;
  /** Zeitpunkt des Höchststands in ms */
  hoechstZeit: number;
  /** wurde während dieses Feuers „Holz nachlegen" gemeldet? */
  nachlegen: boolean;
  /** brennt es noch (letzter Messpunkt frisch)? */
  laeuft: boolean;
}

/** Über dieser Temperatur gilt das Feuer als an … */
export const ANHEIZ_C = 70;
/** … und erst unter dieser wieder als aus (Hysterese, damit es an der Grenze nicht flattert). */
export const AUS_C = 50;
/** Reißt der Verlauf länger als das ab, gilt das Feuer am letzten Punkt als beendet (Gerät war weg). */
const MAX_LUECKE_MS = 30 * 60_000;
/** Zwei Feuer näher als das gelten als eines (kurzer Aussetzer, Fühlerfehler, kurzes Durchsacken beim Nachlegen). */
const ZUSAMMEN_MS = 20 * 60_000;

function nurZahlen(p: VPunkt[]): [number, number][] {
  return p.filter((x): x is [number, number] => typeof x[0] === "number").sort((a, b) => a[1] - b[1]);
}

/**
 * Zerlegt die Temperaturkurve in einzelne Feuer. Ein Feuer beginnt, sobald die Temperatur über [anheiz] steigt, und
 * endet, wenn sie unter [aus] fällt oder der Verlauf abreißt. Das letzte Feuer „läuft", wenn der jüngste Punkt frisch ist.
 */
export function feuerAbschnitte(temps: VPunkt[], jetzt: number, anheiz = ANHEIZ_C, aus = AUS_C): Feuer[] {
  const s = nurZahlen(temps);
  const feuer: Feuer[] = [];
  let aktiv: Feuer | null = null;
  let vorT = 0;
  for (const [w, t] of s) {
    if (aktiv && t - vorT > MAX_LUECKE_MS) { aktiv.bis = vorT; feuer.push(aktiv); aktiv = null; }
    if (!aktiv) {
      if (w > anheiz) aktiv = { von: t, bis: t, hoechst: w, hoechstZeit: t, nachlegen: false, laeuft: false };
    } else {
      aktiv.bis = t;
      if (w > aktiv.hoechst) { aktiv.hoechst = w; aktiv.hoechstZeit = t; }
      if (w < aus) { feuer.push(aktiv); aktiv = null; }
    }
    vorT = t;
  }
  if (aktiv) { aktiv.laeuft = jetzt - vorT < MAX_LUECKE_MS; feuer.push(aktiv); }
  // Benachbarte Feuer mit nur kurzer Lücke zusammenfassen (ein kurzer Fühler-Aussetzer soll ein Feuer nicht zerreißen)
  const zusammen: Feuer[] = [];
  for (const f of feuer) {
    const vor = zusammen[zusammen.length - 1];
    if (vor && f.von - vor.bis < ZUSAMMEN_MS) {
      vor.bis = f.bis;
      vor.laeuft = f.laeuft;
      if (f.hoechst > vor.hoechst) { vor.hoechst = f.hoechst; vor.hoechstZeit = f.hoechstZeit; }
    } else {
      zusammen.push({ ...f });
    }
  }
  return zusammen;
}

/** Die Zeitpunkte, zu denen „Holz nachlegen" gemeldet wurde (Übergang des Zustands nach „nachlegen"). */
export function nachlegenMarken(zustand: VPunkt[]): number[] {
  const s = [...zustand].filter((p) => p[0] != null).sort((a, b) => a[1] - b[1]);
  const marken: number[] = [];
  let vor = "";
  for (const [w, t] of s) {
    const z = String(w);
    if (z === "nachlegen" && vor !== "nachlegen") marken.push(t);
    vor = z;
  }
  return marken;
}

/** Trägt in jedes Feuer ein, ob in seiner Zeitspanne eine Nachlegen-Meldung lag. */
export function feuerMitNachlegen(feuer: Feuer[], marken: number[]): Feuer[] {
  return feuer.map((f) => ({ ...f, nachlegen: marken.some((m) => m >= f.von && m <= f.bis) }));
}

export interface Statistik {
  anzahl: number;
  brenndauerMs: number;
  maxHoechst: number;
  mittelHoechst: number;
}

/** Kennzahlen über eine Liste von Feuern. */
export function feuerStatistik(feuer: Feuer[]): Statistik {
  if (!feuer.length) return { anzahl: 0, brenndauerMs: 0, maxHoechst: 0, mittelHoechst: 0 };
  const brenndauerMs = feuer.reduce((s, f) => s + (f.bis - f.von), 0);
  const maxHoechst = Math.max(...feuer.map((f) => f.hoechst));
  const mittelHoechst = feuer.reduce((s, f) => s + f.hoechst, 0) / feuer.length;
  return { anzahl: feuer.length, brenndauerMs, maxHoechst, mittelHoechst };
}

/** Anzahl Feuer je Kalendertag (für die kleinen Balken bei Woche/Monat), ältester Tag zuerst. */
export function feuerJeTag(feuer: Feuer[]): { tag: string; anzahl: number }[] {
  const je = new Map<string, number>();
  for (const f of feuer) {
    const d = new Date(f.von);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    je.set(k, (je.get(k) ?? 0) + 1);
  }
  return [...je.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, anzahl]) => ({ tag, anzahl }));
}

/**
 * Das Fenster für die „Feuer"-Ansicht: um das letzte Feuer herum (mit etwas Luft davor und danach). Gibt es keins,
 * null. [rand] ist der Rand links/rechts in ms.
 */
export function feuerFenster(feuer: Feuer[], jetzt: number, rand = 15 * 60_000): { von: number; bis: number; feuer: Feuer } | null {
  if (!feuer.length) return null;
  const f = feuer[feuer.length - 1];
  return { von: f.von - rand, bis: Math.min(jetzt, f.bis + rand), feuer: f };
}

/** Verlauf aus dem Standard-History-Adapter. [step] (ms) mittelt lange Zeiträume, sonst die Rohwerte. */
export async function verlaufLaden(ids: string[], ab: number, bis: number, step?: number): Promise<Record<string, VPunkt[]>> {
  return history(ids, ab, bis, step) as Promise<Record<string, VPunkt[]>>;
}

/** Die History-Datenpunkte unter dem eingestellten stovePrefix. */
export function verlaufIds(): { temperatur: string; modul: string; schwelle: string; zustand: string } | null {
  const p = rawConfig.value.stovePrefix;
  if (!p) return null;
  return { temperatur: `${p}.temperatur`, modul: `${p}.modul`, schwelle: `${p}.schwelle`, zustand: `${p}.zustand` };
}
