<script setup lang="ts">
/** The one question every writing action passes through (see store.ask). */
import { nextTick, ref, watch } from "vue";
import { answer, question } from "../lib/store";
import { t } from "../lib/i18n";

const yesButton = ref<HTMLButtonElement | null>(null);
watch(question, async (q) => {
  if (q) {
    await nextTick();
    yesButton.value?.focus();
  }
});
</script>

<template>
  <div v-if="question" class="overlay" @click.self="answer(false)" @keydown.esc="answer(false)">
    <div class="dialog small" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" data-test="confirm">
      <h2 id="confirm-title" class="dialog-title">{{ question.text }}</h2>
      <p v-if="question.detail" class="muted">{{ question.detail }}</p>
      <div class="actions">
        <button type="button" class="btn ghost" data-test="confirm-no" @click="answer(false)">{{ t("no") }}</button>
        <button ref="yesButton" type="button" class="btn primary" data-test="confirm-yes" @click="answer(true)">{{ t("yes") }}</button>
      </div>
    </div>
  </div>
</template>
