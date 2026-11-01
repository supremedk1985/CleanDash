<script setup lang="ts">
/**
 * Die Kachel zur Internetgeschwindigkeit.
 *
 * Drei Dinge soll man ohne Nachdenken sehen:
 *   1. Wie schnell es zuletzt war          -> die große Zahl
 *   2. Ob das normal ist                   -> Farbe, gemessen am eigenen Mittel
 *   3. Wann gemessen wurde                 -> Zeile darunter
 *
 * Der Balkenverlauf darunter zeigt die letzten Messungen. Er hat bewusst keine
 * Achse und keine Zahlen: Aus zwei Metern Entfernung liest niemand Zahlen, aber
 * jeder sieht, ob ein Balken deutlich kürzer ist als die anderen.
 */
import { computed } from "vue";
import { speedtest, bewertung } from "../../features/speedtest";

const zustand = computed(() => bewertung(speedtest.value));

const stand = computed(() =>
  speedtest.value.stand
    ? speedtest.value.stand.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null,
);

/** Höchster Wert im Verlauf -- die Balken werden daran skaliert. */
const spitze = computed(() =>
  Math.max(1, ...speedtest.value.verlauf.map((m) => m.runter)),
);

function uhrzeit(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <card>
    <template #title>
      Internet
      <small v-if="speedtest.mittelRunter">
        im Mittel {{ Math.round(speedtest.mittelRunter) }} Mbit/s
      </small>
    </template>
    <template #content>
      <div v-if="!speedtest.erreichbar || !speedtest.ok"
           class="mb-2 px-3 py-1 rounded-lg text-sm bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
           data-pruef="speedtest-fehler">
        Keine Messung vorhanden<span v-if="stand">, Stand {{ stand }} Uhr</span>
      </div>

      <template v-else>
        <div class="flex items-baseline gap-3" data-pruef="speedtest-werte">
          <div class="text-3xl font-semibold"
               :class="{
                 'text-emerald-600 dark:text-emerald-400': zustand === 'gut',
                 'text-amber-600 dark:text-amber-400': zustand === 'schwach',
                 'text-red-600 dark:text-red-400': zustand === 'schlecht',
               }"
               data-pruef="runter">{{ Math.round(speedtest.runter) }}</div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Mbit/s runter</div>
          <div class="flex-1"></div>
          <div class="text-sm text-gray-600 dark:text-gray-300" data-pruef="hoch">
            {{ Math.round(speedtest.hoch) }} hoch
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400" data-pruef="ping">
            {{ Math.round(speedtest.ping) }} ms
          </div>
        </div>

        <!-- Der Verlauf: ein Balken je Messung, ohne Achse und ohne Zahlen. -->
        <div v-if="speedtest.verlauf.length > 1"
             class="flex items-end gap-1 h-10 mt-3" data-pruef="verlauf">
          <div v-for="(m, i) in speedtest.verlauf" :key="i"
               class="flex-1 rounded-t bg-emerald-500/70 dark:bg-emerald-400/60"
               :style="{ height: Math.max(8, (m.runter / spitze) * 100) + '%' }"
               :title="uhrzeit(m.wann) + ': ' + Math.round(m.runter) + ' Mbit/s'"
               :data-runter="Math.round(m.runter)"></div>
        </div>

        <div class="pt-2 text-sm text-gray-500 dark:text-gray-400" data-pruef="speedtest-stand">
          <span v-if="stand">gemessen um {{ stand }} Uhr</span>
          <span v-if="speedtest.server"> · {{ speedtest.server.split(",")[0] }}</span>
        </div>
      </template>
    </template>
  </card>
</template>
