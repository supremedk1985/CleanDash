<script setup lang="ts">
/** PrimeVue's ToggleButton: v-model with on/off label and icon. */
const model = defineModel<boolean>({ default: false });
defineProps<{ onLabel?: string; offLabel?: string; onIcon?: string; offIcon?: string; disabled?: boolean }>();
</script>

<template>
  <button type="button" class="pv-btn pv-toggle" :class="{ 'pv-toggle-on': model }" :aria-pressed="model" :disabled="disabled" @click="model = !model">
    <i v-if="model ? onIcon : offIcon" :class="model ? onIcon : offIcon" aria-hidden="true"></i>
    <span>{{ model ? onLabel : offLabel }}</span>
  </button>
</template>
