/**
 * navimow.ts
 * ----------
 * Der Mähroboter (Segway Navimow i105) über den ioBroker-Adapter "navimow".
 *
 * Das Modul hat drei Aufgaben, und sie sind bewusst getrennt:
 *
 *   1. ZUSTAND — was der Mäher meldet, plus die Frage "hat er sich festgefahren?", die
 *      er NICHT selbst beantwortet (siehe Stillstandserkennung unten).
 *   2. KARTE — das fertige PNG des Adapters (~128 KB). Es wird nie im Takt geladen,
 *      sondern nur, wenn es sich geändert haben kann (kartenLadenNoetig).
 *   3. STEUERUNG — Start / Weiter / Pause / Zur Station mit Sperre, Zweitbestätigung
 *      für alles, was Messer in Gang setzt, und einer ehrlichen Rückmeldung: „true" von
 *      setState heißt nur „ioBroker hat den Wert", nie „der Mäher fährt".
 *
 * Drei Wahrheitsquellen werden getrennt geführt und nie vermischt (Lehre vom 04.09.2026,
 * als eine Kachel fünf Wochen Konserve als live zeigte): ioBroker antwortet
 * (backendErreichbar in lib/iobroker), der Adapter hat die Cloud (info.connection),
 * die Cloud hat den Mäher gehört (status.timestamp).
 *
 * Stillstandserkennung — warum sie hier liegt und wie die Zahlen zustande kommen:
 *
 *   Der Mäher kennt keinen Zustand "steckt fest". Was er meldet, sind drei Dinge:
 *   vehicleState "Error" (Störung), "isLifted" (angehoben — auch, wenn er auf einem
 *   Hindernis aufsitzt) und isRunning bei stehender Position — der klassische Fall:
 *   er glaubt zu mähen, kommt aber nicht von der Stelle.
 *
 *   BEWEGUNG_M = 0.4  Die Position kommt aus RTK-GPS und rauscht auch im Stand um
 *                     einige Zentimeter. 40 cm sind sicher über dem Rauschen und
 *                     zugleich weniger, als ein fahrender Mäher in 90 Sekunden schafft
 *                     (er fährt gut 0,3 m/s, also ~27 m je Abruf).
 *   STILLSTAND_MIN = 8  Ein Mäher steht auch im Normalbetrieb mal: Hinderniserkennung,
 *                     Wendemanöver, Regenpause. Acht Minuten ohne einen Meter Weg sind
 *                     keins davon. Lieber acht Minuten später melden als jeden Tag
 *                     grundlos.
 *
 *   Die Einheit der Positionsfelder ist Meter, relativ zur Ladestation (gemessen am
 *   ruhenden Gerät: 4,75 / -1,25). Sollte sich das je ändern, ist BEWEGUNG_M die einzige
 *   Stelle, die angefasst werden muss.
 */
import { rasenUmriss, spurLesen, type Punkt2 } from "./rasenUmriss";
import { ref, shallowRef } from "vue";
import { fetchState, setState } from "../compat/iobroker";
import { logger } from "../lib/logger";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

/** The mower device from the settings (mowerDevice), e.g. navimow.0.<serial> */
export const PREFIX = () => rawConfig.value.mowerDevice ?? "";

const BEWEGUNG_M = 0.4;
const STILLSTAND_MIN = 8;
/** Ab wann eine Position als veraltet gilt (Sekunden) — deckt sich mit locationMqttStale des Adapters. */
export const POSITION_VERALTET_S = 300;
// Ab wann „mäht, meldet aber nichts" ein Hilferuf ist. Großzügiger als die Stillstandsschwelle,
// weil ein kurzer MQTT-Abriss im Garten normal ist -- zwölf Minuten Funkstille beim Mähen nicht.
export const POSITION_STUMM_MIN = 12;
/** Ab wann der Mäher auf der Karte gar nicht mehr gezeichnet wird (Sekunden). */
export const POSITION_UNBRAUCHBAR_S = 30 * 60;

export interface Navimow {
  /** Erreicht der Adapter die Navimow-Cloud? Ohne das sind ALLE Werte hier Konserve. */
  adapterVerbunden: boolean;
  zustand: string;
  akku: number;
  /** HIGH / MEDIUM / LOW — Ersatz, wenn battery 0 liefert. */
  akkuText: string;
  /** status.timestamp: wann die Cloud den Mäher zuletzt gehört hat (ms, 0 = unbekannt). */
  statusZeit: number;
  /** Nur beim Mähen/Pausieren und nur, wenn er sich seit dem Start geändert hat — sonst null. */
  fortschritt: number | null;
  x: number;
  y: number;
  /** location.postureTheta: Fahrtrichtung in Radiant (0 = +x, gegen den Uhrzeigersinn) — für die Mäher-Figur */
  winkel: number;
  stillstandMin: number;
  /** Wie lange „mäht", ohne dass eine Position ankommt (Minuten, 0 wenn er nicht mäht). */
  positionStummMin: number;
  positionAlterSek: number;
  /** diagnostics.locationMqttStale */
  positionVeraltet: boolean;
  /** location.taskDelay — der Mäher wartet planmäßig, z. B. wegen Regen. */
  maehenVerschoben: boolean;
  /** location.mowingWeekArea in m² */
  wochenFlaeche: number;
  /** location.subtotalArea in m² */
  letzteFlaeche: number;
}

