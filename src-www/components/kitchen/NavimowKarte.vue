<script setup lang="ts">
/**
 * NavimowKarte.vue -- die Mähkarte, einmal gebaut, zweimal genutzt (Kachel und Dialog).
 *
 * SEIT 01.10.2026 im Stil der Navimow-App (Daniel: Screenshot der App, „nur ohne Regen, aber in dem Stil";
 * dann: „die grauen Striche sollen dicker sein und grün" und „das Zone-Label kann weg"): graublaue Rasenfläche auf hellem Grund, kräftige grüne
 * Grenzlinie, Mäher als Draufsicht in seiner Fahrtrichtung, Station.
 * Der Umriss kommt aus der Spur (features/rasenUmriss.ts); alles ist EIN SVG in Weltkoordinaten (y gespiegelt),
 * deshalb sitzen Station und Mäher bei jeder Größe richtig.
 *
 * Ohne brauchbare Spur bleibt das PNG des Adapters mit den bisherigen Overlays (Prozent-Positionen):
 *   STATION: eigene Ikone, weil der eingebrannte Marker (#2b2b2b) im Dark-Mode unsichtbar ist.
 *   MÄHER:   die LIVE-Position aus postureX/Y.
 */
import { computed } from "vue";
import { kartenPosition } from "../../features/navimow";
import type { KartenFrame, Punkt } from "../../features/navimow";
import type { Punkt2 } from "../../features/rasenUmriss";
import { isDark } from "../../lib/theme";

const props = withDefaults(
  defineProps<{
    bild: string | null;
    frame: KartenFrame | null;
    station: Punkt | null;
    /** null = ausgeblendet (in der Station, Position unbrauchbar, Adapter getrennt) */
    maeher: (Punkt & { klasse: string }) | null;
    /** Der Rasen als Umriss — null: das PNG des Adapters zeigen */
    rasen?: Punkt2[] | null;
    /** Fahrtrichtung des Mähers in Radiant (0 = +x, gegen den Uhrzeigersinn) */
    winkel?: number;
    /** Der Browser konnte das letzte Bild nicht dekodieren. */
    bildDefekt?: boolean;
    maxHoeheKlasse?: string;
  }>(),
  { rasen: null, winkel: 0, bildDefekt: false, maxHoeheKlasse: "max-h-64" },
);

const emit = defineEmits<{ (e: "bildfehler"): void; (e: "tipp"): void }>();

// ───────── Stil der App ─────────

const farben = computed(() => (isDark.value
  ? { grund: "#2a3038", gitter: "rgba(255,255,255,0.05)", flaeche: "#3b4450", rand: "#5fcf9f" }
  : { grund: "#c9d0d8", gitter: "rgba(255,255,255,0.35)", flaeche: "#aeb7c2", rand: "#4fbf8f" }));

/** Ausschnitt: Rasen, Station und Mäher mit 1,5 m Rand; y gespiegelt (oben = Norden) */
const ansicht = computed(() => {
  const r = props.rasen;
  if (!r || r.length < 3) return null;
  const xs = r.map((p) => p[0]), ys = r.map((p) => -p[1]);
  for (const p of [props.station, props.maeher]) if (p) { xs.push(p.x); ys.push(-p.y); }
  const rand = 1.5;
  const x0 = Math.min(...xs) - rand, x1 = Math.max(...xs) + rand, y0 = Math.min(...ys) - rand, y1 = Math.max(...ys) + rand;
  return { x0, y0, b: x1 - x0, h: y1 - y0 };
});

