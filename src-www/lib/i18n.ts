/**
 * The dashboard's own words, English and German. The language follows the ioBroker system setting; anything
 * other than German falls back to English.
 */
import { ref } from "vue";

const de = {
  connecting: "Verbinde mit ioBroker …",
  offline: "ioBroker nicht erreichbar – Anzeige eingefroren",
  offlineSince: "Stand {time} Uhr",
  noConfig: "Noch nichts eingerichtet",
  noConfigHint: "Räume, Lichter und Rollläden trägst du in den Einstellungen der Instanz im ioBroker-Admin ein.",
  demo: "Demo mit erfundenen Werten",
  house: "Haus",
  allOff: "Alles aus",
  lightsOn: "{n} Lichter an",
  lightOn: "1 Licht an",
  windowsClosed: "Fenster zu",
  windowsOpen: "Offen: {rooms}",
  allLightsOff: "Alle Lichter aus",
  otherLights: "Weitere Lichter",
  noThermostat: "ohne Thermostat",
  setpoint: "Soll",
  humidity: "Feuchte",
  heating: "Heizung läuft",
  heatingIdle: "Heizung ruht",
  windowOpen: "Fenster offen",
  windowTilted: "Fenster gekippt",
  lightCount: "{on} von {of} an",
  lightShort: "{on}/{of} an",
  lightsOffCount: "{of} Lampen aus",
  lightOff: "Licht aus",
  on: "an",
  off: "aus",
  unreachable: "nicht erreichbar",
  shutter: "Rollladen",
  shutterOpen: "offen",
  shutterClosed: "zu",
  shutterUp: "Ganz auf",
  shutterDown: "Ganz zu",
  roomHint: "Antippen eines Raums öffnet Lampen, Rollläden und Solltemperatur.",
  close: "Schließen",
  colder: "Kälter",
  warmer: "Wärmer",
  noLamps: "Für diesen Raum ist keine Lampe eingetragen.",
  confirmTitle: "Wirklich schalten?",
  yes: "Ja",
  no: "Nein",
  askSwitch: "{name} {state}schalten?",
  switchOnWord: "ein",
  switchOffWord: "aus",
  askDim: "{name} auf {level} % stellen?",
  askShutter: "{name} auf {value} stellen?",
  askSetpoint: "Solltemperatur {room} auf {value}° stellen?",
  askAllOff: "Das schaltet alle {n} brennenden Lichter aus.",
  askRoomOff: "Alle Lampen in {room} ausschalten?",
  askRoomOn: "Alle Lampen in {room} einschalten?",
  writeFailed: "Das hat nicht geklappt: {error}",
  brightness: "Helligkeit",
  dismiss: "Ausblenden",
  noticeWindowHeating: "{room}: Fenster {state}, die Heizung läuft",
  stateOpen: "offen",
  stateTilted: "gekippt",
  noticeUnreachable: "Nicht erreichbar: {lamps}",
};

const en: typeof de = {
  connecting: "Connecting to ioBroker …",
  offline: "ioBroker not reachable – display frozen",
  offlineSince: "as of {time}",
  noConfig: "Nothing set up yet",
  noConfigHint: "Add rooms, lights and shutters in the instance settings in the ioBroker admin.",
  demo: "Demo with made-up values",
  house: "Home",
  allOff: "All off",
  lightsOn: "{n} lights on",
  lightOn: "1 light on",
  windowsClosed: "Windows closed",
  windowsOpen: "Open: {rooms}",
  allLightsOff: "All lights off",
  otherLights: "More lights",
  noThermostat: "no thermostat",
  setpoint: "Set",
  humidity: "Humidity",
  heating: "Heating",
  heatingIdle: "Heating idle",
  windowOpen: "Window open",
  windowTilted: "Window tilted",
  lightCount: "{on} of {of} on",
  lightShort: "{on}/{of} on",
  lightsOffCount: "{of} lamps off",
  lightOff: "Light off",
  on: "on",
  off: "off",
  unreachable: "not reachable",
  shutter: "Shutter",
  shutterOpen: "open",
  shutterClosed: "closed",
  shutterUp: "Fully open",
  shutterDown: "Fully closed",
  roomHint: "Tap a room for its lamps, shutters and setpoint.",
  close: "Close",
  colder: "Colder",
  warmer: "Warmer",
  noLamps: "No lamp is set up for this room.",
  confirmTitle: "Switch now?",
  yes: "Yes",
  no: "No",
  askSwitch: "Switch {name} {state}?",
  switchOnWord: "on",
  switchOffWord: "off",
  askDim: "Set {name} to {level} %?",
  askShutter: "Set {name} to {value}?",
  askSetpoint: "Set {room} to {value}°?",
  askAllOff: "This switches off all {n} lights that are on.",
  askRoomOff: "Switch off all lamps in {room}?",
  askRoomOn: "Switch on all lamps in {room}?",
  writeFailed: "That did not work: {error}",
  brightness: "Brightness",
  dismiss: "Dismiss",
  noticeWindowHeating: "{room}: window {state} while the heating is on",
  stateOpen: "open",
  stateTilted: "tilted",
  noticeUnreachable: "Not reachable: {lamps}",
};

export type Key = keyof typeof de;
export const lang = ref<"de" | "en">("en");

export function setLanguage(l: string | undefined) {
  lang.value = l === "de" ? "de" : "en";
  document.documentElement.lang = lang.value;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const s = (lang.value === "de" ? de : en)[key];
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function number1(x: number | null): string {
  if (x === null) return "–";
  return x.toLocaleString(lang.value === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function clock(d: Date): string {
  return d.toLocaleTimeString(lang.value === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}
