<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import HouseTile from "./components/HouseTile.vue";
import WeatherTile from "./components/WeatherTile.vue";
import EnergyTile from "./components/EnergyTile.vue";
import TrashTile from "./components/TrashTile.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import NoticeBar from "./components/NoticeBar.vue";
// tiles of the kitchen dashboard, taken over with their full range of functions
import Aufgaben from "./components/kitchen/Aufgaben.vue";
import Navimow from "./components/kitchen/Navimow.vue";
import ShoppingList from "./components/kitchen/ShoppingList.vue";
import Printer3D from "./components/kitchen/Printer3D.vue";
import Fuel from "./components/kitchen/Fuel.vue";
import Luftentfeuchter from "./components/kitchen/Luftentfeuchter.vue";
import Roborock from "./components/kitchen/Roborock.vue";
import Call2ComeDown from "./components/kitchen/Call2ComeDown.vue";
import Fundus from "./components/kitchen/Fundus.vue";
import Dishwasher from "./components/kitchen/Dishwasher.vue";
import Paperless from "./components/kitchen/Paperless.vue";
import Speedtest from "./components/kitchen/Speedtest.vue";
import SettingsPanel from "./components/kitchen/Config.vue";
import { config, connected, demo, errorText, lastContact, loading, onConfig, rawConfig, start } from "./lib/store";
import { clock, t } from "./lib/i18n";
import { startPolling } from "./compat/engine";
import type { FeatureModule } from "./compat/registry";
import { aufgabenFeature } from "./features/aufgaben";
import { bringFeature, setBringLists } from "./features/bring";
import { dishwasherFeature } from "./features/dishwasher";
import { fuelFeature } from "./features/fuel";
import { luftentfeuchterFeature } from "./features/luftentfeuchter";
import { navimowFeature } from "./features/navimow";
import { paperlessFeature } from "./features/paperless";
import { printer3dFeature, printer_3d } from "./features/printer3d";
import { roborockFeature } from "./features/roborock";
import { speedtestFeature } from "./features/speedtest";

const now = ref(new Date());
let timer: number | undefined;
onConfig.push((r) => {
  setBringLists(r.shoppingLists);
  const on: [unknown, FeatureModule][] = [
    [r.aufgabenUrl, aufgabenFeature], [r.shoppingLists?.length, bringFeature], [r.dishwasherDevice, dishwasherFeature],
    [r.fuelInstance, fuelFeature], [r.dehumidifierDevice, luftentfeuchterFeature], [r.mowerDevice, navimowFeature],
    [r.paperlessCount, paperlessFeature], [r.printerInstance, printer3dFeature], [r.vacuumDevice, roborockFeature],
    [r.speedtestUrl, speedtestFeature],
  ];
  startPolling(on.filter(([set]) => !!set).map(([, m]) => m));
});
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 15_000);
  void start();
});
onUnmounted(() => clearInterval(timer));

const r = computed(() => rawConfig.value);
/** A running print moves the printer up to second place in the middle column (as on the kitchen dashboard). */
const printing = computed(() => printer_3d.value.printing && printer_3d.value.connected);

const empty = () => {
  const c = config.value;
  return !c || (!c.rooms.length && !c.lamps.length && !c.weather && !c.energy && !c.trash && !c.dishwasher && !c.shoppingLists.length
    && !r.value.aufgabenUrl && !r.value.mowerDevice && !r.value.vacuumDevice && !r.value.fuelInstance);
};
</script>

<template>
  <div v-if="!connected" class="banner alert" role="status">
    {{ t("offline") }}<template v-if="lastContact">, {{ t("offlineSince", { time: clock(lastContact) }) }}</template>
  </div>
  <div v-if="demo" class="banner info" role="status">{{ t("demo") }}</div>
  <div v-if="errorText" class="banner alert" role="alert">{{ errorText }}</div>

  <main class="page">
    <header v-if="config?.title" class="page-head">
      <h1 class="page-title">{{ config.title }}</h1>
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
        <Printer3D v-if="r.printerInstance && printing" data-test="drucker-oben" />
        <Aufgaben v-if="r.aufgabenUrl" />
        <Navimow v-if="r.mowerDevice" />
        <ShoppingList v-if="r.shoppingLists?.length" />
        <Printer3D v-if="r.printerInstance && !printing" data-test="drucker-unten" />
      </div>
      <div class="col">
        <Fuel v-if="r.fuelInstance" />
        <Luftentfeuchter v-if="r.dehumidifierDevice" />
        <Roborock v-if="r.vacuumDevice" />
        <Call2ComeDown v-if="r.callDatapoint" />
        <Fundus v-if="r.fundusUrl" />
        <Dishwasher v-if="r.dishwasherDevice" />
        <Paperless v-if="r.paperlessCount" />
        <Speedtest v-if="r.speedtestUrl" />
        <SettingsPanel v-if="r.showSettingsPanel !== false" />
      </div>
    </div>
  </main>

  <ConfirmDialog />
</template>
