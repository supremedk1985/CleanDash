<script setup lang="ts">
/** A read-only ring gauge (270° arc), like PrimeVue's Knob: track, then the value in its colour. */
import { computed } from "vue";
const props = withDefaults(defineProps<{ value: number; min?: number; max?: number; size?: number; color?: string; width?: number }>(), {
  min: 0, max: 100, size: 140, color: "var(--green)", width: 14,
});
const R = 40, C = 50, SWEEP = 270, START = 135;
function point(deg: number) {
  const r = (deg * Math.PI) / 180;
  return [C + R * Math.cos(r), C + R * Math.sin(r)];
}
function arc(from: number, to: number) {
  const [x1, y1] = point(from), [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
const share = computed(() => Math.max(0, Math.min(1, (props.value - props.min) / (props.max - props.min || 1))));
const track = arc(START, START + SWEEP);
const fill = computed(() => (share.value > 0.002 ? arc(START, START + SWEEP * share.value) : ""));
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true">
    <path :d="track" fill="none" stroke="var(--knob-track)" :stroke-width="width" />
    <path v-if="fill" :d="fill" fill="none" :stroke="color" :stroke-width="width" />
  </svg>
</template>
