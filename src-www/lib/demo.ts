/**
 * A made-up house for development, screenshots and the demo. No real device, no real home.
 */
import type { RawConfig } from "./config";

const d = (s: string) => `0_userdata.0.demo.${s}`;

export const DEMO_CONFIG: RawConfig = {
  title: "",
  weatherInstance: "openweathermap.0",
  weatherHourly: true,
  energySavings: d("e.saved"),
  energyTotal: d("e.total"),
  energyTitle: "",
  trashInstance: "trashschedule.0",
  dishwasherDevice: "homeconnect.0.DEMO",
  stovePrefix: d("stove"),
  energySolar: d("e.solar"),
  energyConsumption: d("e.home"),
  energyGridImport: d("e.gridIn"),
  energyGridExport: d("e.gridOut"),
  energyBatteryLevel: d("e.soc"),
  energyBatteryCharge: d("e.charge"),
  energyBatteryDischarge: d("e.discharge"),
  energySolarToday: d("e.solarToday"),
  energyConsumptionToday: d("e.homeToday"),
  energyGridToday: d("e.gridToday"),
  shoppingLists: [{ name: "Groceries", content: "bring.0.demo-list.content" }],
  confirmWrites: "all",
  theme: "auto",
  rooms: [
    { name: "Living room", floor: "Ground floor", temperature: d("living.temp"), setpoint: d("living.set"), humidity: d("living.hum"), heating: d("living.valve"), window: d("living.window") },
    { name: "Kitchen", floor: "Ground floor", temperature: d("kitchen.temp"), setpoint: d("kitchen.set"), humidity: d("kitchen.hum"), heating: d("kitchen.valve"), window: d("kitchen.window"), windowMode: "handle" },
    { name: "Office", floor: "Ground floor", temperature: d("office.temp"), setpoint: d("office.set") },
    { name: "Utility", floor: "Ground floor" },
    { name: "Bedroom", floor: "Upstairs", temperature: d("bed.temp"), setpoint: d("bed.set"), humidity: d("bed.hum"), window: d("bed.window"), windowMode: "text" },
    { name: "Kids", floor: "Upstairs", temperature: d("kids.temp"), setpoint: d("kids.set"), heating: d("kids.valve") },
    { name: "Bathroom", floor: "Upstairs", temperature: d("bath.temp"), setpoint: d("bath.set"), humidity: d("bath.hum") },
  ],
  lights: [
    { name: "Floor lamp", room: "Living room", on: d("l.floor.on"), level: d("l.floor.level") },
    { name: "Ceiling", room: "Living room", on: d("l.ceiling.on") },
    { name: "LED strips", room: "Living room", on: d("l.strip1.on"), level: d("l.strip1.bri"), levelMax: 255 },
    { name: "LED strips", room: "Living room", on: d("l.strip2.on"), level: d("l.strip2.bri"), levelMax: 255 },
    { name: "Table", room: "Kitchen", on: d("l.table.on"), level: d("l.table.level") },
    { name: "Ceiling", room: "Bedroom", on: d("l.bed.on"), level: d("l.bed.level") },
    { name: "Night light", room: "Kids", on: d("l.kids.on"), level: d("l.kids.level"), reachable: d("l.kids.reach") },
    { name: "Porch", room: "Outside", on: d("l.porch.on") },
    { name: "Garden", room: "Outside", on: d("l.garden.on") },
  ],
  shutters: [
    { room: "Living room", name: "Terrace door", position: d("s.living1") },
    { room: "Living room", name: "Window", position: d("s.living2") },
    { room: "Bedroom", position: d("s.bed"), max: 100, closedAt: "min" },
  ],
};