export const navimow = ref<Navimow>({
  adapterVerbunden: false,
  zustand: "",
  akku: 0,
  akkuText: "",
  statusZeit: 0,
  fortschritt: null,
  x: 0,
  y: 0,
  winkel: 0,
  stillstandMin: 0,
  positionStummMin: 0,
  positionAlterSek: 0,
  positionVeraltet: false,
  maehenVerschoben: false,
  wochenFlaeche: 0,
  letzteFlaeche: 0,
});

/** Zustände in Alltagssprache. Der Adapter liefert die englischen Namen der Hersteller-Cloud. */
export const ZUSTAND_TEXT: Record<string, string> = {
  isRunning: "mäht",
  isDocked: "in der Station",
  isIdle: "bereit",
  isPaused: "angehalten",
  isDocking: "fährt zurück",
  isMapping: "kartiert",
  isLifted: "angehoben",
  Error: "Störung",
  inSoftwareUpdate: "Aktualisierung",
  "Self-Checking": "Selbsttest",
  Offline: "nicht erreichbar",
};

/**
 * Zustandstext für die Anzeige. Leer heißt „Adapter frisch gestartet" (val null → 0/"").
 * Ein unbekannter Wert wird NICHT durchgereicht, sondern als „unbekannt" gezeigt — eine
 * englische Rohbezeichnung auf dem Küchentablet hilft niemandem.
 */
export function zustandText(zustand: string): string {
  const z = (zustand ?? "").trim();
  if (z === "") return "noch keine Daten";
  return ZUSTAND_TEXT[z] ?? "unbekannt";
}

export const AKKU_TEXT: Record<string, string> = { HIGH: "hoch", MEDIUM: "mittel", LOW: "niedrig" };

/** Akku für die Anzeige: Prozent, oder — wenn battery 0 liefert, obwohl der Adapter verbunden ist — die Cloud-Stufe. */
export function akkuAnzeige(m: Pick<Navimow, "akku" | "akkuText" | "adapterVerbunden">): string {
  if (m.akku > 0) return `${m.akku} %`;
  if (m.adapterVerbunden && AKKU_TEXT[m.akkuText]) return AKKU_TEXT[m.akkuText];
  return `${m.akku} %`;
}

/** Fläche in m² für die Kennzahlen; 0 oder Unsinn → „–", weil eine Null hier nur „nichts gemessen" heißt. */
export function flaecheAnzeige(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "–";
  return `${Math.round(v).toLocaleString("de-DE")} m²`;
}

// ───────── Gedächtnis zwischen den Abrufen (Rechenweg, keine Anzeige — deshalb nicht im ref) ─────────

// Zeitpunkt des vorigen Abrufs -- nur für die Pausenrechnung der Stillstandsuhr.
let letzterPollZeit = 0;
// Wann zuletzt eine gültige Position ankam -- Grundlage für „mäht, meldet aber nichts".
let letztePositionZeit = 0;

let letzteBewegung = { x: NaN, y: NaN, zeit: Date.now() };
let zustandVorher = "";
/** Roher mowingPercentage des letzten Abrufs — Auslöser für die Karte, unabhängig von der Anzeige-Regel. */
let fortschrittRoh = 0;
let fortschrittGedaechtnis: FortschrittGedaechtnis = { gesehen: false, vorStart: 0 };

/** Nur für Tests: alles Gedächtnis zurücksetzen, damit ein Fall nicht den nächsten färbt. */
export function _zuruecksetzenFuerTests() {
  letzteBewegung = { x: NaN, y: NaN, zeit: Date.now() };
  letzterPollZeit = 0;
  letztePositionZeit = 0;
  zustandVorher = "";
  fortschrittRoh = 0;
  fortschrittGedaechtnis = { gesehen: false, vorStart: 0 };
  letzterKartenVersuch = null;
  karteKennung = { laenge: 0, ende: "" };
  karte.value = null;
  rasen.value = null;
  spurKennung = "";
  kartenFrame.value = null;
  station.value = null;
  karteStand.value = null;
  karteFehlgeschlagen.value = false;
  karteBildDefekt.value = false;
  gewarnteRohwerte.clear();
  navimowAufraeumen();
  befehlLaeuft.value = false;
  befehlOffen.value = null;
  befehlMeldung.value = null;
  bestaetigung.value = null;
}

export interface FortschrittGedaechtnis {
  /** Hat sich mowingPercentage seit dem Start einmal geändert? */
  gesehen: boolean;
  /** Der Wert, der beim Start noch dastand (Konserve aus dem letzten Lauf). */
  vorStart: number;
}

/**
 * Fortschritt ehrlich bewerten. fetchState macht null zu 0, und der Adapter lässt den
 * Wert nach dem Andocken stehen (beobachtet: 25 im Dock, Stunden alt). Deshalb gilt der
 * Wert erst, wenn er sich seit dem Start EINMAL geändert hat — vorher „noch unbekannt".
 * Pause → Weiter ist kein neuer Start; der Wert bleibt gültig.
 */
