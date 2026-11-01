/** Light/dark for the settings panel: the switch there overrides the automatic until the page is reloaded elsewhere. */
import { applyTheme, isDark, location } from "./store";
import { sunTimes, isDarkAt } from "./sun";

export { isDark };
export const STORAGE_KEY = "darkMode";

export function manualOverride(): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function setManualTheme(dark: boolean) {
  try { localStorage.setItem(STORAGE_KEY, dark ? "1" : "0"); } catch { /* storage blocked: only for this page */ }
  applyTheme(dark);
}

export function getThemeDiagnostics(): Record<string, string | boolean> {
  const now = new Date();
  const { latitude, longitude } = location.value;
  const out: Record<string, string | boolean> = { zeitpunkt: now.toLocaleString(), isDark: isDark.value };
  if (latitude !== undefined && longitude !== undefined) {
    const { sunrise, sunset } = sunTimes(now, latitude, longitude);
    out.sonnenaufgang = sunrise.toLocaleTimeString();
    out.sonnenuntergang = sunset.toLocaleTimeString();
    out.istDunkelzeit = isDarkAt(now, latitude, longitude);
  }
  const o = manualOverride();
  out.gespeicherterOverride = o === null ? "keiner (Automatik aktiv)" : o ? "dunkel" : "hell";
  return out;
}
