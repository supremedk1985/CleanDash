/**
 * leerlauf.ts
 * -----------
 * Nach ein paar Minuten ohne Benutzung schließt das Dashboard alle Fenster und rollt nach oben, damit es aufgeräumt
 * aussieht, wenn man draufschaut.
 *
 * Nach LEERLAUF_MS ohne Berührung, Taste, Mausrad oder Scrollen zählt `ruhe` um eins hoch und die Seite rollt nach
 * oben. Jedes Fenster, das man SELBST öffnet, hört mit `beiRuhe()` darauf und schließt sich. Hinweise, die von selbst
 * kommen (Müll-Erinnerung, Hilferuf des Mähers), hören bewusst NICHT darauf -- die sollen stehen bleiben, bis jemand
 * reagiert.
 */
import { onBeforeUnmount, ref, watch } from "vue";

export const LEERLAUF_MS = 3 * 60_000;

/** Zählt jede Rückkehr in die Ruhe; Fenster schließen sich bei jeder Änderung. */
export const ruhe = ref(0);

// KEIN "scroll": Steht die Seite unten, verschiebt der Browser sie bei jeder Datenaktualisierung ein Stück
// (Scroll-Anchoring) -- das sah aus wie Benutzung, und die Ruhe trat nie ein (im Test gefunden).
// Echtes Scrollen kommt als touchstart/pointerdown (Finger), wheel (Maus) oder keydown (Tasten) an.
const EREIGNISSE = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

let uhr: ReturnType<typeof setTimeout> | undefined;
let aktiv = false;

function ruhig() {
  ruhe.value++;
  // sichtbar für Tests und zum Nachsehen im Browser: wie oft die Ruhe schon eingetreten ist
  try { document.documentElement.dataset.ruhe = String(ruhe.value); } catch { /* ohne DOM (Unit-Test) egal */ }
  // Sofort, nicht sanft: es schaut in dem Moment niemand hin, und ein sanftes Rollen hängt an der Bildrate.
  window.scrollTo(0, 0);
}

function nachstellen() {
  clearTimeout(uhr);
  uhr = setTimeout(ruhig, LEERLAUF_MS);
}

/** Einmal beim Start der App aufrufen. */
export function leerlaufStarten(): void {
  if (aktiv) return;
  aktiv = true;
  try { document.documentElement.dataset.leerlauf = "an"; } catch { /* ohne DOM egal */ }
  // capture: auch Berührungen in Fenstern, die Ereignisse selbst abfangen, zählen als Benutzung
  for (const e of EREIGNISSE) window.addEventListener(e, nachstellen, { passive: true, capture: true });
  nachstellen();
}

export function leerlaufStoppen(): void {
  if (!aktiv) return;
  aktiv = false;
  for (const e of EREIGNISSE) window.removeEventListener(e, nachstellen, { capture: true });
  clearTimeout(uhr);
}

/** Für Fenster: `beiRuhe(() => { offen.value = false; })` schließt es nach der Ruhezeit. */
export function beiRuhe(schliessen: () => void): void {
  const stopp = watch(ruhe, () => schliessen());
  onBeforeUnmount(stopp);
}