export function fortschrittBewerten(
  zustand: string,
  vorher: string,
  roh: number,
  g: FortschrittGedaechtnis,
): { anzeige: number | null; gedaechtnis: FortschrittGedaechtnis } {
  const aktiv = zustand === "isRunning" || zustand === "isPaused";
  const warAktiv = vorher === "isRunning" || vorher === "isPaused";
  let neu = g;
  if (zustand === "isRunning" && !warAktiv) neu = { gesehen: false, vorStart: roh };
  if (aktiv && !neu.gesehen && roh > 0 && roh !== neu.vorStart) neu = { ...neu, gesehen: true };
  const anzeige = aktiv && neu.gesehen && roh > 0 ? roh : null;
  return { anzeige, gedaechtnis: neu };
}

/**
 * Ein Abruf. `mitKarte` ist für die Nachpolls nach einem Befehl false — sonst holten sechs
 * Nachpolls sechs Bilder; der Zustandswechsel löst die Karte beim nächsten Tick ohnehin aus.
 */
async function poll(mitKarte = true) {
  const [
    adapterVerbunden,
    zustandRoh,
    akku,
    akkuText,
    statusZeit,
    fortschritt,
    x,
    y,
    letzteFlaeche,
    wochenFlaeche,
    taskDelay,
    positionAlterSek,
    locationMqttStale,
    winkel,
  ] = await Promise.all([
    fetchState<boolean>(`navimow.0.info.connection`),
    fetchState<string>(`${PREFIX()}.status.vehicleState`),
    fetchState<number>(`${PREFIX()}.status.battery`),
    fetchState<string>(`${PREFIX()}.status.descriptiveCapacityRemaining`),
    fetchState<number>(`${PREFIX()}.status.timestamp`),
    fetchState<number>(`${PREFIX()}.location.mowingPercentage`),
    fetchState<number>(`${PREFIX()}.location.postureX`),
    fetchState<number>(`${PREFIX()}.location.postureY`),
    fetchState<number>(`${PREFIX()}.location.subtotalArea`),
    fetchState<number>(`${PREFIX()}.location.mowingWeekArea`),
    fetchState<boolean>(`${PREFIX()}.location.taskDelay`),
    fetchState<number>(`${PREFIX()}.diagnostics.lastLocationAgeSeconds`),
    fetchState<boolean>(`${PREFIX()}.diagnostics.locationMqttStale`),
    fetchState<number>(`${PREFIX()}.location.postureTheta`),
  ]);

  const jetzt = Date.now();
  const zustand = typeof zustandRoh === "string" ? zustandRoh.trim() : "";
  const alterSek = Number.isFinite(positionAlterSek) ? positionAlterSek : 0;
  const positionVeraltet = !!locationMqttStale;

  // Position 0/0 ist der fetchState-Ersatz für null, keine Messung.
  const gueltig = Number.isFinite(x) && Number.isFinite(y) && !(x === 0 && y === 0);
  const datenLuecke = positionVeraltet || alterSek > POSITION_VERALTET_S || !gueltig;

  if (datenLuecke) {
    // Eine Datenlücke ist keine Messung: die Uhr PAUSIERT. Sie darf dabei nicht zurückgesetzt
    // werden (Befund vom 13.09.): `zeit = jetzt` hätte den bereits gezählten Stillstand
    // gelöscht, und weil ein festgefahrener Mäher oft auch keine Positionen mehr sendet, wäre
    // „festgefahren" ab der Veraltungsschwelle NIE mehr erreichbar gewesen — genau im Zielfall.
    // Richtig ist, den Anker um die Pausendauer nach hinten zu schieben: die verstrichene
    // Stillstandszeit bleibt erhalten, die Pause zählt nicht mit.
    // Beim ERSTEN Abruf gibt es keinen Vorlauf, den man pausieren könnte -- dann zählt die
    // gesamte bisher verstrichene Zeit als Pause, der Anker rückt auf jetzt. Sonst würde eine
    // Kachel, die mitten in einer Funkstille geladen wird, sofort Stillstand behaupten.
    const pause = letzterPollZeit ? jetzt - letzterPollZeit : jetzt - letzteBewegung.zeit;
    letzteBewegung = { ...letzteBewegung, zeit: letzteBewegung.zeit + pause };
  } else {
    const weg = Number.isFinite(letzteBewegung.x)
      ? Math.hypot(x - letzteBewegung.x, y - letzteBewegung.y)
      : Infinity;
    if (weg > BEWEGUNG_M) letzteBewegung = { x, y, zeit: jetzt };
  }
  // Wann kam zuletzt eine brauchbare Position? Beim Mähen ist langes Schweigen selbst ein Befund.
  if (!datenLuecke) letztePositionZeit = jetzt;
  else if (!letztePositionZeit) letztePositionZeit = jetzt;
  const positionStummMin =
    zustand === "isRunning" ? Math.floor((jetzt - letztePositionZeit) / 60000) : 0;
  if (zustand !== "isRunning") letztePositionZeit = jetzt;

  letzterPollZeit = jetzt;

  // Nur während des Mähens ist Stillstand ein Problem. In der Station, angehalten oder
  // beim Kartieren steht er zu Recht -- eine Uhr, die dort mitläuft, würde jeden Morgen
  // einen Alarm erzeugen.
  const stillstandMin =
    zustand === "isRunning" ? Math.floor((jetzt - letzteBewegung.zeit) / 60000) : 0;
  if (zustand !== "isRunning") letzteBewegung = { x: gueltig ? x : NaN, y: gueltig ? y : NaN, zeit: jetzt };

  fortschrittRoh = Number.isFinite(fortschritt) ? fortschritt : 0;
  const bewertet = fortschrittBewerten(zustand, zustandVorher, fortschrittRoh, fortschrittGedaechtnis);
  fortschrittGedaechtnis = bewertet.gedaechtnis;

  navimow.value = {
    adapterVerbunden: !!adapterVerbunden,
    zustand,
    akku: Number.isFinite(akku) ? akku : 0,
    akkuText: typeof akkuText === "string" ? akkuText : "",
    statusZeit: Number.isFinite(statusZeit) ? statusZeit : 0,
    fortschritt: bewertet.anzeige,
    x: gueltig ? x : 0,
    y: gueltig ? y : 0,
    winkel: Number.isFinite(winkel) ? winkel : 0,
    stillstandMin,
    positionStummMin,
    positionAlterSek: alterSek,
    positionVeraltet,
    maehenVerschoben: !!taskDelay,
    wochenFlaeche: Number.isFinite(wochenFlaeche) ? wochenFlaeche : 0,
    letzteFlaeche: Number.isFinite(letzteFlaeche) ? letzteFlaeche : 0,
  };

  // Die orange „hat nicht reagiert"-Zeile gilt bis zum nächsten Zustandswechsel.
  if (zustand !== zustandVorher && befehlMeldung.value?.art === "warnung") befehlMeldung.value = null;
  zustandVorher = zustand;
  befehlOffenPruefen(jetzt);

  // Bewusst NICHT im Promise.all oben: ein Fehlschlag des 128-KB-Abrufs darf den Status
  // nicht einfrieren. karteLaden() fängt seine Fehler selbst.
  if (mitKarte) await karteLaden("tick");
}

