<script setup lang="ts">
/** Kleiner Ein/Aus-Schalter (Kachel „Haus" und Raum-Fenster) — ein echter Knopf mit role="switch", grün wenn an. */
const props = withDefaults(defineProps<{ an: boolean; label: string; gross?: boolean; gesperrt?: boolean }>(), { gross: false, gesperrt: false });
const emit = defineEmits<{ (e: "umschalten", an: boolean): void }>();
</script>

<template>
  <button type="button" role="switch" :aria-checked="props.an" :aria-label="props.label" :disabled="props.gesperrt"
    class="shrink-0 rounded-full flex items-center transition-colors disabled:opacity-40"
    :class="[props.gross ? 'w-12 h-7 p-1' : 'w-10 h-6 p-0.5', props.an ? 'bg-green-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start']"
    @click.stop="emit('umschalten', !props.an)">
    <span class="rounded-full bg-white shadow" :class="props.gross ? 'w-5 h-5' : 'w-5 h-5'"></span>
  </button>
</template>
