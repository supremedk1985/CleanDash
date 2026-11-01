/**
 * speedtest.ts
 * ------------
 * Wie schnell die Internetleitung zuletzt war.
 *
 * Die Zahlen kommen NICHT aus ioBroker, sondern aus einer Datei, die
 * `/srv/backup/speedtest.sh` dreimal täglich schreibt (06:10, 13:10, 20:40).
 * Sie liegt im Webroot neben dem Sicherungs-Status, wird also vom selben
 * nginx ausgeliefert wie diese Seite -- kein Dienst dazwischen, keine
 * Anmeldung, und bei einem Ausfall sieht man den letzten Stand statt nichts.
 *
 * WAS DIE ZAHL NICHT IST: ein Beweis über den Anschluss. Läuft gerade ein
 * großer Download, eine Sicherung übers Netz oder ein Videoabend, misst der
 * Test das mit. Deshalb zeigt die Kachel neben dem letzten Wert auch den
 * Mittelwert der letzten Messungen -- eine einzelne schwache Zahl sagt wenig.
 */
import { ref } from "vue";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

// In der cerebro-App (build:app) über den cerebro-Dienst (27.10.2026)
/** JSON written by a measuring script of your own (speedtestUrl); empty means: no tile */
const SPEEDTEST_URL = () => rawConfig.value.speedtestUrl ?? "";

export interface Messung {
  wann: string;
  runter: number;
  hoch: number;
  ping: number;
  jitter?: number;
  server?: string;
}

export interface Speedtest {
  ok: boolean;
  stand: Date | null;
  runter: number;
  hoch: number;
  ping: number;
  jitter: number;
  server: string;
  mittelRunter: number;
  verlauf: Messung[];
  /** Erreichbar? Wie beim ioBroker-Banner: lieber sichtbar alt als unsichtbar falsch. */
  erreichbar: boolean;
}

export const speedtest = ref<Speedtest>({
  ok: false, stand: null, runter: 0, hoch: 0, ping: 0, jitter: 0,
  server: "", mittelRunter: 0, verlauf: [], erreichbar: true,
});

/**
 * Wie die Geschwindigkeit einzuordnen ist.
 *
 * Kein fester Sollwert im Code: Was „gut" ist, hängt am Vertrag. Gemessen wird
 * deshalb gegen den eigenen Mittelwert der letzten Tage -- ein Einbruch auf die
 * Hälfte fällt so auf, ohne dass jemand eine Zahl pflegen muss.
 */
export function bewertung(s: Speedtest): "gut" | "schwach" | "schlecht" {
  if (!s.mittelRunter || !s.runter) return "gut";
  const anteil = s.runter / s.mittelRunter;
  if (anteil < 0.4) return "schlecht";
  if (anteil < 0.7) return "schwach";
  return "gut";
}

export async function poll(): Promise<void> {
  try {
    if (!SPEEDTEST_URL()) return;
    const antwort = await fetch(SPEEDTEST_URL(), { cache: "no-store" });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const d = await antwort.json();
    speedtest.value = {
      ok: d.ok !== false,
      stand: d.stand ? new Date(d.stand) : null,
      runter: d.runter ?? 0,
      hoch: d.hoch ?? 0,
      ping: d.ping ?? 0,
      jitter: d.jitter ?? 0,
      server: d.server ?? "",
      mittelRunter: d.mittel_runter ?? 0,
      verlauf: d.verlauf ?? [],
      erreichbar: true,
    };
  } catch {
    speedtest.value = { ...speedtest.value, erreichbar: false };
  }
}

export const speedtestFeature: FeatureModule = { name: "speedtest", interval: "slow", poll };