// ───────── Hilferufe (Popup) ─────────

export interface Meldung {
  schluessel: string;
  text: string;
  icon: string;
}

/**
 * Die Hilferufe des Mähers. Leer heißt: alles in Ordnung.
 * Der Schlüssel ist das, was der Benutzer wegklickt -- er muss also für dasselbe Problem
 * gleich bleiben und sich unterscheiden, sobald es ein anderes ist.
 * Ohne Adapterverbindung gibt es keine Meldung: die Werte wären Konserve (04.09.2026).
 */
export function maeherMeldungen(
  m: Pick<Navimow, "zustand" | "stillstandMin" | "adapterVerbunden"> & { positionStummMin?: number },
): Meldung[] {
  if (!m.adapterVerbunden) return [];
  const liste: Meldung[] = [];
  if (m.zustand === "Error") {
    liste.push({
      schluessel: "stoerung",
      text: "Der Mäher meldet eine Störung und steht.",
      icon: "mdi-alert-circle",
    });
  }
  if (m.zustand === "isLifted") {
    liste.push({
      schluessel: "angehoben",
      text: "Der Mäher wurde angehoben oder sitzt auf einem Hindernis auf.",
      icon: "mdi-arrow-up-bold-box",
    });
  }
  // Der zweite Weg, wie sich ein festgefahrener Mäher zeigt: Er sagt weiter „ich mähe", hat
  // aber seit Langem keine Position mehr gemeldet. Die Stillstandsuhr greift dann NICHT (sie
  // pausiert mangels Messung), deshalb braucht dieser Fall eine eigene Meldung -- sonst bliebe
  // genau die Lage stumm, in der man nachsehen möchte.
  if (m.zustand === "isRunning" && (m.positionStummMin ?? 0) >= POSITION_STUMM_MIN) {
    liste.push({
      schluessel: "keine-position",
      text: `Der Mäher meldet seit ${m.positionStummMin ?? 0} Minuten keine Position, sagt aber, dass er mäht. Bitte nachsehen.`,
      icon: "mdi-map-marker-off",
    });
  }
  if (m.stillstandMin >= STILLSTAND_MIN) {
    liste.push({
      schluessel: "festgefahren",
      text: `Der Mäher steht seit ${m.stillstandMin} Minuten an derselben Stelle, obwohl er mäht. Wahrscheinlich hat er sich festgefahren.`,
      icon: "mdi-help-rhombus",
    });
  }
  return liste;
}

// ───────── Hinweiszeile in der Statusbox ─────────

export interface Hinweis {
  text: string;
  farbe: "orange" | "grau";
}

const STATUS_ALT_MS = 10 * 60_000;

