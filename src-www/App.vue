<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from "vue";
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
import Kamin from "./components/kitchen/Kamin.vue";
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
import { kaminFeature, kaminSichtbar } from "./features/kamin";
import { printer3dFeature, printer_3d } from "./features/printer3d";
import { roborockFeature } from "./features/roborock";
import { speedtestFeature } from "./features/speedtest";
import { arrange, draft, finishMoving, moveRequested, moveTile, PINNED, resetDraft, savedLayout, startMoving, toggleHidden, type TileDef } from "./lib/layout";
import { beiRuhe } from "./lib/idle";

const now = ref(new Date());
let timer: number | undefined;
onConfig.push((r) => {
  setBringLists(r.shoppingLists);
  const on: [unknown, FeatureModule][] = [
    [r.aufgabenUrl, aufgabenFeature], [r.shoppingLists?.length, bringFeature], [r.dishwasherDevice, dishwasherFeature],
    [r.fuelInstance, fuelFeature], [r.dehumidifierDevice, luftentfeuchterFeature], [r.mowerDevice, navimowFeature],
    [r.paperlessCount, paperlessFeature], [r.printerInstance, printer3dFeature], [r.vacuumDevice, roborockFeature],
    [r.speedtestUrl, speedtestFeature], [r.stovePrefix, kaminFeature],
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

/** Every tile with its default column, in default order; `on` says whether it is set up. */
const tiles = computed(() => {
  const c = config.value;
  const x = r.value;
  const all: (TileDef & { on: boolean; comp: Component; name: string })[] = [
    { id: "energy", col: 0, on: !!c?.energy, comp: EnergyTile, name: t("tileEnergy") },
    { id: "weather", col: 0, on: !!c?.weather, comp: WeatherTile, name: t("tileWeather") },
    { id: "house", col: 0, on: !!(c?.rooms.length || c?.lamps.length), comp: HouseTile, name: t("house") },
    { id: "trash", col: 1, on: !!c?.trash, comp: TrashTile, name: t("binTicker") },
    // only while the fire burns (the tile comes and goes by itself)
    { id: "stove", col: 1, on: !!x.stovePrefix && kaminSichtbar.value, comp: Kamin, name: t("tileStove") },
    { id: "aufgaben", col: 1, on: !!x.aufgabenUrl, comp: Aufgaben, name: "MachIchGleich" },
    { id: "mower", col: 1, on: !!x.mowerDevice, comp: Navimow, name: t("tileMower") },
    { id: "shopping", col: 1, on: !!x.shoppingLists?.length, comp: ShoppingList, name: t("tileShopping") },
    { id: "printer", col: 1, on: !!x.printerInstance, comp: Printer3D, name: t("tilePrinter") },
    { id: "fuel", col: 2, on: !!x.fuelInstance, comp: Fuel, name: t("tileFuel") },
    { id: "dehumidifier", col: 2, on: !!x.dehumidifierDevice, comp: Luftentfeuchter, name: t("tileDehumidifier") },
    { id: "vacuum", col: 2, on: !!x.vacuumDevice, comp: Roborock, name: t("tileVacuum") },
    { id: "call", col: 2, on: !!x.callDatapoint, comp: Call2ComeDown, name: x.callLabel || t("tileCall") },
    { id: "fundus", col: 2, on: !!x.fundusUrl, comp: Fundus, name: "Fundus" },
    { id: "dishwasher", col: 2, on: !!x.dishwasherDevice, comp: Dishwasher, name: t("tileDishwasher") },
    { id: "paperless", col: 2, on: !!x.paperlessCount, comp: Paperless, name: t("tileInbox") },
    { id: "speedtest", col: 2, on: !!x.speedtestUrl, comp: Speedtest, name: t("tileSpeed") },
    { id: PINNED, col: 2, on: x.showSettingsPanel !== false, comp: SettingsPanel, name: t("tileSettings") },
  ];
  return all.filter((d) => d.on);
});
const byId = computed(() => Object.fromEntries(tiles.value.map((d) => [d.id, d])));
const moving = computed(() => draft.value !== null);
const shown = computed(() => arrange(tiles.value, draft.value ?? savedLayout.value,
  { moving: moving.value, raise: printing.value ? "printer" : undefined }));

watch(moveRequested, () => startMoving(arrange(tiles.value, savedLayout.value, { moving: true })));
// a tablet left in move mode goes back to normal after a few minutes untouched, without saving
beiRuhe(() => finishMoving(false));

/** Dragging: the tile moves through the columns while the finger moves; a label follows the finger. */
const dragId = ref<string | null>(null);
const ghost = ref({ x: 0, y: 0 });
const columnsEl = ref<HTMLElement | null>(null);

function dragStart(id: string, e: PointerEvent) {
  dragId.value = id;
  ghost.value = { x: e.clientX, y: e.clientY };
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}
function dragMove(e: PointerEvent) {
  if (!dragId.value || !draft.value || !columnsEl.value) return;
  ghost.value = { x: e.clientX, y: e.clientY };
  const cols = [...columnsEl.value.querySelectorAll<HTMLElement>(":scope > .col")];
  // the column under the finger; on a phone (one column under the other) the one it is vertically in
  let ci = cols.findIndex((c) => { const b = c.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top - 40 && e.clientY <= b.bottom + 40; });
  if (ci < 0) ci = cols.findIndex((c) => { const b = c.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right; });
  if (ci < 0) return;
  const slots = [...cols[ci].querySelectorAll<HTMLElement>(":scope > .slot")].filter((el) => el.dataset.tile !== dragId.value && el.dataset.tile !== PINNED);
  const index = slots.filter((el) => { const b = el.getBoundingClientRect(); return b.top + b.height / 2 < e.clientY; }).length;
  const current = shown.value.cols.map((c) => c.filter((id) => id !== PINNED));
  const next = moveTile({ cols: current, hidden: draft.value.hidden }, dragId.value, ci, index);
  if (JSON.stringify(next.cols) !== JSON.stringify(current)) draft.value = next;
}
function dragEnd() { dragId.value = null; }
function hide(id: string) {
  if (draft.value) draft.value = toggleHidden({ cols: shown.value.cols, hidden: draft.value.hidden }, id);
}

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
    <div v-if="moving" class="move-bar" role="toolbar" :aria-label="t('moveTitle')">
      <i class="mdi mdi-cursor-move text-2xl" aria-hidden="true"></i>
      <div class="move-bar-text">
        <div class="move-bar-title">{{ t("moveTitle") }}</div>
        <div class="move-bar-hint">{{ t("moveHint") }}</div>
      </div>
      <button type="button" class="mb-btn" data-test="move-reset" @click="resetDraft">{{ t("moveReset") }}</button>
      <button type="button" class="mb-btn" data-test="move-cancel" @click="finishMoving(false)">{{ t("cancel") }}</button>
      <button type="button" class="mb-btn mb-done" data-test="move-done" @click="finishMoving(true)">{{ t("moveDone") }}</button>
    </div>

    <!-- Three columns like the kitchen dashboard (4 : 3 : 2), one column on phones; the order is per device (lib/layout.ts) -->
    <div v-if="!loading && !empty()" ref="columnsEl" class="columns" :class="{ moving }"
      @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
      <div v-for="(col, ci) in shown.cols" :key="ci" class="col" :data-col="ci">
        <div v-for="id in col" :key="id" class="slot" :data-tile="id"
          :class="{ dragging: dragId === id, 'slot-hidden': moving && shown.hidden.includes(id) }">
          <div v-if="moving && shown.hidden.includes(id)" class="hidden-row">
            <span class="hidden-name">{{ byId[id]?.name }} <span class="muted">· {{ t("moveHidden") }}</span></span>
            <button type="button" class="move-icon" :aria-label="t('moveShow', { name: byId[id]?.name })" @click="hide(id)">
              <i class="mdi mdi-eye-off-outline" aria-hidden="true"></i>
            </button>
            <span class="move-handle" :aria-label="t('moveGrab', { name: byId[id]?.name })" @pointerdown.prevent="dragStart(id, $event)">
              <i class="mdi mdi-drag" aria-hidden="true"></i>
            </span>
          </div>
          <template v-else>
            <component :is="byId[id]?.comp" />
            <div v-if="moving && id !== PINNED" class="move-overlay">
              <button type="button" class="move-icon" :data-test="`hide-${id}`" :aria-label="t('moveHide', { name: byId[id]?.name })" @click="hide(id)">
                <i class="mdi mdi-eye-outline" aria-hidden="true"></i>
              </button>
              <span class="move-handle" :data-test="`grab-${id}`" :aria-label="t('moveGrab', { name: byId[id]?.name })" @pointerdown.prevent="dragStart(id, $event)">
                <i class="mdi mdi-drag" aria-hidden="true"></i>
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div v-if="dragId" class="move-ghost" :style="{ left: ghost.x + 'px', top: ghost.y + 'px' }" aria-hidden="true">
      {{ byId[dragId]?.name }}
    </div>
  </main>

  <ConfirmDialog />
</template>