const pfad = computed(() => (props.rasen ?? []).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${(-y).toFixed(2)}`).join("") + "Z");

/** Gitter alle 2 m, ganz zart wie der Kartenhintergrund der App */
const gitter = computed(() => {
  const v = ansicht.value;
  if (!v) return [] as { x1: number; y1: number; x2: number; y2: number }[];
  const l: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = Math.ceil(v.x0 / 2) * 2; x < v.x0 + v.b; x += 2) l.push({ x1: x, y1: v.y0, x2: x, y2: v.y0 + v.h });
  for (let y = Math.ceil(v.y0 / 2) * 2; y < v.y0 + v.h; y += 2) l.push({ x1: v.x0, y1: y, x2: v.x0 + v.b, y2: y });
  return l;
});

/** Größen in Weltmetern, aber an der Kartenbreite bemessen — sonst wäre der Mäher auf großen Rasen ein Punkt */
const masse = computed(() => {
  const b = ansicht.value?.b ?? 30;
  return { maeher: b * 0.085, station: b * 0.036, rand: b * 0.013 };
});

/** SVG dreht im Uhrzeigersinn, mit gespiegelter y-Achse: Figur „zeigt nach oben" = Richtung +y = θ π/2 */
const maeherDrehung = computed(() => 90 - (props.winkel * 180) / Math.PI);

// ───────── Rückfall: PNG des Adapters ─────────

function prozent(p: Punkt | null) {
  if (!props.frame || !p) return null;
  const pos = kartenPosition(props.frame, p.x, p.y);
  // Außerhalb des Rahmens nicht zeichnen -- ein Punkt am Bildrand wäre eine Lüge.
  if (pos.leftProzent < 0 || pos.leftProzent > 100 || pos.topProzent < 0 || pos.topProzent > 100) return null;
  return { left: `${pos.leftProzent}%`, top: `${pos.topProzent}%` };
}

const stationStil = computed(() => prozent(props.station));
const maeherStil = computed(() => prozent(props.maeher));
const zeigeBild = computed(() => !!props.bild && !props.bildDefekt);
</script>

<template>
  <!-- Stil der App: ein SVG aus dem Umriss -->
  <div v-if="ansicht" data-test="karte-vektor" class="rounded-xl overflow-hidden flex justify-center"
    :style="{ backgroundColor: farben.grund }" @click="emit('tipp')">
    <svg :viewBox="`${ansicht.x0} ${ansicht.y0} ${ansicht.b} ${ansicht.h}`" class="block w-full" :class="maxHoeheKlasse"
      preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mähkarte">
      <rect :x="ansicht.x0" :y="ansicht.y0" :width="ansicht.b" :height="ansicht.h" :fill="farben.grund" />
      <line v-for="(g, i) in gitter" :key="i" v-bind="g" :stroke="farben.gitter" stroke-width="0.05" />
      <!-- Rasen: Fläche, darüber die kräftige grüne Grenze -->
      <path :d="pfad" :fill="farben.flaeche" fill-opacity="0.75" />
      <path :d="pfad" fill="none" :stroke="farben.rand" :stroke-width="masse.rand" stroke-linejoin="round" data-test="rasen-rand" />
      <!-- Station: weißer Kreis mit Haus -->
      <g v-if="station" data-test="overlay-station" :transform="`translate(${station.x} ${-station.y})`">
        <circle :r="masse.station" fill="#ffffff" stroke="rgba(0,0,0,0.15)" :stroke-width="masse.station * 0.08" />
        <path :transform="`scale(${masse.station / 12})`" d="M0,-6.5 L7,0 L5,0 L5,6 L-5,6 L-5,0 L-7,0 Z" fill="#4a5361" />
      </g>
      <!-- Mäher: Draufsicht wie in der App, gedreht in Fahrtrichtung; der Ring trägt die Zustandsfarbe -->
      <g v-if="maeher" data-test="overlay-maeher" :class="maeher.klasse"
        :transform="`translate(${maeher.x} ${-maeher.y}) rotate(${maeherDrehung}) scale(${masse.maeher / 24})`">
        <circle r="15" fill="currentColor" opacity="0.28" />
        <ellipse cx="0" cy="2" rx="9.5" ry="11" fill="rgba(0,0,0,0.25)" />
        <rect x="-8.5" y="-11" width="17" height="21" rx="6" fill="#4b5563" stroke="#cfd6df" stroke-width="1.3" />
        <rect x="-9.8" y="-4" width="2" height="6" rx="1" fill="#f08a3c" />
        <rect x="7.8" y="-4" width="2" height="6" rx="1" fill="#f08a3c" />
        <circle cx="0" cy="-3.5" r="4.2" fill="#e5e9ee" />
        <circle cx="0" cy="-3.5" r="2.3" fill="#4b5563" />
        <rect x="-2" y="5" width="4" height="2" rx="1" fill="#e5e9ee" />
      </g>
    </svg>
  </div>

  <!-- Rückfall ohne Spur: das PNG des Adapters mit Overlays -->
  <div v-else class="flex justify-center rounded-xl bg-white/70 dark:bg-gray-900/40 p-1" @click="emit('tipp')">
    <div class="relative inline-block" :class="zeigeBild ? '' : 'w-full'">
      <img
        v-if="zeigeBild"
        :src="bild!"
        alt="Mähkarte"
        class="block w-auto max-w-full"
        :class="maxHoeheKlasse"
        @error="emit('bildfehler')"
      />
      <!-- Platzhalter in gleicher Höhe, damit die Kacheln darunter nicht springen -->
      <div
        v-else
        data-test="karte-platzhalter"
        class="h-64 w-full rounded-xl bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm text-center px-4"
      >
        <i aria-hidden="true" class="mdi mdi-map-outline text-5xl"></i>
        <span>{{ bildDefekt ? "Karte konnte nicht geladen werden" : "Noch keine Karte – sie entsteht bei der nächsten Mähfahrt" }}</span>
      </div>

      <!-- Station: dieselbe Ikone wie Zustand „in der Station" und Taste „Zur Station" -->
      <div
        v-if="stationStil"
        data-test="overlay-station"
        class="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[22px] h-[22px] rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow text-gray-700 dark:text-gray-100"
        :style="stationStil"
      >
        <i aria-hidden="true" class="mdi mdi-home-import-outline text-base leading-none"></i>
      </div>

      <!-- Mäher: live aus postureX/Y, Farbe nach Zustand (Klasse kommt vom Elternteil) -->
      <i aria-hidden="true"
        v-if="maeherStil && maeher"
        data-test="overlay-maeher"
        class="mdi mdi-robot-mower absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[22px] leading-none drop-shadow"
        :class="maeher.klasse"
        :style="maeherStil"
      ></i>
    </div>
  </div>
</template>