export function uhrzeit(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Höchstens EIN Hinweis, nach Priorität: Stillstand (ab 3 min, damit man an der Kachel
 * sieht, ob die 8-Minuten-Schwelle für diesen Garten passt) > Position veraltet (nur
 * beim Mähen/Pause, im Dock ist eine stumme Position normal) > planmäßig verschoben
 * (Regen ist kein Fehler) > alter Stand (die Cloud hat ihn seit > 10 min nicht gehört).
 */
export function hinweisText(m: Navimow, jetzt: number): Hinweis | null {
  const aktiv = m.zustand === "isRunning" || m.zustand === "isPaused";
  if (m.zustand === "isRunning" && m.stillstandMin >= 3) {
    return { text: `steht seit ${m.stillstandMin} min an derselben Stelle`, farbe: "orange" };
  }
  if (aktiv && (m.positionVeraltet || m.positionAlterSek > POSITION_VERALTET_S)) {
    return { text: "Position veraltet", farbe: "orange" };
  }
  if (m.maehenVerschoben) return { text: "Mähen verschoben, z. B. wegen Regen", farbe: "orange" };
  if (m.statusZeit > 0 && jetzt - m.statusZeit > STATUS_ALT_MS) {
    return { text: `Stand ${uhrzeit(m.statusZeit)}`, farbe: "grau" };
  }
  return null;
}

// ───────── Karte ─────────

export interface KartenFrame {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  scale: number;
}

export interface Punkt {
  x: number;
  y: number;
}

/**
 * Der Rasen als Umriss (Weltkoordinaten), aus der Spur `mapTrack` gerechnet (rasenUmriss.ts) — damit zeichnet die
 * Kachel die Karte im Stil der Navimow-App. null: keine brauchbare Spur, dann bleibt das PNG des Adapters.
 */
export const rasen = shallowRef<Punkt2[] | null>(null);
let spurKennung = "";

/** Die eine data-URL. shallowRef, damit Vue den 128-KB-String nicht durchläuft. */
export const karte = shallowRef<string | null>(null);
export const kartenFrame = shallowRef<KartenFrame | null>(null);
export const station = shallowRef<Punkt | null>(null);
/** Ankunft eines INHALTLICH neuen Bildes (ms) — nicht der letzte Abruf. */
export const karteStand = ref<number | null>(null);
/** Letzter Abruf gescheitert oder ungültig, altes Bild steht noch. */
export const karteFehlgeschlagen = ref(false);
/** Der Browser konnte das Bild nicht dekodieren (<img @error>). */
export const karteBildDefekt = ref(false);

/** Vergleich mit dem Vorgänger ohne den ganzen String zu halten: Länge + letzte 64 Zeichen. */
let karteKennung = { laenge: 0, ende: "" };

export interface KartenVersuch {
  zeit: number;
  zustand: string;
  fortschritt: number;
  flaeche: number;
}

/** Beim Mähen wächst die Spur, auch wenn die Prozente stehen: ein Bild je Tick. */
export const KARTE_MAEHEN_MS = 85_000; // Tick ist 90 s; ein paar Sekunden Toleranz, sonst kostet Jitter jeden zweiten Tick
/** Sicherheitsnetz: fängt eine in der App neu angelegte Karte ein, egal welcher Zustand. */
export const KARTE_SICHERHEITSNETZ_MS = 30 * 60_000;
/** Öffnen des Dialogs holt ein frisches Bild, aber nicht bei jedem Tipp. */
export const KARTE_DIALOG_MS = 30_000;

/**
 * Lohnt ein Kartenabruf? Reine Funktion über den letzten VERSUCH (nicht das letzte
 * neue Bild — sonst würde ein dauerhaft ungültiger Wert jeden Tick neu geholt).
 * Der Adapter rendert beim Zustandswechsel neu (belegt: map.ts = mapTrack.ts =
 * vehicleState.lc), deshalb ist der Zustand der wichtigste Auslöser.
 */
export function kartenLadenNoetig(
  letzter: KartenVersuch | null,
  jetzt: KartenVersuch,
  ausloeser: "tick" | "dialog" = "tick",
): boolean {
  if (letzter === null) return true;
  const her = jetzt.zeit - letzter.zeit;
  if (ausloeser === "dialog") return her > KARTE_DIALOG_MS;
  if (jetzt.zustand !== letzter.zustand) return true;
  if (jetzt.fortschritt !== letzter.fortschritt || jetzt.flaeche !== letzter.flaeche) return true;
  if ((jetzt.zustand === "isRunning" || jetzt.zustand === "isMapping") && her >= KARTE_MAEHEN_MS) return true;
  if (her >= KARTE_SICHERHEITSNETZ_MS) return true;
  return false;
}

/** fetchState liefert bei fehlendem Datenpunkt 0 — das ist „keine Karte", kein Bild. */
export function istGueltigeKarte(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/png;base64,") && v.length > 1000;
}

/** Nur einmal je unterschiedlichem Rohstring warnen, sonst bekommt das Log alle 90 s dieselbe Zeile. */
const gewarnteRohwerte = new Set<string>();
function einmalWarnen(schluessel: string, roh: unknown) {
  const kennung = `${schluessel}:${String(roh).slice(0, 200)}`;
  if (gewarnteRohwerte.has(kennung)) return;
  gewarnteRohwerte.add(kennung);
  logger.warn(schluessel, { roh: String(roh).slice(0, 200) });
}

function alleEndlich(o: Record<string, unknown>, felder: string[]): boolean {
  return felder.every((f) => Number.isFinite(o[f]));
}

export function parseKartenFrame(roh: unknown): KartenFrame | null {
  try {
    const o = typeof roh === "string" ? JSON.parse(roh) : roh;
    if (!o || typeof o !== "object") throw new Error("kein Objekt");
    if (!alleEndlich(o, ["minX", "maxX", "minY", "maxY", "width", "height", "scale"])) throw new Error("Felder fehlen");
    if (o.width <= 0 || o.height <= 0 || o.scale <= 0) throw new Error("Maße ≤ 0");
    return { minX: o.minX, maxX: o.maxX, minY: o.minY, maxY: o.maxY, width: o.width, height: o.height, scale: o.scale };
  } catch {
    einmalWarnen("navimow.karte.frameUngueltig", roh);
    return null;
  }
}

export function parseStation(roh: unknown): Punkt | null {
  try {
    const o = typeof roh === "string" ? JSON.parse(roh) : roh;
    if (!o || typeof o !== "object") throw new Error("kein Objekt");
    if (!alleEndlich(o, ["x", "y"])) throw new Error("Felder fehlen");
    return { x: o.x, y: o.y };
  } catch {
    einmalWarnen("navimow.karte.stationUngueltig", roh);
    return null;
  }
}

/**
 * Weltkoordinaten (m) → Prozent des Bildes. Die y-Achse ist invertiert (oben = maxY),
 * am echten PNG bestätigt: Station 4,75/−1 → 543/617 px, Mäher 4,75/−1,25 → 543/623 px,
 * erster Spurpunkt 0,5/13 → 446/297 px. Der Adapter rechnet identisch.
 * Prozent statt Pixel, damit dieselben Werte in Kachel und Dialog stimmen.
 */
export function kartenPosition(frame: KartenFrame, x: number, y: number): { leftProzent: number; topProzent: number } {
  return {
    leftProzent: ((x - frame.minX) * frame.scale) / frame.width * 100,
    topProzent: ((frame.maxY - y) * frame.scale) / frame.height * 100,
  };
}

let letzterKartenVersuch: KartenVersuch | null = null;

/**
 * Holt map + mapFrame + dockPosition immer gemeinsam — der Rahmen wächst nur bei einem
 * Render, Bild und Rahmen müssen zusammenpassen. Kein eigener Retry: der nächste Tick,
 * der die Ladebedingung erfüllt, versucht es wieder.
 */
export async function karteLaden(ausloeser: "tick" | "dialog" = "tick"): Promise<void> {
  const m = navimow.value;
  const versuch: KartenVersuch = { zeit: Date.now(), zustand: m.zustand, fortschritt: fortschrittRoh, flaeche: m.letzteFlaeche };
  if (!kartenLadenNoetig(letzterKartenVersuch, versuch, ausloeser)) return;
  letzterKartenVersuch = versuch;
  try {
    const [bild, frameRoh, stationRoh, spurRoh] = await Promise.all([
      fetchState<unknown>(`${PREFIX()}.map`),
      fetchState<unknown>(`${PREFIX()}.mapFrame`),
      fetchState<unknown>(`${PREFIX()}.dockPosition`),
      fetchState<unknown>(`${PREFIX()}.mapTrack`),
    ]);
    kartenFrame.value = parseKartenFrame(frameRoh);
    station.value = parseStation(stationRoh);
    // Umriss nur neu rechnen, wenn sich die Spur geändert hat (Länge + Ende als Kennung, wie beim Bild)
    const spurText = typeof spurRoh === "string" ? spurRoh : "";
    const kennung = `${spurText.length}:${spurText.slice(-64)}`;
    if (kennung !== spurKennung) {
      spurKennung = kennung;
      const spur = spurLesen(spurRoh);
      try { rasen.value = spur ? rasenUmriss(spur) : null; } catch (e: any) { rasen.value = null; einmalWarnen("navimow.karte.umrissFehler", e?.message); }
    }
    if (!istGueltigeKarte(bild)) {
      // Früher ein Bild gehabt, jetzt keins: das alte bleibt, die Fußzeile sagt es.
      karteFehlgeschlagen.value = karte.value !== null;
      return;
    }
    karteFehlgeschlagen.value = false;
    const ende = bild.slice(-64);
    if (bild.length === karteKennung.laenge && ende === karteKennung.ende) return; // unverändert: weder Vue noch Decoder anstoßen
    karteKennung = { laenge: bild.length, ende };
    karte.value = bild;
    karteBildDefekt.value = false;
    karteStand.value = versuch.zeit;
  } catch (err: any) {
    karteFehlgeschlagen.value = true;
    logger.warn("navimow.karte.ladenFehlgeschlagen", { error: err?.message || String(err) });
  }
}

// ───────── Steuerung ─────────

export type NavimowAktion = "start" | "weiter" | "pause" | "station";

/**
 * Welche Tasten die Kachel zeigt — höchstens zwei: eine für „Machen", eine für „Heim".
 *
 * Bewusst NICHT angeboten, damit es in einem halben Jahr nicht wie Vergessen aussieht:
 *   - remote.stop: lässt den Mäher mitten im Rasen stehen. „Zur Station" deckt jeden Fall
 *     ab, in dem man ihn anhalten will, „Pause" den Rest.
 *   - remote.resetMap: löscht die Mähspur unwiederbringlich.
 *   - Start in isDocking: er tut schon das Richtige; Umkehren ist am Gerät ungeprüft.
 *   - Start in Error: Messer nach einer Störung ohne hinzusehen zu starten ist falsch — wer
 *     das Hindernis beseitigt hat, steht neben dem Gerät. Heimschicken ist der einzige
 *     ungefährliche Versuch aus der Küche.
 *   - isLifted: hier hilft nur Hinlaufen, das Popup übernimmt.
 *   - isMapping, inSoftwareUpdate, Self-Checking, Offline, leer, unbekannt: nichts anbieten,
 *     was einen Vorgang stört oder einen Zustand betrifft, den wir nicht kennen.
 * Kein eigener Akku-Schwellwert: die Cloud entscheidet, die 120-s-Rückmeldung fängt eine
 * Ablehnung ab.
 */
export function navimowAktionen(zustand: string, adapterVerbunden: boolean, backendErreichbar: boolean): NavimowAktion[] {
  if (!adapterVerbunden || !backendErreichbar) return [];
  switch ((zustand ?? "").trim()) {
    case "isDocked": return ["start"];
    case "isIdle": return ["start", "station"];
    case "isRunning": return ["pause", "station"];
    case "isPaused": return ["weiter", "station"];
    case "Error": return ["station"];
    default: return [];
  }
}

/** Zweistufig: alles, was Messer in Gang setzt. Anhalten und Heimschicken bleiben ein Tipp. */
export const BRAUCHT_BESTAETIGUNG: ReadonlySet<NavimowAktion> = new Set<NavimowAktion>(["start", "weiter"]);
export const BESTAETIGUNG_MS = 5_000;

const BEFEHLE: Record<NavimowAktion, string> = {
  start: "start",
  weiter: "resume",
  pause: "pause",
  station: "dock",
};

/** Welche Zustände die Erwartung erfüllen. */
const ZIELE: Record<NavimowAktion, string[]> = {
  start: ["isRunning"],
  weiter: ["isRunning"],
  pause: ["isPaused"],
  station: ["isDocking", "isDocked"],
};

export const AKTION_TEXT: Record<NavimowAktion, string> = {
  start: "Start",
  weiter: "Weiter",
  pause: "Pause",
  station: "Zur Station",
};

/** Sperre gegen Doppeltipp (Roborock-Wert). Ein zweiter Tipp in der Sperre wird verworfen, nie gepuffert. */
export const befehlLaeuft = ref(false);
const SPERRE_MS = 2_500;

export interface BefehlOffen {
  aktion: NavimowAktion;
  ziele: string[];
  zustandVorher: string;
  /** Zeitpunkt (ms), ab dem die Erwartung als abgelaufen gilt. */
  bis: number;
}
/** Die Cloud braucht 1–2 min; solange gilt der Befehl als „geschickt, Antwort offen". */
export const ERWARTUNG_MS = 120_000;
/**
 * Nachpoll-Serie in Sekunden. Roborock hat 2/6 s — zu kurz für eine Cloud, die 1–2 min braucht;
 * 2 s ist trotzdem nicht sinnlos, weil der Adapter vehicleState auch aus dem MQTT-Strom schreibt.
 */
export const NACHPOLL_S = [2, 6, 15, 30, 60, 120];

export const befehlOffen = ref<BefehlOffen | null>(null);

export interface BefehlMeldung {
  art: "ok" | "warnung" | "fehler";
  text: string;
}
// shallowRef: die Meldung wird nach Ablauf per Identität verglichen (nur die EIGENE löschen);
// ein ref würde das Objekt in einen Proxy hüllen und der Vergleich schlüge fehl.
export const befehlMeldung = shallowRef<BefehlMeldung | null>(null);

/** Zweitbestätigung: welche Taste gerade „Wirklich mähen?" zeigt und bis wann. */
export const bestaetigung = ref<{ aktion: NavimowAktion; bis: number } | null>(null);

let nachpollTimer: ReturnType<typeof setTimeout>[] = [];
let meldungTimer: ReturnType<typeof setTimeout> | null = null;
let bestaetigungTimer: ReturnType<typeof setTimeout> | null = null;
let sperreTimer: ReturnType<typeof setTimeout> | null = null;

/** Räumt alle Timer — bei neuem Befehl und beim Unmount der Kachel. */
export function navimowAufraeumen() {
  nachpollTimer.forEach((t) => clearTimeout(t));
  nachpollTimer = [];
  if (meldungTimer) clearTimeout(meldungTimer);
  meldungTimer = null;
  if (bestaetigungTimer) clearTimeout(bestaetigungTimer);
  bestaetigungTimer = null;
  if (sperreTimer) clearTimeout(sperreTimer);
  sperreTimer = null;
}

function zeigeMeldung(m: BefehlMeldung, dauerMs: number) {
  if (meldungTimer) clearTimeout(meldungTimer);
  meldungTimer = null;
  befehlMeldung.value = m;
  if (dauerMs > 0) {
    meldungTimer = setTimeout(() => {
      if (befehlMeldung.value === m) befehlMeldung.value = null;
    }, dauerMs);
  }
}

export type RueckmeldungsStand = "offen" | "erfuellt" | "verfallen" | "abgelaufen";

/**
 * Wie steht es um einen offenen Befehl? Ziel erreicht → erfüllt. Ein ANDERER Zustand als
 * vorher (z. B. Error) → verfallen: Statusbox und Popup übernehmen, die Rückmeldung
 * schweigt. Unverändert und Frist vorbei → abgelaufen. Sonst offen.
 */
export function rueckmeldung(b: BefehlOffen, zustand: string, jetzt: number): RueckmeldungsStand {
  if (b.ziele.includes(zustand)) return "erfuellt";
  if (zustand !== b.zustandVorher) return "verfallen";
  if (jetzt >= b.bis) return "abgelaufen";
  return "offen";
}

function befehlOffenPruefen(jetzt: number) {
  const b = befehlOffen.value;
  if (!b) return;
  const stand = rueckmeldung(b, navimow.value.zustand, jetzt);
  if (stand === "offen") return;
  befehlOffen.value = null;
  nachpollTimer.forEach((t) => clearTimeout(t));
  nachpollTimer = [];
  if (stand === "erfuellt") zeigeMeldung({ art: "ok", text: "✓ angekommen" }, 5_000);
  if (stand === "abgelaufen") {
    // bleibt bis zum nächsten Zustandswechsel (poll) oder Tipp (navimowBefehl)
    zeigeMeldung({ art: "warnung", text: "Der Mäher hat nicht reagiert – im Zweifel in der App nachsehen." }, 0);
  }
}

/**
 * Trockenlauf: `npm run dev` zeigt echte Daten aus ioBroker, die Tasten wären
 * scharf. Mit VITE_NAVIMOW_TROCKEN=1 wird der Befehl nur protokolliert. Ein eigener
 * Schalter, damit die Abschaltung als Absicht lesbar ist, nicht als Zahlendreher.
 */
function istTrockenlauf(): boolean {
  // Zwei Wege, und beide werden gebraucht (Befund vom 13.09.): Vite übernimmt eine
  // VITE_-Variable aus der SHELL nicht von selbst nach import.meta.env -- sie muss in
  // vite.config.ts durchgereicht werden, was jetzt geschieht. Der localStorage-Schalter
  // wirkt zusätzlich im laufenden Browser, auch am Tablet, ohne Neustart des Servers:
  //   localStorage.setItem('navimowTrocken','1')
  if ((import.meta as any)?.env?.VITE_NAVIMOW_TROCKEN === "1") return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("navimowTrocken") === "1";
  } catch {
    return false;
  }
}

