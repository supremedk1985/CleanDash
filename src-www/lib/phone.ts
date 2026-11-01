/**
 * Schmale Anzeige (Handy, cerebro-App) gegen das Küchen-Tablet: unter 640 px gilt „Handy" -- dieselbe Grenze wie
 * Tailwinds `sm:`, damit Klassen und Werte im Skript (Knob-Größen, Symbolgrößen) dieselbe Entscheidung treffen.
 * Seit 27.10.2026 (Daniel: „optimiere die Darstellung fürs Handy").
 */
import { ref } from "vue";

const abfrage = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 639px)") : null;

export const istHandy = ref(abfrage?.matches ?? false);
abfrage?.addEventListener?.("change", (e) => { istHandy.value = e.matches; });
