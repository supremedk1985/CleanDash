<script setup lang="ts">
/** PrimeVue's Slider on a native range input: update:modelValue while moving, slideend when let go. */
const props = withDefaults(defineProps<{ modelValue?: number; min?: number; max?: number; step?: number; disabled?: boolean }>(), { modelValue: 0, min: 0, max: 100, step: 1 });
const emit = defineEmits<{ (e: "update:modelValue", v: number): void; (e: "slideend", ev: { value: number }): void; (e: "change", v: number): void }>();
function input(e: Event) { emit("update:modelValue", Number((e.target as HTMLInputElement).value)); }
function change(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  emit("change", v);
  emit("slideend", { value: v });
}
void props;
</script>

<template>
  <input type="range" class="pv-slider" :min="min" :max="max" :step="step" :value="modelValue" :disabled="disabled" @input="input" @change="change" />
</template>
