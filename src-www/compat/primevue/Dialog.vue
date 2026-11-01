<script setup lang="ts">
/** PrimeVue's Dialog: v-model:visible, header (or #header slot), closes on the backdrop and Escape. */
defineOptions({ inheritAttrs: false });
const visible = defineModel<boolean>("visible", { default: false });
// Vue turns a missing boolean prop into false; PrimeVue's defaults are true, so they are set here.
withDefaults(defineProps<{ header?: string; modal?: boolean; showHeader?: boolean; dismissableMask?: boolean; closable?: boolean; contentStyle?: unknown; draggable?: boolean }>(), {
  showHeader: true, closable: true, modal: true, dismissableMask: false, draggable: false,
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay pv-overlay" @click.self="visible = false" @keydown.esc="visible = false">
      <div class="dialog pv-dialog" role="dialog" aria-modal="true" v-bind="$attrs">
        <header v-if="showHeader !== false" class="dialog-head">
          <h2 class="dialog-title"><slot name="header">{{ header }}</slot></h2>
          <button v-if="closable !== false" type="button" class="icon-btn" aria-label="Schließen" @click="visible = false">
            <i class="mdi mdi-close text-xl" aria-hidden="true"></i>
          </button>
        </header>
        <div :style="(contentStyle as any)"><slot /></div>
        <div v-if="$slots.footer" class="actions"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
