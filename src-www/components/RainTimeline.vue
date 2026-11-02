<script setup lang="ts">
/**
 * Regen- und Temperatur-Zeitleiste für einen Tag (0–23 Uhr):
 *  - je Stunde ein breiter Balken für die Regenwahrscheinlichkeit (Höhe = Prozent) und darin ein
 *    schmaler, kräftiger für die Regenmenge (relativ zum Tagesmaximum, Skala mindestens 2 mm, damit
 *    Niesel nicht wie Starkregen aussieht; jede Stunde mit Regen mindestens 2 px hoch),
 *  - darüber die Temperatur als Linie im oberen Teil, Spanne mindestens 4 °C, Höchst- und Tiefstwert
 *    am jeweiligen Punkt,
 *  - eine senkrechte Markierung für „jetzt", Stundenmarken bei 0, 6, 12 und 18 Uhr.
 * Farben passend zum hellen und dunklen Dashboard.
 * Gezeichnet als SVG mit fester Zeichenfläche, die mit der Kachel skaliert.
 */
import { computed } from "vue";
import type { WetterTag } from "../lib/weatherData";
import { isDark } from "../lib/store";

const props = withDefaults(defineProps<{ tag: WetterTag; titel?: string; hoehe?: number; jetzt?: Date | null; schrift?: number }>(), {
  titel: "",
  hoehe: 110,
  jetzt: null,
  /** Schriftgröße in Einheiten der Zeichenfläche — für schmale Leisten größer, weil die Fläche mitschrumpft */
  schrift: 10,
});

const B = 480;                       // Breite der Zeichenfläche
const OBEN = computed(() => props.schrift + 4);      // Platz für die Temperaturbeschriftung
const UNTEN = computed(() => props.schrift + 4);     // Platz für die Stundenmarken
const GRUND = computed(() => props.hoehe - UNTEN.value);
const DIAGRAMM = computed(() => GRUND.value - OBEN.value);
const SPALTE = B / 24;

const farben = computed(() =>
  isDark.value
    ? { wahrsch: "#24507e", menge: "#4FA3FF", temp: "#FFB547", jetzt: "#FACC15", leise: "#7b8794", linie: "#2a3340" }
    : { wahrsch: "#d6e6f8", menge: "#2a78d6", temp: "#e8590c", jetzt: "#ca8a04", leise: "#7b8794", linie: "#d9dee5" },
);

/** 24 Stunden, fehlende als null — Open-Meteo liefert am Tag der Zeitumstellung 23 oder 25. */
const stunden = computed(() => {
  const liste = Array.from({ length: 24 }, (_, h) => props.tag.stunden.find((s) => s.h === h) ?? null);
  return liste;
});

const balken = computed(() => {
  const maxRegen = Math.max(2, ...stunden.value.map((s) => s?.regen ?? 0));
  return stunden.value.map((s, h) => {
    const p = Math.max(0, Math.min(100, s?.wahrsch ?? 0));
    const r = Math.max(0, s?.regen ?? 0);
    const hp = (p / 100) * DIAGRAMM.value;
    const hr = r > 0 ? Math.max(2, (r / maxRegen) * DIAGRAMM.value) : 0;
    return { h, x: h * SPALTE, hp, hr };
  });
});

const temperatur = computed(() => {
  const werte = stunden.value.map((s, h) => (s?.temp == null ? null : { h, t: s.temp }));
  const da = werte.filter((w): w is { h: number; t: number } => w != null);
  if (da.length < 2) return null;
  const min = Math.min(...da.map((w) => w.t));
  const max = Math.max(...da.map((w) => w.t));
  const spanne = Math.max(4, max - min);
  const mitte = (max + min) / 2, unten = mitte - spanne / 2;
  const hoeheTemp = DIAGRAMM.value * 0.45;          // die Linie lebt im oberen Teil
  const y = (t: number) => OBEN.value + (1 - (t - unten) / spanne) * hoeheTemp;
  const x = (h: number) => h * SPALTE + SPALTE / 2;
  const pfad = da.map((w, i) => `${i ? "L" : "M"}${x(w.h).toFixed(1)},${y(w.t).toFixed(1)}`).join(" ");
  const hoch = da.reduce((a, b) => (b.t > a.t ? b : a));
  const tief = da.reduce((a, b) => (b.t < a.t ? b : a));
  const marke = (w: { h: number; t: number }, oben: boolean) => ({
    x: Math.min(B - 12, Math.max(12, x(w.h))), y: y(w.t) + (oben ? -4 : props.schrift + 1), text: `${Math.round(w.t)}°`,
  });
  return { pfad, hoch: marke(hoch, true), tief: marke(tief, false), gleich: Math.round(hoch.t) === Math.round(tief.t) };
});

/** „jetzt" nur am heutigen Tag */
const jetztX = computed(() => {
  const n = props.jetzt;
  if (!n) return null;
  const heute = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  if (heute !== props.tag.datum) return null;
  return ((n.getHours() + n.getMinutes() / 60) / 24) * B;
});

const regenSumme = computed(() => Math.round(stunden.value.reduce((a, s) => a + (s?.regen ?? 0), 0) * 10) / 10);
const maxWahrsch = computed(() => Math.max(0, ...stunden.value.map((s) => s?.wahrsch ?? 0)));
</script>

<template>
  <div class="regen-zeitleiste">
    <div v-if="titel" class="flex items-baseline justify-between text-xs mb-1">
      <span class="font-semibold">{{ titel }}</span>
      <span class="text-gray-500 dark:text-gray-400 tabular-nums">{{ regenSumme }} mm · bis {{ maxWahrsch }} %</span>
    </div>
    <svg
      :viewBox="`0 0 ${B} ${hoehe}`"
      class="w-full h-auto block"
      role="img"
      :aria-label="`Regen und Temperatur ${titel || tag.datum}: ${regenSumme} mm, Regenwahrscheinlichkeit bis ${maxWahrsch} %`"
    >
      <line x1="0" :x2="B" :y1="GRUND" :y2="GRUND" :stroke="farben.linie" stroke-width="1" />
      <g v-for="b in balken" :key="b.h">
        <rect v-if="b.hp > 0" :x="b.x + SPALTE * 0.1" :y="GRUND - b.hp" :width="SPALTE * 0.8" :height="b.hp" :fill="farben.wahrsch" rx="1.5" />
        <rect v-if="b.hr > 0" :x="b.x + SPALTE * 0.35" :y="GRUND - b.hr" :width="SPALTE * 0.3" :height="b.hr" :fill="farben.menge" rx="1" />
      </g>
      <template v-if="temperatur">
        <path :d="temperatur.pfad" fill="none" :stroke="farben.temp" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <text :x="temperatur.hoch.x" :y="temperatur.hoch.y" :fill="farben.temp" :font-size="schrift" text-anchor="middle" font-weight="600">{{ temperatur.hoch.text }}</text>
        <text v-if="!temperatur.gleich" :x="temperatur.tief.x" :y="temperatur.tief.y" :fill="farben.temp" :font-size="schrift" text-anchor="middle" font-weight="600">{{ temperatur.tief.text }}</text>
      </template>
      <line v-if="jetztX != null" :x1="jetztX" :x2="jetztX" y1="2" :y2="GRUND" :stroke="farben.jetzt" stroke-width="2" />
      <text v-for="h in [0, 6, 12, 18]" :key="h" :x="h * SPALTE + SPALTE / 2" :y="hoehe - 2" :fill="farben.leise" :font-size="schrift" text-anchor="middle">{{ h }}</text>
    </svg>
  </div>
</template>
