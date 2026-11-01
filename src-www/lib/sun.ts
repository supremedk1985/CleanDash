/**
 * Sunrise and sunset for a date and a location (approximation after the NOAA Solar Calculator, about ±2 minutes).
 * Used to switch the dashboard to dark an hour before sunset and back to light an hour after sunrise.
 */
const DEG = Math.PI / 180;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function sunTimes(date: Date, latitude: number, longitude: number): { sunrise: Date; sunset: Date } {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const lat = latitude * DEG;
  const cosH = (Math.cos(90.833 * DEG) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  // polar day or night: clamp instead of NaN
  const h = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG;
  const noon = 720 - 4 * longitude - eqTime - date.getTimezoneOffset();
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return {
    sunrise: new Date(midnight.getTime() + (noon - 4 * h) * 60_000),
    sunset: new Date(midnight.getTime() + (noon + 4 * h) * 60_000),
  };
}

const HOUR = 3_600_000;

export function isDarkAt(date: Date, latitude: number, longitude: number): boolean {
  const { sunrise, sunset } = sunTimes(date, latitude, longitude);
  return date.getTime() < sunrise.getTime() + HOUR || date.getTime() >= sunset.getTime() - HOUR;
}
