<script setup lang="ts">
/** A dialog over the page. Closes on the backdrop, on Escape, with the X, and after a few idle minutes. */
import { mdiClose } from "@mdi/js";
import Icon from "../Icon.vue";
import { beiRuhe } from "../../lib/idle";
import { t } from "../../lib/i18n";

const visible = defineModel<boolean>("visible", { default: false });
defineProps<{ title?: string; width?: string }>();
beiRuhe(() => (visible.value = false));
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="visible = false" @keydown.esc="visible = false">
    <div class="dialog" role="dialog" aria-modal="true" :style="width ? { width: `min(${width}, 100%)` } : undefined">
      <header class="dialog-head">
        <h2 class="dialog-title">{{ title }}</h2>
        <button type="button" class="icon-btn" :aria-label="t('close')" @click="visible = false"><Icon :path="mdiClose" /></button>
      </header>
      <slot />
    </div>
  </div>
</template>