/**
 * Schickt den Befehl (ioBroker-Button-State = true). `true` heißt nur: ioBroker hat den
 * Wert angenommen — nicht, dass der Mäher fährt. Ob er folgt, klärt die Erwartung
 * (befehlOffen) über die Nachpoll-Serie.
 */
export async function navimowBefehl(aktion: NavimowAktion): Promise<boolean> {
  if (befehlLaeuft.value) return false;
  befehlLaeuft.value = true;
  bestaetigung.value = null;
  befehlMeldung.value = null; // ein Tipp beendet auch die orange „hat nicht reagiert"-Zeile
  try {
    const id = `${PREFIX()}.remote.${BEFEHLE[aktion]}`;
    let ok: boolean;
    if (istTrockenlauf()) {
      logger.info("navimow.befehl.trocken", { id });
      ok = true;
    } else {
      ok = await setState(id, true);
    }
    if (!ok) {
      zeigeMeldung({ art: "fehler", text: "Befehl kam nicht bei ioBroker an." }, 6_000);
      return false;
    }
    const jetzt = Date.now();
    // Ein neuer Befehl ersetzt die alte Erwartung — nie zwei offene.
    nachpollTimer.forEach((t) => clearTimeout(t));
    nachpollTimer = [];
    befehlOffen.value = { aktion, ziele: ZIELE[aktion], zustandVorher: navimow.value.zustand, bis: jetzt + ERWARTUNG_MS };
    for (const s of NACHPOLL_S) {
      nachpollTimer.push(
        setTimeout(() => {
          // Ohne Karte (sonst sechs Bilder), und auch nach einem gescheiterten Poll prüfen —
          // sonst bliebe die Pille bei Netzproblemen ewig stehen.
          poll(false)
            .catch(() => undefined)
            .finally(() => befehlOffenPruefen(Date.now()));
        }, s * 1000),
      );
    }
    return true;
  } finally {
    if (sperreTimer) clearTimeout(sperreTimer);
    sperreTimer = setTimeout(() => {
      befehlLaeuft.value = false;
    }, SPERRE_MS);
  }
}

