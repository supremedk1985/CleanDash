<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Chart, type ChartConfiguration } from "chart.js/auto";

const props = defineProps<{ config: ChartConfiguration }>();

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!canvas.value) return;
  chart = new Chart(canvas.value, props.config);

  // Wenn das Canvas beim Erstellen unsichtbar ist (z.B. in einem noch nicht
  // aktiven Tab), rendert Chart.js mit Größe 0 und holt das später nicht
  // zuverlässig von selbst nach. Der ResizeObserver erzwingt ein resize(),
  // sobald der Container tatsächlich eine Größe bekommt.
  resizeObserver = new ResizeObserver(() => chart?.resize());
  if (canvas.value.parentElement) resizeObserver.observe(canvas.value.parentElement);
});

watch(
  () => props.config,
  (config) => {
    if (!chart) return;
    chart.data = config.data;
    chart.options = config.options ?? chart.options;
    chart.update();
  },
  { deep: true }
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  chart?.destroy();
});
</script>

<template>
  <canvas ref="canvas"></canvas>
</template>
