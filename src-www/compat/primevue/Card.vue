<script setup lang="ts">
/** PrimeVue's Card as the kitchen tiles use it (slots title, content, footer), drawn in CleanDash's tile style. */
</script>

<template>
  <section class="card tile">
    <div v-if="$slots.title" class="card-title pv-card-title"><slot name="title" /></div>
    <div v-if="$slots.subtitle" class="muted small"><slot name="subtitle" /></div>
    <div class="pv-card-content"><slot name="content" /><slot /></div>
    <div v-if="$slots.footer" class="pv-card-footer"><slot name="footer" /></div>
  </section>
</template>
