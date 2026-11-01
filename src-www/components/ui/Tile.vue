<script setup lang="ts">
/** The frame every tile shares: card, title (with an optional small addition) and an optional action on the right. */
defineProps<{ title?: string; small?: string }>();
</script>

<template>
  <section class="card tile">
    <header v-if="title || $slots.action || $slots.title" class="card-head">
      <h2 class="card-title">
        <slot name="title">{{ title }} <small v-if="small" class="font-light text-base">{{ small }}</small></slot>
      </h2>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>
