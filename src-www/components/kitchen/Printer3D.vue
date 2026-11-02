<script setup lang="ts">
import { computed } from "vue";
import { rawConfig } from "../../lib/store";
import { ref } from "vue";
import { printer_3d } from "../../features/printer3d";

// Ein MJPEG-<img> meldet sich nie wieder, wenn der Stream abreißt — es bleibt einfach
// das letzte Bild stehen. Bei einem Fehler zeigen wir das an und versuchen es mit
// frischer URL (Cache-Buster) alle 15 s neu, solange die Kachel sichtbar ist.
/** MJPEG stream of the printer camera from the settings (printerWebcamUrl); empty: no picture */
const WEBCAM_URL = computed(() => rawConfig.value.printerWebcamUrl ?? "");
const kameraGestoert = ref(false);
const streamUrl = ref(WEBCAM_URL.value);
let neuversuch: ReturnType<typeof setTimeout> | null = null;

function kameraFehler() {
  kameraGestoert.value = true;
  if (neuversuch) clearTimeout(neuversuch);
  neuversuch = setTimeout(() => {
    streamUrl.value = WEBCAM_URL.value + (WEBCAM_URL.value.includes("?") ? "&" : "?") + "neu=" + Date.now();
  }, 15000);
}

function kameraLaeuft() {
  kameraGestoert.value = false;
}

function secToHHMM(sec:any) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

</script>
<template>
  <card v-if="printer_3d.connected">
    <template #title>3D Drucker</template>
    <template #content>
      <div class="flex justify-center items-center w-full">
        <div class="w-full max-w-xl aspect-[6/4] overflow-hidden">
          <img :src="streamUrl" @error="kameraFehler" @load="kameraLaeuft" />
          <div v-if="kameraGestoert" class="text-center text-sm mt-1">
            📷 Kamerabild nicht erreichbar — versuche es gleich wieder …
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="font-bold" style="overflow-wrap: anywhere;">
        <i :class="[
          'mdi',
          'mdi-timer-sand',
          { 'is-printing': printer_3d?.printing }
        ]" style="font-size: 1.2rem;"></i>
        {{ printer_3d.printjob_name }}
      </div>
      <ProgressBar :value="Number.isFinite(+printer_3d.completion) ? +printer_3d.completion : 0"></ProgressBar>
      <div class="w-full flex mt-3">
        <div class="flex-1">Druckzeit: {{ secToHHMM(printer_3d.printtime) }}</div>
        <div class="flex-shrink">verbleibend: {{ printer_3d.printtime_left == 0 ? " - " :
          secToHHMM(printer_3d.printtime_left) }}</div>
      </div>
      
    </template>
  </card>
  <card v-else>
    <template #title>3D Drucker</template>
    <template #content>
      <div class="m-4 text-center font-light">Drucker ist ausgeschaltet!</div>
    </template>
  </card>
</template>
<style lang="css" scoped>
.is-printing {
  animation: printPulse 2s ease-in-out infinite;
}

@keyframes printPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.08);
    opacity: .3  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
