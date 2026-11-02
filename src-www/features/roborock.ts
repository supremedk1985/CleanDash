import { ref } from "vue";
import { fetchBulk, fetchState, setState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { instanceOf } from "../lib/config";
import { rawConfig } from "../lib/store";

/** The vacuum device from the settings (vacuumDevice), e.g. roborock.0.Devices.<duid> */
const PREFIX = () => rawConfig.value.vacuumDevice ?? "";

// Bedeutungen der Zustands-Codes stammen aus den common.states-Metadaten,
// die der roborock-Adapter selbst am State deviceStatus.state hinterlegt.
export const ROBOROCK_STATE_LABELS: Record<number, string> = {
  0: "Unbekannt",
  1: "Startet",
  2: "Schläft",
  3: "Bereit",
  4: "Fernsteuerung",
  5: "Reinigt",
  6: "Kehrt zur Station zurück",
  7: "Manueller Modus",
  8: "Lädt",
  9: "Ladefehler",
  10: "Pausiert",
  11: "Punktreinigung",
  12: "Fehler",
  13: "Fährt herunter",
  14: "Aktualisiert Firmware",
  15: "Dockt an",
  16: "Fährt zum Ziel",
  17: "Zonenreinigung",
  18: "Raumreinigung",
  22: "Leert Staubbehälter",
  23: "Wischmopp wird gewaschen",
  25: "Mopptuch wird gewaschen",
  26: "Fährt zur Moppreinigung",
  28: "Im Anruf",
  29: "Kartierung",
  30: "Aktion läuft",
  32: "Patrouille",
  33: "Mopp wird angebracht",
  34: "Mopp wird entfernt",
  36: "Ausstellungsmodus",
  37: "Tanzt",
  38: "Aufräumarbeiten",
  39: "Ferngesteuerte Abholung",
  40: "Notstopp",
  41: "Arm wird zurückgesetzt",
  42: "Programmmodus",
  100: "Vollständig geladen",
  101: "Offline",
  102: "Unbekannt",
};

// Ebenfalls direkt aus den common.states-Metadaten von deviceStatus.error_code.
export const ROBOROCK_ERROR_LABELS: Record<number, string> = {
  0: "Kein Fehler",
  1: "LiDAR-Sensor-Fehler",
  2: "Stoßfänger klemmt",
  3: "Räder angehoben",
  4: "Abgrundsensor-Fehler",
  5: "Hauptbürste blockiert",
  6: "Seitenbürste blockiert",
  7: "Roboter hängt fest oder Antriebsräder blockiert",
  8: "Roboter ist eingeklemmt oder feststeckend",
  9: "Staubbehälter nicht eingesetzt",
  10: "Filter nass oder verstopft",
  11: "Starkes Magnetfeld erkannt",
  12: "Akku schwach",
  13: "Ladefehler",
  14: "Temperaturschutz aktiv",
  15: "Wandsensor verschmutzt",
  16: "Roboter ist gekippt",
  17: "Seitenbürsten-Fehler",
  18: "Lüfterfehler",
  19: "Dock nicht am Strom",
  21: "Vertikaler Stoßfänger-Fehler",
  22: "Ladekontakt-Sensor-Fehler",
  23: "Dock konnte nicht erreicht werden",
  24: "Sperrzone oder unsichtbare Wand erkannt",
  25: "Kamerafehler",
  26: "Wandsensor-Fehler",
  27: "Wischmodul blockiert",
  28: "Roboter steht evtl. auf einem Teppich",
  29: "Teppich kann nicht überquert werden",
  32: "Kein Staubbehälter oder Filter eingesetzt",
  33: "Lüfterfehler an Absaugstation",
  34: "Absaugstation-Behälter reinigen",
  35: "Spannungsfehler an Absaugstation",
  36: "Waschwalze evtl. blockiert",
  37: "Waschwalze nicht richtig abgesenkt",
  38: "Reinwassertank prüfen",
  39: "Schmutzwassertank prüfen",
  40: "Wasserfilter nicht eingesetzt",
  41: "Reinwassertank leer",
  42: "Wasserfilter korrekt einsetzen",
  43: "Fehler am Positionierungsknopf",
  44: "Abdeckung des Schmutzwassertanks sichern",
  45: "Waschwalze evtl. blockiert",
  48: "Nachfüllfehler",
  49: "Ablauffehler",
  51: "Temperaturschutz aktiv",
  52: "Reinigungsschale prüfen",
  53: "Reinigungsschale voll",
  54: "Mopphalterung abgefallen",
  254: "Behälter voll",
  255: "Interner Fehler",
  [-1]: "Unbekannter Fehler",
};

export const ROBOROCK_FAN_LABELS: Record<number, string> = {
  101: "Leise",
  102: "Standard",
  103: "Turbo",
  104: "Max",
};

// Dockingstation-Zustände: 2 = OK, 1 = Aktion nötig, 0/3 = unbekannt bzw. nicht verbaut.
export const DOCK_STATUS_LABELS: Record<string, Record<number, string>> = {
  cleanFluidStatus: { 0: "Unbekannt", 1: "Reinigungsmittel niedrig", 2: "OK", 3: "Unbekannt" },
  waterBoxFilterStatus: { 0: "Unbekannt", 1: "Nicht installiert", 2: "OK", 3: "Unbekannt" },
  dustBagStatus: { 0: "Unbekannt", 1: "Voll", 2: "OK", 3: "Unbekannt" },
  dirtyWaterBoxStatus: { 0: "Unbekannt", 1: "Schmutzwassertank voll bzw. nicht eingesetzt", 2: "OK", 3: "Unbekannt" },
  clearWaterBoxStatus: { 0: "Unbekannt", 1: "Reinwasser niedrig", 2: "OK", 3: "Unbekannt" },
};

export function roborockStateLabel(state: number): string {
  return ROBOROCK_STATE_LABELS[state] ?? `Unbekannt (${state})`;
}

export function roborockErrorLabel(code: number): string {
  return ROBOROCK_ERROR_LABELS[code] ?? `Unbekannter Fehlercode (${code})`;
}

export function roborockFanLabel(power: number): string {
  return ROBOROCK_FAN_LABELS[power] ?? `${power}`;
}

export interface Roborock {
  name: string;
  /** Erreicht der ioBroker-Adapter die Roborock-Cloud? Ohne das sind ALLE Werte hier Konserve. */
  adapterVerbunden: boolean;
  online: boolean;
  state: number;
  battery: number;
  inCleaning: boolean;
  errorCode: number;
  cleanArea: number;
  cleanTime: number;
  cleanPercent: number;
  fanPower: number;
  mainBrushLife: number;
  sideBrushLife: number;
  filterLife: number;
  dustBagStatus: number;
  cleanFluidStatus: number;
  clearWaterBoxStatus: number;
  dirtyWaterBoxStatus: number;
  waterBoxFilterStatus: number;
  rssi: number;
}

export const roborock = ref<Roborock>();

// ───────── Roborock F25 Ultra (Wischsauger, seit 11.10.2026) ─────────
// Der Adapter kennt den F25 nur ohne Werte; das ioBroker-Skript script.js.Haus.F25_Selbstreinigung fragt ihn selbst
// ab und schreibt unter 0_userdata.0.F25Ultra einen fertigen Hinweis — die Regeln stehen dort, nicht hier.

/** Optional second robot reported by a script of your own (f25Prefix: hinweis, akku, lebenszeichen) */
const F25 = () => rawConfig.value.f25Prefix ?? "";

export interface F25Stand {
  /** "wartet" (in der Station, Akku zu leer), "bereit" (Akku reicht, Selbstreinigung nicht gestartet) oder "" */
  hinweis: string;
  akku: number;
  /** letzte Antwort des Geräts an das Skript, ms */
  lebenszeichen: number;
}

export const f25 = ref<F25Stand>();

/** Älter als das, und das Skript läuft nicht (oder ioBroker hängt) — dann lieber kein Popup als ein falsches. */
export const F25_HOECHSTENS_ALT_MS = 15 * 60 * 1000;

/** Popup-Meldung für den F25: nur wenn der Akku reicht und die Selbstreinigung trotzdem nicht lief. Startet sie,
 *  löscht das Skript den Hinweis und das Popup verschwindet von selbst; weggeklickt meldet es sich erst beim
 *  nächsten Mal wieder (Bestätigung fällt weg, sobald der Hinweis verschwindet). */
export function f25Meldungen(f: F25Stand | undefined, jetzt = Date.now()): Stationsmeldung[] {
  if (!f || !f.lebenszeichen || jetzt - f.lebenszeichen > F25_HOECHSTENS_ALT_MS) return [];
  // „wartet" (Akku noch unter 15 %) bewusst ohne Popup — Daniel, 11.10.: „Die Meldung soll nur kommen, wenn es so
  // weit ist. Nicht vorher die Info."
  if (f.hinweis === "bereit")
    return [{ schluessel: "f25-bereit", icon: "mdi-water-sync",
      text: `Der F25 hat jetzt ${f.akku} % Akku – bitte die Selbstreinigung starten.` }];
  return [];
}

async function pollF25() {
  if (!F25()) return;
  const w = await fetchBulk([`${F25()}.hinweis`, `${F25()}.akku`, `${F25()}.lebenszeichen`]);
  f25.value = {
    hinweis: String(w[`${F25()}.hinweis`] ?? ""),
    akku: Number(w[`${F25()}.akku`] ?? -1),
    lebenszeichen: Number(w[`${F25()}.lebenszeichen`] ?? 0),
  };
}

async function poll() {
  pollF25().catch(() => undefined);
  const [
    adapterVerbunden,
    name,
    online,
    state,
    battery,
    inCleaning,
    errorCode,
    cleanArea,
    cleanTime,
    cleanPercent,
    fanPower,
    mainBrushLife,
    sideBrushLife,
    filterLife,
    dustBagStatus,
    cleanFluidStatus,
    clearWaterBoxStatus,
    dirtyWaterBoxStatus,
    waterBoxFilterStatus,
    rssi,
  ] = await Promise.all([
    // Der Adapter war vom 04.08. bis 04.09.2026 abgeschaltet - die Kachel zeigte fünf Wochen
    // lang „Lädt, 100 %" vom Juli, als wäre es live. Diese Flagge verhindert das künftig.
    fetchState<boolean>(`${instanceOf(PREFIX())}.info.connection`),
    fetchState<string>(`${PREFIX()}.deviceInfo.name`),
    fetchState<boolean>(`${PREFIX()}.deviceInfo.online`),
    fetchState<number>(`${PREFIX()}.deviceStatus.state`),
    fetchState<number>(`${PREFIX()}.deviceStatus.battery`),
    fetchState<number>(`${PREFIX()}.deviceStatus.in_cleaning`),
    fetchState<number>(`${PREFIX()}.deviceStatus.error_code`),
    fetchState<number>(`${PREFIX()}.deviceStatus.clean_area`),
    fetchState<number>(`${PREFIX()}.deviceStatus.clean_time`),
    fetchState<number>(`${PREFIX()}.deviceStatus.clean_percent`),
    fetchState<number>(`${PREFIX()}.deviceStatus.fan_power`),
    fetchState<number>(`${PREFIX()}.consumables.main_brush_life`),
    fetchState<number>(`${PREFIX()}.consumables.side_brush_life`),
    fetchState<number>(`${PREFIX()}.consumables.filter_life`),
    fetchState<number>(`${PREFIX()}.dockingStationStatus.dustBagStatus`),
    fetchState<number>(`${PREFIX()}.dockingStationStatus.cleanFluidStatus`),
    fetchState<number>(`${PREFIX()}.dockingStationStatus.clearWaterBoxStatus`),
    fetchState<number>(`${PREFIX()}.dockingStationStatus.dirtyWaterBoxStatus`),
    fetchState<number>(`${PREFIX()}.dockingStationStatus.waterBoxFilterStatus`),
    fetchState<number>(`${PREFIX()}.networkInfo.rssi`),
  ]);

  roborock.value = {
    name,
    adapterVerbunden: !!adapterVerbunden,
    online: !!online,
    state,
    battery,
    inCleaning: !!inCleaning,
    errorCode,
    cleanArea,
    cleanTime,
    cleanPercent,
    fanPower,
    mainBrushLife,
    sideBrushLife,
    filterLife,
    dustBagStatus,
    cleanFluidStatus,
    clearWaterBoxStatus,
    dirtyWaterBoxStatus,
    waterBoxFilterStatus,
    rssi,
  };
}

export const roborockFeature: FeatureModule = { name: "roborock", interval: "slow", poll };

// ───────── Bedienung (seit 04.09.2026, Daniels Wunsch: Start/Stop auf der Kachel) ─────────

/** Zustände, in denen der Roboter gerade arbeitet — dann heißt die Taste „Pause". */
const REINIGT = new Set([5, 11, 17, 18, 16]);
/** Pausiert: Taste „Weiter" (app_start setzt eine unterbrochene Reinigung fort). */
const PAUSIERT = new Set([10]);
/** Auf dem Weg zur Station oder beim Docken: nichts anbieten außer Start. */
const UNTERWEGS_ZUR_STATION = new Set([6, 15]);

export type RoborockAktion = "start" | "weiter" | "pause" | "station";

/**
 * Welche Tasten die Kachel zeigt — rein aus Zustand und in_cleaning, damit es testbar bleibt.
 * Bewusst höchstens zwei Tasten: eine für „Machen", eine für „Heim". Stopp ohne Heimfahrt
 * gibt es nicht — ein mitten im Raum stehender Roboter nützt niemandem.
 */
export function roborockAktionen(state: number, inCleaning: boolean, online: boolean, adapterVerbunden = true): RoborockAktion[] {
  if (!online || !adapterVerbunden) return [];
  if (PAUSIERT.has(state)) return ["weiter", "station"];
  if (inCleaning || REINIGT.has(state)) return ["pause", "station"];
  if (UNTERWEGS_ZUR_STATION.has(state)) return ["start"];
  return ["start"];
}

// ───────── Stations-Meldungen (Popup wie beim Tonnenticker) ─────────

export interface Stationsmeldung {
  /** stabil je Problem - der Schlüssel für „schon bestätigt" */
  schluessel: string;
  text: string;
  icon: string;
}

/**
 * Was an der Station zu tun ist. Status 1 heißt beim Roborock „Aktion nötig", 2 „OK",
 * 0/3 „unbekannt/nicht verbaut" - letztere lösen bewusst nichts aus. Ohne Adapter-Verbindung
 * gibt es keine Meldung: die Werte wären Konserve (siehe Vorfall vom 04.09.2026).
 */
export function stationsMeldungen(r: Pick<Roborock, "adapterVerbunden" | "clearWaterBoxStatus" | "dirtyWaterBoxStatus" | "dustBagStatus" | "cleanFluidStatus" | "waterBoxFilterStatus">): Stationsmeldung[] {
  if (!r.adapterVerbunden) return [];
  const m: Stationsmeldung[] = [];
  if (r.clearWaterBoxStatus === 1) m.push({ schluessel: "reinwasser", text: "Reinwasser ist leer – bitte nachfüllen.", icon: "mdi-water-off" });
  if (r.dirtyWaterBoxStatus === 1) m.push({ schluessel: "schmutzwasser", text: "Schmutzwassertank ist voll oder fehlt – bitte leeren.", icon: "mdi-water-alert" });
  if (r.dustBagStatus === 1) m.push({ schluessel: "staubbeutel", text: "Staubbeutel ist voll – bitte wechseln.", icon: "mdi-trash-can" });
  if (r.cleanFluidStatus === 1) m.push({ schluessel: "reiniger", text: "Reinigungsmittel ist fast leer.", icon: "mdi-flask-empty-outline" });
  if (r.waterBoxFilterStatus === 1) m.push({ schluessel: "wasserfilter", text: "Wasserfilter fehlt – bitte einsetzen.", icon: "mdi-air-filter" });
  return m;
}

/** Läuft gerade ein Befehl? Die Tasten sind dann kurz gesperrt, damit niemand doppelt drückt. */
export const befehlLaeuft = ref(false);

const BEFEHLE: Record<RoborockAktion, string> = {
  start: "app_start",
  weiter: "app_start",
  pause: "app_pause",
  station: "app_charge",
};

/** Schickt den Befehl (ioBroker-Button-State = true) und holt den Zustand danach zweimal frisch. */
export async function roborockBefehl(aktion: RoborockAktion): Promise<boolean> {
  if (befehlLaeuft.value) return false;
  befehlLaeuft.value = true;
  try {
    const ok = await setState(`${PREFIX()}.commands.${BEFEHLE[aktion]}`, true);
    // Der Adapter meldet den neuen Zustand mit Verzögerung — nicht auf den langsamen Takt warten.
    setTimeout(() => poll().catch(() => undefined), 2000);
    setTimeout(() => poll().catch(() => undefined), 6000);
    return ok;
  } finally {
    setTimeout(() => { befehlLaeuft.value = false; }, 2500);
  }
}
