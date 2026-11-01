/**
 * Weather data in the shape the weather tile uses: `weather` from the openweathermap adapter (current, six days,
 * eight 3-hour periods), `wetterstunden` hourly from Open-Meteo (rain probability and amount, temperature) for
 * the timelines. Open-Meteo is free, needs no key and is called at most every 30 minutes with the location from
 * the ioBroker system settings; it is only used when the setting "weatherHourly" is on.
 */
import { computed, ref } from "vue";
import { config, location, values } from "./store";
import { num } from "./values";
import { owmCode } from "./tiles";

export interface WeatherDay {
  date: number; temperaturMax: number; temperaturMin: number; windSpeed: number; state: string; rain: number;
  title: string; icon: string; humidity: number; pressure: number;
}
export interface WeatherHour { time: number; temperature: number; rain: number; icon: string }
export interface WeatherCurrent {
  temperature: number; windSpeed: number; windGust: number; humidity: number; pressure: number;
  sunrise: number; sunset: number; icon: string; state: string;
}

const DAYS = 6;
const PERIODS = 8;
const n = (v: unknown) => num(v) ?? 0;
const s = (v: unknown) => (typeof v === "string" ? v : "");
/** The adapter reports wind in m/s, the tile shows km/h. */
const kmh = (ms: number) => ms * 3.6;

export const weather = computed(() => {
  const f = `${config.value?.weather?.base}.forecast`;
  const v = (k: string) => values[`${f}.${k}`];
  const days: WeatherDay[] = Array.from({ length: DAYS }, (_, i) => ({
    date: n(v(`day${i}.date`)), temperaturMax: n(v(`day${i}.temperatureMax`)), temperaturMin: n(v(`day${i}.temperatureMin`)),
    windSpeed: kmh(n(v(`day${i}.windSpeed`))), state: s(v(`day${i}.state`)), rain: n(v(`day${i}.precipitation`)),
    title: s(v(`day${i}.title`)), icon: owmCode(v(`day${i}.icon`)), humidity: n(v(`day${i}.humidity`)), pressure: n(v(`day${i}.pressure`)),
  }));
  const hourly: WeatherHour[] = Array.from({ length: PERIODS }, (_, i) => ({
    time: n(v(`period${i}.date`)), temperature: n(v(`period${i}.temperatureMax`)), rain: n(v(`period${i}.precipitation`)), icon: owmCode(v(`period${i}.icon`)),
  }));
  const current: WeatherCurrent = {
    temperature: n(v("current.temperature")), windSpeed: kmh(n(v("current.windSpeed"))), windGust: kmh(n(v("current.windGust"))),
    humidity: n(v("current.humidity")), pressure: n(v("current.pressure")), sunrise: n(v("current.sunrise")), sunset: n(v("current.sunset")),
    icon: owmCode(v("current.icon")), state: s(v("current.state")),
  };
  return { current, days, hourly };
});

export const WEATHER_KEYS = {
  current: ["temperature", "state", "icon", "windSpeed", "windGust", "humidity", "pressure", "sunrise", "sunset"],
  day: ["date", "temperatureMax", "temperatureMin", "windSpeed", "state", "precipitation", "title", "icon", "humidity", "pressure"],
  period: ["date", "temperatureMax", "precipitation", "icon"],
  days: DAYS,
  periods: PERIODS,
};

// --- hourly from Open-Meteo -----------------------------------------------------------------------------------

export interface Stunde { h: number; temp: number | null; regen: number | null; wahrsch: number | null }
export interface WetterTag { datum: string; stunden: Stunde[] }

export const wetterstunden = ref<{ tage: WetterTag[]; stand: Date | null }>({ tage: [], stand: null });

/** Open-Meteo's answer (times like "2026-10-09T13:00", local) split into days of 24 hours. */
export function zerlegen(d: any): WetterTag[] {
  const zeiten: string[] = d?.hourly?.time ?? [];
  const tage = new Map<string, Stunde[]>();
  zeiten.forEach((t, i) => {
    const datum = t.slice(0, 10);
    if (!tage.has(datum)) tage.set(datum, []);
    tage.get(datum)!.push({
      h: Number(t.slice(11, 13)),
      temp: d.hourly.temperature_2m?.[i] ?? null,
      regen: d.hourly.precipitation?.[i] ?? null,
      wahrsch: d.hourly.precipitation_probability?.[i] ?? null,
    });
  });
  return [...tage].map(([datum, stunden]) => ({ datum, stunden }));
}

let last = 0;
let timer: number | undefined;

async function fetchHourly() {
  const loc = location.value;
  if (!config.value?.weatherHourly || loc.latitude === undefined || loc.longitude === undefined) return;
  if (Date.now() - last < 30 * 60_000 && wetterstunden.value.tage.length) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}`
      + "&hourly=temperature_2m,precipitation,precipitation_probability&timezone=auto&forecast_days=3";
    const a = await fetch(url, { cache: "no-store" });
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    const tage = zerlegen(await a.json());
    if (tage.length) {
      wetterstunden.value = { tage, stand: new Date() };
      last = Date.now();
    }
  } catch {
    // the last state stays; next try at the next tick
  }
}

/** Starts the hourly forecast (once); a no-op when the setting is off. */
export function startHourly() {
  if (timer !== undefined) return;
  void fetchHourly();
  timer = window.setInterval(fetchHourly, 90_000);
}