/** A forecast that starts at the coming full hour, so the demo always looks current. */
function demoWeather(): Record<string, unknown> {
  const f = "openweathermap.0.forecast";
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const hour = now.getTime() + 3_600_000;
  const day0 = new Date(now);
  day0.setHours(12);
  const icons = ["02d", "10d", "01d", "03d", "09d", "01d"];
  const v: Record<string, unknown> = {
    [`${f}.current.temperature`]: 13.4, [`${f}.current.state`]: "Few clouds", [`${f}.current.icon`]: "https://openweathermap.org/img/w/02d.png",
    [`${f}.current.windSpeed`]: 4.2, [`${f}.current.windGust`]: 9.1, [`${f}.current.pressure`]: 1018, [`${f}.current.humidity`]: 71,
    [`${f}.current.sunrise`]: new Date(now).setHours(7, 12), [`${f}.current.sunset`]: new Date(now).setHours(17, 4),
  };
  icons.forEach((icon, i) => {
    Object.assign(v, {
      [`${f}.day${i}.date`]: day0.getTime() + i * 86_400_000, [`${f}.day${i}.temperatureMax`]: [14, 11, 16, 15, 10, 17][i],
      [`${f}.day${i}.temperatureMin`]: [6, 7, 5, 8, 6, 9][i], [`${f}.day${i}.precipitation`]: [0, 4.2, 0, 0.3, 7.5, 0][i],
      [`${f}.day${i}.icon`]: `https://openweathermap.org/img/w/${icon}.png`,
      [`${f}.day${i}.state`]: ["Few clouds", "Light rain", "Clear sky", "Scattered clouds", "Showers", "Clear sky"][i],
      [`${f}.day${i}.windSpeed`]: [3, 5, 2, 4, 7, 2][i],
    });
  });
  for (let i = 0; i < 8; i++) {
    Object.assign(v, {
      [`${f}.period${i}.date`]: hour + i * 3 * 3_600_000, [`${f}.period${i}.temperatureMax`]: [13, 14, 12, 9, 7, 6, 8, 11][i],
      [`${f}.period${i}.precipitation`]: [0, 0, 0.4, 1.2, 0, 0, 0, 0][i],
      [`${f}.period${i}.icon`]: `https://openweathermap.org/img/w/${["02", "03", "10", "10", "04", "01", "02", "02"][i]}${(() => { const h = new Date(hour + i * 3 * 3_600_000).getHours(); return h >= 7 && h < 18 ? "d" : "n"; })()}.png`,
    });
  }
  return v;
}

export const DEMO_NATIVE: Record<string, unknown> = {
  "system.adapter.trashschedule.0": { trashtypes: [{ name: "Recycling", color: "#d6b51e" }, { name: "Paper", color: "#2f6fd6" }, { name: "Residual", color: "#5b5b5b" }] },
};

/** Eckwerte des erfundenen Demo-Kamins (siehe demoKaminTemp). */
export const DEMO_STOVE = { aus: 20, peak: 236, schwelle: 168 };

