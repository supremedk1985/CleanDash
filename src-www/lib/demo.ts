/**
 * A made-up house for development, screenshots and the demo. No real device, no real home.
 */
import type { RawConfig } from "./config";

const d = (s: string) => `0_userdata.0.demo.${s}`;

export const DEMO_CONFIG: RawConfig = {
  title: "",
  weatherInstance: "openweathermap.0",
  trashInstance: "trashschedule.0",
  dishwasherDevice: "homeconnect.0.DEMO",
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
    [`${f}.current.windSpeed`]: 4.2, [`${f}.current.humidity`]: 71,
    [`${f}.current.sunrise`]: new Date(now).setHours(7, 12), [`${f}.current.sunset`]: new Date(now).setHours(17, 4),
  };
  icons.forEach((icon, i) => {
    Object.assign(v, {
      [`${f}.day${i}.date`]: day0.getTime() + i * 86_400_000, [`${f}.day${i}.temperatureMax`]: [14, 11, 16, 15, 10, 17][i],
      [`${f}.day${i}.temperatureMin`]: [6, 7, 5, 8, 6, 9][i], [`${f}.day${i}.precipitation`]: [0, 4.2, 0, 0.3, 7.5, 0][i],
      [`${f}.day${i}.icon`]: `https://openweathermap.org/img/w/${icon}.png`,
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

export const DEMO_VALUES: Record<string, unknown> = {
  ...demoWeather(),
  [d("e.solar")]: 1240, [d("e.home")]: 410, [d("e.gridIn")]: 0, [d("e.gridOut")]: 230, [d("e.soc")]: 64, [d("e.charge")]: 600, [d("e.discharge")]: 0,
  [d("e.solarToday")]: 6.4, [d("e.homeToday")]: 7.9, [d("e.gridToday")]: 2.1,
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
};

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
