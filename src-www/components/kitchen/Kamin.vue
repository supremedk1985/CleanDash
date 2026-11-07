<script setup lang="ts">
/**
 * Fireplace tile: the pixel campfire (strength from the device), flue temperature, state, peak and the point where it
 * asks for wood. Only shown while the fire burns (see features/kamin.ts). 8 frames per second like the device's app.
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { kamin } from "../../features/kamin";
import { Lagerfeuer } from "../../lib/lagerfeuer";
import { t } from "../../lib/i18n";

const k = kamin;
const leinwand = ref<HTMLCanvasElement | null>(null);
const feuer = new Lagerfeuer();
const start = performance.now();
let takt: number | undefined;
let kraft = 0;  // eased towards the measured value so the fire does not jump

function grad(v: number | undefined) { return v === undefined ? "–" : `${Math.round(v)} °C`; }
const nachlegen = computed(() => k.value?.zustand === "nachlegen");

function malen() {
  const c = leinwand.value?.getContext("2d");
  if (!c) return;
  const ziel = Math.min(1, Math.max(0, k.value?.kraft ?? 0));
  kraft += (ziel - kraft) * 0.1;
  const zeit = (performance.now() - start) / 1000;
  feuer.malen(kraft, zeit);
  for (let i = 0; i < 32 * 32; i++) {
    c.fillStyle = Lagerfeuer.farbe(feuer.e[i], i, kraft, zeit);
    c.fillRect(i % 32, i >> 5, 1, 1);
  }
}
onMounted(() => { kraft = k.value?.kraft ?? 0; malen(); takt = window.setInterval(malen, 125); });
onUnmounted(() => clearInterval(takt));
watch(leinwand, malen);
</script>

<template>
  <div>
  <card data-test="kamin" :class="nachlegen ? 'ring-2 ring-orange-500' : ''">
    <template #title>
      <div class="flex items-center gap-2">
        <span class="mdi mdi-fireplace" :class="nachlegen ? 'text-orange-500' : 'text-amber-500'"></span>
        <span class="flex-1">{{ t("tileStove") }}</span>
      </div>
    </template>
    <template #content>
      <div class="flex items-center gap-4">
        <canvas ref="leinwand" width="32" height="32" class="kamin-feuer rounded-lg shrink-0" aria-hidden="true"></canvas>
        <div class="min-w-0">
          <div class="text-4xl font-bold tabular-nums" data-test="kamin-temperatur">{{ grad(k?.temperatur) }}</div>
          <div class="inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-semibold text-white"
               :class="nachlegen ? 'bg-orange-600' : 'bg-amber-500'" data-test="kamin-zustand">
            {{ nachlegen ? t("stoveAddWood") : t("stoveBurning") }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {{ t("stovePeak") }} {{ grad(k?.hoechst) }}<span v-if="k?.schwelle !== undefined"> · {{ t("stoveAlertBelow") }} {{ grad(k?.schwelle) }}</span>
          </div>
          <div v-if="k?.modul !== undefined" class="text-sm text-gray-500 dark:text-gray-400">{{ t("stoveModule") }} {{ grad(k?.modul) }}</div>
        </div>
      </div>
    </template>
  </card>
  </div>
</template>

<style scoped>
.kamin-feuer { width: 7.5rem; height: 7.5rem; image-rendering: pixelated; }
</style>