export const DEMO_VALUES: Record<string, unknown> = {
  ...demoWeather(),
  [d("e.solar")]: 1240, [d("e.home")]: 410, [d("e.gridIn")]: 0, [d("e.gridOut")]: 230, [d("e.soc")]: 64, [d("e.charge")]: 600, [d("e.discharge")]: 0,
  [d("e.saved")]: 412.5, [d("e.total")]: 1840.2, [d("e.solarToday")]: 6.4, [d("e.homeToday")]: 7.9, [d("e.gridToday")]: 2.1,
  "trashschedule.0.next.daysLeft": 1, "trashschedule.0.next.types": "Recycling",
  "trashschedule.0.nextAfter.daysLeft": 6, "trashschedule.0.nextAfter.types": "Paper, Residual",
  "homeconnect.0.DEMO.status.BSH_Common_Status_OperationState": "BSH.Common.EnumType.OperationState.Run",
  "homeconnect.0.DEMO.programs.active.options.BSH_Common_Option_ProgramProgress": 62,
  "homeconnect.0.DEMO.programs.active.options.BSH_Common_Option_RemainingProgramTime": 2820,
  "homeconnect.0.DEMO.general.connected": true,
  "bring.0.demo-list.content": JSON.stringify([{ name: "Milk", specification: "2 litres" }, { name: "Bread" }, { name: "Apples" }, { name: "Coffee" }]),
  "bring.0.demo-list.recentContent": JSON.stringify([{ name: "Butter" }, { name: "Eggs" }, { name: "Cheese" }, { name: "Bananas" }]),
  [d("living.temp")]: 21.4, [d("living.set")]: 21, [d("living.hum")]: 46, [d("living.valve")]: 12, [d("living.window")]: false,
  [d("kitchen.temp")]: 22.1, [d("kitchen.set")]: 20.5, [d("kitchen.hum")]: 52, [d("kitchen.window")]: 1, [d("kitchen.valve")]: 30,
  [d("office.temp")]: 20.2, [d("office.set")]: 20,
  [d("bed.temp")]: 18.6, [d("bed.set")]: 18, [d("bed.hum")]: 55, [d("bed.window")]: "CLOSED",
  [d("kids.temp")]: 20.9, [d("kids.set")]: 21, [d("kids.valve")]: 0,
  [d("bath.temp")]: 23.0, [d("bath.set")]: 22.5, [d("bath.hum")]: 61,
  [d("l.floor.on")]: true, [d("l.floor.level")]: 60, [d("l.ceiling.on")]: false,
  [d("l.strip1.on")]: true, [d("l.strip1.bri")]: 128, [d("l.strip2.on")]: true, [d("l.strip2.bri")]: 128,
  [d("l.table.on")]: false, [d("l.table.level")]: 80,
  [d("l.bed.on")]: false, [d("l.bed.level")]: 40,
  [d("l.kids.on")]: true, [d("l.kids.level")]: 15, [d("l.kids.reach")]: true,
  [d("l.porch.on")]: true, [d("l.garden.on")]: false,
  [d("s.living1")]: 0, [d("s.living2")]: 40, [d("s.bed")]: 0,
  [d("stove.temperatur")]: Math.round(demoKaminTemp(Date.now()) * 10) / 10, [d("stove.zustand")]: demoKaminZustand(Date.now()),
  [d("stove.kraft")]: Math.max(0, Math.min(1, (demoKaminTemp(Date.now()) - DEMO_STOVE.aus) / (DEMO_STOVE.peak - DEMO_STOVE.aus))),
  [d("stove.hoechst")]: DEMO_STOVE.peak, [d("stove.schwelle")]: DEMO_STOVE.schwelle, [d("stove.modul")]: 19,
  [d("stove.erreichbar")]: true, [d("stove.meldung")]: "",
};

/**
 * Ein erfundener Kamin für die Demo: jeden Abend ab 18 Uhr ein Feuer über rund vier Stunden, an geraden Tagen zusätzlich
 * eines am Morgen. Die Temperatur steigt schnell auf die Spitze, fällt dann langsam; einmal je Feuer wird nachgelegt (ein
 * zweiter Buckel). So zeigt das Analyse-Popup echte Abbrände, ohne ein echtes Gerät. Eine reine Funktion der Zeit.
 */

/** Beginn (ms) des jüngsten Demo-Feuers bei oder vor `t`, oder null. */
function demoFeuerStart(t: number): number | null {
  const d = new Date(t);
  const kandidaten: number[] = [];
  // Ein gerade laufendes Feuer, damit die Kachel in der Demo immer sichtbar ist (es begann vor 40 Minuten).
  kandidaten.push(Date.now() - 40 * 60_000);
  for (let zurueck = 0; zurueck <= 1; zurueck++) {
    const tag = new Date(d.getFullYear(), d.getMonth(), d.getDate() - zurueck);
    kandidaten.push(new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 18, 0, 0).getTime()); // Abendfeuer
    if (tag.getDate() % 2 === 0) kandidaten.push(new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 8, 0, 0).getTime()); // Morgenfeuer
  }
  const vergangen = kandidaten.filter((s) => s <= t && t - s <= 5 * 3600_000).sort((a, b) => b - a);
  return vergangen[0] ?? null;
}

