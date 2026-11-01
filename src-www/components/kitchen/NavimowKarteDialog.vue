<script setup lang="ts">
/**
 * NavimowKarteDialog.vue -- die Mähkarte groß, per Tipp auf die kleine Karte.
 * Muster WeatherDetailsDialog (defineModel "visible"). Zeigt DIESELBE shallowRef wie die
 * Kachel -- kein zweiter Abruf, keine Kopie des 128-KB-Strings.
 */
import Dialog from "../../compat/primevue/Dialog.vue";
import NavimowKarte from "./NavimowKarte.vue";
import type { KartenFrame, Punkt } from "../../features/navimow";
import type { Punkt2 } from "../../features/rasenUmriss";

defineProps<{
  bild: string | null;
  frame: KartenFrame | null;
  station: Punkt | null;
  maeher: (Punkt & { klasse: string }) | null;
  bildDefekt: boolean;
  fusszeile: string;
  rasen?: Punkt2[] | null;
  winkel?: number;
}>();

const visible = defineModel<boolean>("visible", { default: false });
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Mähkarte" :style="{ width: '40rem', maxWidth: '95vw' }">
    <NavimowKarte
      :bild="bild"
      :frame="frame"
      :station="station"
      :maeher="maeher"
      :bild-defekt="bildDefekt"
      :rasen="rasen"
      :winkel="winkel"
      max-hoehe-klasse="max-h-[70vh]"
    />
    <div class="text-right text-xs text-gray-400 dark:text-gray-500 mt-2">{{ fusszeile }}</div>
  </Dialog>
</template>
