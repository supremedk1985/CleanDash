<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import HouseTile from "./components/HouseTile.vue";
import WeatherTile from "./components/WeatherTile.vue";
import EnergyTile from "./components/EnergyTile.vue";
import TrashTile from "./components/TrashTile.vue";
import DishwasherTile from "./components/DishwasherTile.vue";
import ShoppingTile from "./components/ShoppingTile.vue";
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

const empty = () => {
  const c = config.value;
  return !c || (!c.rooms.length && !c.lamps.length && !c.weather && !c.energy && !c.trash && !c.dishwasher && !c.shoppingLists.length);
};
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
    <!-- Three columns like the kitchen dashboard (4 : 3 : 2), one column on phones -->
    <div v-else class="columns">
      <div class="col">
        <EnergyTile v-if="config?.energy" />
        <WeatherTile v-if="config?.weather" />
        <HouseTile v-if="config?.rooms.length || config?.lamps.length" />
      </div>
      <div class="col">
        <TrashTile v-if="config?.trash" />
        <ShoppingTile />
      </div>
      <div class="col">
        <DishwasherTile v-if="config?.dishwasher" />
      </div>
    </div>
  </main>

  <ConfirmDialog />
</template>