export function demoKaminTemp(t: number): number {
  const s = demoFeuerStart(t);
  const grund = DEMO_STOVE.aus + 2 * Math.sin(t / 7e6);
  if (s === null) return grund;
  const altMin = (t - s) / 60_000;
  // Anstieg in 25 min auf die Spitze, danach exponentieller Abfall
  const anstieg = DEMO_STOVE.aus + (DEMO_STOVE.peak - DEMO_STOVE.aus) * Math.min(1, altMin / 25);
  const abfall = DEMO_STOVE.aus + (DEMO_STOVE.peak - DEMO_STOVE.aus) * Math.exp(-(altMin - 25) / 95);
  let temp = altMin <= 25 ? anstieg : abfall;
  // Nachlegen: ein zweiter Buckel ab Minute 135 für 45 min
  if (altMin >= 135 && altMin <= 180) temp += 70 * Math.sin(((altMin - 135) / 45) * Math.PI);
  return Math.max(grund, temp);
}

export function demoKaminZustand(t: number): string {
  const temp = demoKaminTemp(t);
  if (temp < 60) return "kalt";
  const s = demoFeuerStart(t);
  const steigt = s !== null && (t - s) / 60_000 <= 25;
  return steigt || temp >= DEMO_STOVE.schwelle ? "brennt" : "nachlegen";
}

/** Verlauf des Demo-Kamins für die History-Antwort (Punkte [Wert, Zeit]). */
export function demoKaminReihe(id: string, from: number, to: number): [unknown, number][] | null {
  const feld = id.endsWith(".temperatur") ? "temperatur" : id.endsWith(".modul") ? "modul"
    : id.endsWith(".schwelle") ? "schwelle" : id.endsWith(".zustand") ? "zustand" : null;
  if (!feld) return null;
  const pts: [unknown, number][] = [];
  for (let t = from; t <= to; t += 15 * 60_000) {
    if (feld === "temperatur") pts.push([Math.round(demoKaminTemp(t) * 10) / 10, t]);
    else if (feld === "modul") pts.push([19 + Math.round(Math.sin(t / 5e6) * 2), t]);
    else if (feld === "schwelle") pts.push([DEMO_STOVE.schwelle, t]);
    else pts.push([demoKaminZustand(t), t]);
  }
  return pts;
}

const GERMAN: Record<string, string> = {
  "Living room": "Wohnzimmer", Kitchen: "Küche", Office: "Büro", Utility: "Hauswirtschaft", Bedroom: "Schlafzimmer",
  Kids: "Kinderzimmer", Bathroom: "Bad", "Ground floor": "Erdgeschoss", Upstairs: "Obergeschoss", Outside: "Außen",
  "Floor lamp": "Stehlampe", Ceiling: "Decke", "LED strips": "LED-Leisten", Table: "Esstisch", "Night light": "Nachtlicht",
  Porch: "Haustür", Garden: "Garten", "Terrace door": "Terrassentür", Window: "Fenster", Groceries: "Einkaufen",
};

/** The demo house in the viewer's language. */
export function demoConfig(lang: string): RawConfig {
  if (lang !== "de") return DEMO_CONFIG;
  const de = (s?: string) => (s ? GERMAN[s] ?? s : s);
  return {
    ...DEMO_CONFIG,
    rooms: DEMO_CONFIG.rooms!.map((r) => ({ ...r, name: de(r.name)!, floor: de(r.floor) })),
    lights: DEMO_CONFIG.lights!.map((l) => ({ ...l, name: de(l.name)!, room: de(l.room) })),
    shutters: DEMO_CONFIG.shutters!.map((x) => ({ ...x, room: de(x.room)!, name: de(x.name) })),
    shoppingLists: DEMO_CONFIG.shoppingLists!.map((l) => ({ ...l, name: de(l.name) })),
  };
}
