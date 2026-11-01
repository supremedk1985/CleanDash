<script setup lang="ts">
/** A Home Connect dishwasher: state, while running the time left, the end time and the progress. */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { mdiAlertOutline, mdiCheckCircleOutline, mdiCloudOffOutline, mdiDishwasher, mdiPowerPlugOffOutline, mdiTimerSandComplete } from "@mdi/js";
import Icon from "./Icon.vue";
import { config, values } from "../lib/store";
import { dishwasherIds } from "../lib/config";
import { hhmm, machine } from "../lib/tiles";
import { clock, t, type Key } from "../lib/i18n";

const m = computed(() => (config.value?.dishwasher ? machine(values, dishwasherIds(config.value.dishwasher)) : null));

// the end time moves with the clock, so it is computed from "now"
const now = ref(Date.now());
let timer: number | undefined;
onMounted(() => (timer = window.setInterval(() => (now.value = Date.now()), 30_000)));
onUnmounted(() => clearInterval(timer));

const LABEL: Record<string, Key> = {
  running: "dwRunning", delayed: "dwDelayed", ready: "dwReady", finished: "dwFinished",
  paused: "dwPaused", error: "dwError", off: "dwOff", unknown: "dwUnknown",
};
const icon = computed(() => {
  const s = m.value?.state;
  return s === "running" ? mdiDishwasher : s === "delayed" ? mdiTimerSandComplete : s === "finished" || s === "ready" ? mdiCheckCircleOutline
    : s === "paused" || s === "error" ? mdiAlertOutline : mdiPowerPlugOffOutline;
});
</script>

<template>
  <section v-if="m" class="card" data-test="dishwasher">
    <header class="card-head"><h2 class="card-title">{{ t("dishwasher") }}</h2></header>
    <div class="machine" :class="m.state">
      <Icon :path="icon" :size="40" />
      <span class="grow">
        <span class="block strong">{{ t(LABEL[m.state]) }}</span>
        <span v-if="m.state === 'running' && m.remaining !== null" class="block muted">
          {{ t("dwLeft", { time: hhmm(m.remaining) }) }} · {{ t("dwEnds", { time: clock(new Date(now + m.remaining * 1000)) }) }}
        </span>
      </span>
      <span v-if="m.state === 'running' && m.progress !== null" class="percent">{{ Math.round(m.progress) }} %</span>
    </div>
    <span v-if="m.state === 'running' && m.progress !== null" class="bar thick"><span :style="{ width: `${m.progress}%` }"></span></span>
    <p v-if="!m.connected" class="offline small"><Icon :path="mdiCloudOffOutline" :size="18" />{{ t("dwOffline") }}</p>
  </section>
</template>
