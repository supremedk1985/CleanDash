/**
 * weatherIcon.ts
 * --------------
 * Ordnet den von OpenWeatherMap gelieferten Icon-Code (z.B. "10d") einer
 * weathericons-Klasse zu - inkl. Tag/Nacht-Variante. Robuster als ein
 * String-Match auf den englischen Titel ("Clear"/"Clouds"/...), der weder
 * Tag/Nacht kennt noch alle Fälle abdeckt.
 */

const ICON_MAP: Record<string, string> = {
  "01d": "wi-day-sunny",
  "01n": "wi-night-clear",
  "02d": "wi-day-cloudy",
  "02n": "wi-night-alt-cloudy",
  "03d": "wi-cloud",
  "03n": "wi-cloud",
  "04d": "wi-cloudy",
  "04n": "wi-cloudy",
  "09d": "wi-day-showers",
  "09n": "wi-night-alt-showers",
  "10d": "wi-day-rain",
  "10n": "wi-night-alt-rain",
  "11d": "wi-day-thunderstorm",
  "11n": "wi-night-alt-thunderstorm",
  "13d": "wi-day-snow",
  "13n": "wi-night-snow",
  "50d": "wi-day-fog",
  "50n": "wi-night-fog",
};

export function getWeatherIconClass(code: string): string {
  return ICON_MAP[code] ?? "wi-na";
}
