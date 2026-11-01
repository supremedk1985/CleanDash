<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import HouseTile from "./components/HouseTile.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import NoticeBar from "./components/NoticeBar.vue";
import { config, connected, demo, errorText, lastContact, loading, start } from "./lib/store";
import { clock, t } from "./lib/i18n";

const now = ref(new Date());
let timer: number | undefined;
onMounted(() => {
  void start();
  timer = window.setInterval(() => (now.value = new Date()), 15_000);
});
onUnmounted(() => clearInterval(timer));

const empty = () => !config.value || (!config.value.rooms.length && !config.value.lamps.length);
</script>

<template>
  <div v-if="!connected" class="banner alert" role="status">
    {{ t("offline") }}<template v-if="lastContact">, {{ t("offlineSince", { time: clock(lastContact) }) }}</template>
  </div>
  <div v-if="demo" class="banner info" role="status">{{ t("demo") }}</div>
  <div v-if="errorText" class="banner alert" role="alert">{{ errorText }}</div>

  <main class="page">
    <header class="page-head">
      <h1 v-if="config?.title" class="page-title">{{ config.title }}</h1>
      <span class="clock">{{ clock(now) }}</span>
    </header>

    <NoticeBar />

    <p v-if="loading" class="muted">{{ t("connecting") }}</p>
    <section v-else-if="empty()" class="card empty">
      <h2 class="card-title">{{ t("noConfig") }}</h2>
      <p class="muted">{{ t("noConfigHint") }}</p>
    </section>
    <div v-else class="grid">
      <HouseTile />
    </div>
  </main>

  <ConfirmDialog />
</template>
