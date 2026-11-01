<script setup lang="ts">
/** PrimeVue's Button with the props the kitchen tiles use: label, icon, severity, text, outlined, rounded, size. */
withDefaults(defineProps<{
  label?: string; icon?: string; severity?: string; text?: boolean; outlined?: boolean; rounded?: boolean;
  size?: "small" | "large"; disabled?: boolean; loading?: boolean; iconPos?: string;
}>(), { label: "", icon: "", severity: "", size: undefined });
</script>

<template>
  <button type="button" class="pv-btn" :disabled="disabled || loading"
    :class="[severity ? `pv-${severity}` : 'pv-primary', { 'pv-text': text, 'pv-outlined': outlined, 'pv-rounded': rounded, 'pv-small': size === 'small', 'pv-large': size === 'large', 'pv-icon-only': !label && !$slots.default }]">
    <i v-if="loading" class="mdi mdi-loading mdi-spin" aria-hidden="true"></i>
    <i v-else-if="icon" :class="icon" aria-hidden="true"></i>
    <span v-if="label">{{ label }}</span>
    <slot />
  </button>
</template>
