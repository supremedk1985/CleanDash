<script setup lang="ts">
/** A real switch button (role="switch"); it only reports the wish, the caller decides whether to ask first. */
defineProps<{ on: boolean; label: string; large?: boolean; disabled?: boolean }>();
const emit = defineEmits<{ (e: "toggle", on: boolean): void }>();
</script>

<template>
  <button type="button" role="switch" class="onoff" :class="{ on, large }" :aria-checked="on" :aria-label="label"
    :disabled="disabled" @click.stop="emit('toggle', !on)">
    <span class="knob"></span>
  </button>
</template>