export type TippErgebnis = "bestaetigen" | "gesendet" | "fehlgeschlagen" | "verworfen";

/**
 * Ein Tipp auf eine Taste. Start/Weiter brauchen zwei Tipps binnen 5 s — die teure
 * Fehlbedienung am Küchentisch ist der versehentlich gestartete Mäher, nicht der
 * versehentlich geparkte. Kein Modal, kein Popup: im Kiosk darf nichts offen stehen bleiben.
 */
export async function navimowTippen(aktion: NavimowAktion): Promise<TippErgebnis> {
  if (befehlLaeuft.value) return "verworfen";
  if (BRAUCHT_BESTAETIGUNG.has(aktion)) {
    const jetzt = Date.now();
    const b = bestaetigung.value;
    if (!b || b.aktion !== aktion || jetzt > b.bis) {
      bestaetigung.value = { aktion, bis: jetzt + BESTAETIGUNG_MS };
      if (bestaetigungTimer) clearTimeout(bestaetigungTimer);
      bestaetigungTimer = setTimeout(() => {
        if (bestaetigung.value?.aktion === aktion) bestaetigung.value = null;
      }, BESTAETIGUNG_MS);
      return "bestaetigen";
    }
  }
  return (await navimowBefehl(aktion)) ? "gesendet" : "fehlgeschlagen";
}

export const navimowFeature: FeatureModule = { name: "navimow", interval: "slow", poll: () => poll(true) };
