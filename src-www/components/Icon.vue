<script setup lang="ts">
/** An icon from Material Design Icons, drawn inline (no font, no request). */
defineProps<{ path: string; size?: number; label?: string }>();
</script>

<template>
  <svg class="icon" :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" :role="label ? 'img' : undefined"
    :aria-label="label" :aria-hidden="label ? undefined : 'true'">
    <path :d="path" fill="currentColor" />
  </svg>
</template>
