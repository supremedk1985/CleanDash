<script setup lang="ts">
/**
 * Kleine Kachel „Luftentfeuchter" (15.10.2026): Schalter, was er gerade tut, Verbrauch heute, seit wann an/aus,
 * darunter die Leistung der letzten 24 Stunden als Balken (eine Säule je Stunde, ohne Achse — wie beim Internet).
 * Antippen öffnet den Verlauf mit Diagramm und allen Schaltzeiten.
 */
import { computed, ref } from "vue";
import Schalter from "./Schalter.vue";
import LuftentfeuchterDialog from "./LuftentfeuchterDialog.vue";
import { dauerText, kwhText, laufzeit, luftentfeuchter, schalten, seit, stundenmittel, uhr, zustand } from "../../features/luftentfeuchter";

const offen = ref(false);
const fehler = ref(false);
const l = luftentfeuchter;

const z = computed(() => zustand(l.value));
const jetzt = computed(() => (l.value, Date.now())); // bei jedem Abruf neu (l.value wird je Abruf ersetzt)
const mitternacht = computed(() => { const d = new Date(jetzt.value); d.setHours(0, 0, 0, 0); return d.getTime(); });
const lief = computed(() => laufzeit(l.value.leistung24, mitternacht.value, jetzt.value));
const seitWann = computed(() => seit(l.value.schalter24, l.value.an, jetzt.value));
const balken = computed(() => stundenmittel(l.value.leistung24, jetzt.value));
const spitze = computed(() => Math.max(60, ...balken.value));

const text = computed(() => ({
  "läuft": `läuft · ${Math.round(l.value.leistung)} W`,
  "bereit": `an, entfeuchtet gerade nicht · ${Math.round(l.value.leistung)} W`,
  "aus": "aus",
  "weg": "Steckdose antwortet nicht",
}[z.value]));

async function umschalten(an: boolean) {
  fehler.value = !(await schalten(an));
}
</script>

<template>
  <!-- EIN Wurzelelement: sonst kommt class="mt-4" aus dem Dashboard nicht an (Kachel klebte an „Tanken", 16.10.) -->
  <div>
  <card data-test="luftentfeuchter" class="cursor-pointer" @click="offen = true">
    <template #title>
      <div class="flex items-center gap-2">
        <span class="mdi mdi-air-humidifier" :class="z === 'läuft' ? 'text-sky-500' : 'text-gray-400'"></span>
        <span class="flex-1">Luftentfeuchter</span>
        <Schalter :an="l.an" :label="l.an ? 'Luftentfeuchter ausschalten' : 'Luftentfeuchter einschalten'" gross
          :gesperrt="z === 'weg'" data-test="luftentfeuchter-schalter" @umschalten="umschalten" />
      </div>
    </template>
    <template #content>
      <div class="text-lg font-semibold"
           :class="{ 'text-sky-600 dark:text-sky-400': z === 'läuft', 'text-red-600 dark:text-red-400': z === 'weg' }"
           data-test="luftentfeuchter-zustand">{{ text }}</div>
      <div class="text-sm text-gray-500 dark:text-gray-400" data-test="luftentfeuchter-zeile">
        heute {{ kwhText(l.heute) }}<span v-if="lief > 0"> · lief {{ dauerText(lief) }}</span><span
          v-if="seitWann"> · {{ l.an ? 'an' : 'aus' }} seit {{ uhr(seitWann) }}</span>
      </div>
      <div v-if="fehler" class="text-sm text-red-600 dark:text-red-400 mt-1">Schalten hat nicht geklappt.</div>
      <div v-if="l.leistung24.length" class="flex items-end gap-px h-8 mt-2" data-test="luftentfeuchter-balken">
        <div v-for="(w, i) in balken" :key="i" class="flex-1 rounded-t"
             :class="w >= 1 ? 'bg-sky-500/70 dark:bg-sky-400/60' : 'bg-gray-200 dark:bg-gray-700'"
             :style="{ height: Math.max(6, (w / spitze) * 100) + '%' }"></div>
      </div>
    </template>
  </card>
  <LuftentfeuchterDialog v-model:visible="offen" />
  </div>
</template>
