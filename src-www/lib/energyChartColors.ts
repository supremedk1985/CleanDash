/**
 * energyChartColors.ts
 * ---------------------
 * Farben fürs Popup der Energiezentrale. Feste Zuordnung Größe → Farbe, nach dem Vorbild der Anker-App
 * (Daniel, 01.10.2026: „so wie im Screenshot"): Haus blau, Speicher grün, Solar gelb, Netz violett.
 * Dieselbe Farbe gilt für Symbol, Kurve, Balkenstück und Punkt in der Analyse — eine Farbe, eine Bedeutung.
 */

import { computed } from "vue";
import { isDark } from "./store";

const LIGHT = {
  haus: "#1a73e8",
  speicher: "#12b76a",
  solar: "#f2b200",
  netz: "#7b6fdc",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  muted: "#898781",
  gridline: "#e4e6eb",
};

const DARK = {
  haus: "#4c9aff",
  speicher: "#2fcf86",
  solar: "#f5c02e",
  netz: "#9b91ef",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  muted: "#8d8c86",
  gridline: "#33343a",
};

export const energyChartColors = computed(() => (isDark.value ? DARK : LIGHT));

/** Farbe mit Deckkraft (für Kurvenflächen und getönte Symbolkreise) */
export function mitDeckkraft(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
