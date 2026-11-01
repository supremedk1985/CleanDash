<script setup lang="ts">
/** PrimeVue's ProgressBar: a bar with the value in percent written on it (or the default slot). */
withDefaults(defineProps<{ value?: number; showValue?: boolean }>(), { value: 0, showValue: true });
</script>

<template>
  <div class="pv-progress" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="pv-progress-value" :style="{ width: `${Math.max(0, Math.min(100, value))}%` }">
      <span v-if="showValue && value >= 8" class="pv-progress-label"><slot>{{ Math.round(value) }}%</slot></span>
    </div>
  </div>
</template>
