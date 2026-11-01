<script setup lang="ts">
/**
 * Energy centre: four rings (solar, battery, house, grid) in traffic-light colours, below them money saved, energy
 * produced and today's totals. The chart button opens the history (day / week / month / year) when a history folder
 * is configured. Every value is optional; what is not configured is left out.
 */
import { computed, ref } from "vue";
import Tile from "./ui/Tile.vue";
import Knob from "./ui/Knob.vue";
import GridIcon from "./ui/GridIcon.vue";
import EnergyHistoryDialog from "./EnergyHistoryDialog.vue";
import { config, values } from "../lib/store";
import { num } from "../lib/values";
import { gridShare } from "../lib/tiles";
import { istHandy } from "../lib/phone";
import { decimal, t } from "../lib/i18n";

const e = computed(() => config.value!.energy!);
const v = (id?: string) => (id ? num(values[id]) : null);
const n = (id?: string) => v(id) ?? 0;

const solar = computed(() => n(e.value.solar));
const home = computed(() => n(e.value.consumption));
const gridIn = computed(() => n(e.value.gridImport));
const gridOut = computed(() => n(e.value.gridExport));
const soc = computed(() => n(e.value.batteryLevel));
const charge = computed(() => n(e.value.batteryCharge));
const discharge = computed(() => n(e.value.batteryDischarge));

const solarPercent = computed(() => (solar.value / e.value.solarMax) * 100);
const homePercent = computed(() => Math.min(100, (home.value / e.value.homeMax) * 100));

type Light = "--green" | "--yellow" | "--red";
/** low/high boundaries; invert = "higher is better" */
function light(value: number, low: number, high: number, invert = false): Light {
  if (!invert) return value <= low ? "--green" : value < high ? "--yellow" : "--red";
  return value <= low ? "--red" : value < high ? "--yellow" : "--green";
}
const colorGrid = computed(() => light(gridIn.value, 100, 600));
const colorHome = computed(() => light(home.value, 400, 800));
const colorSolar = computed(() => light(solarPercent.value, 10, 30, true));
const colorBattery = computed(() => light(soc.value, 20, 60, true));

const batteryIcon = computed(() => {
  const p = soc.value;
  const step = p > 90 ? "100" : p > 70 ? "80" : p > 50 ? "60" : p > 30 ? "40" : p > 10 ? "20" : "outline";
  if (charge.value > 0) return `mdi mdi-battery-charging-${step}`;
  return step === "100" ? "mdi mdi-battery" : `mdi mdi-battery-${step}`;
});

const share = computed(() => gridShare(v(e.value.consumptionToday), v(e.value.gridToday)));
const historyVisible = ref(false);
const size = computed(() => (istHandy.value ? 96 : 140));
const iconSize = computed(() => (istHandy.value ? "1.9rem" : "2.8rem"));
const whole = (x: number) => Math.round(x).toLocaleString();
</script>

<template>
  <Tile data-test="energy">
    <template #title>{{ e.title || t("energyCentre") }}</template>
    <template v-if="e.historyUrl" #action>
      <button type="button" class="icon-btn" :aria-label="t('history')" data-test="energy-history" @click="historyVisible = true">
        <i class="mdi mdi-chart-bar text-2xl" style="color: var(--brand)" aria-hidden="true"></i>
      </button>
    </template>

    <EnergyHistoryDialog v-if="e.historyUrl" v-model:visible="historyVisible" />

    <div class="w-full grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-4 p-1 sm:gap-4 sm:p-2">
      <div v-if="e.solar" class="mx-auto text-center">
        <div class="knob-wrapper">
          <Knob :value="solarPercent" :max="90" :size="size" :color="`var(${colorSolar})`" />
          <div class="center-x"><i class="mdi mdi-white-balance-sunny" :style="{ color: `var(${colorSolar})`, fontSize: iconSize }"></i></div>
        </div>
        <div class="mt-1 sm:mt-3 text-2xl sm:text-4xl font-bold tabular-nums">{{ whole(solar) }}<span class="font-light pl-1">W</span></div>
      </div>

      <div v-if="e.batteryLevel" class="mx-auto text-center">
        <div class="knob-wrapper">
          <Knob :value="soc" :min="10" :size="size" :color="`var(${colorBattery})`" />
          <div class="center-x"><i :class="batteryIcon" :style="{ color: `var(${colorBattery})`, fontSize: iconSize }"></i></div>
        </div>
        <div class="mt-1 sm:mt-3 text-2xl sm:text-4xl font-bold tabular-nums">{{ Math.round(soc) }}<span class="font-light pl-1">%</span></div>
        <div v-if="charge > 0" class="mt-1 text-xl tabular-nums" :style="{ color: charge > 300 ? 'var(--green)' : 'var(--yellow)' }">
          <span class="font-light pr-1">+</span>{{ whole(charge) }}<span class="font-light pl-1">W</span>
        </div>
        <div v-else-if="discharge > 0" class="mt-1 text-xl tabular-nums" :style="{ color: discharge > 300 ? 'var(--red)' : 'var(--yellow)' }">
          <i class="mdi mdi-arrow-down pr-1"></i>{{ whole(discharge) }}<span class="font-light pl-1">W</span>
        </div>
      </div>

      <div v-if="e.consumption" class="mx-auto text-center">
        <div class="knob-wrapper">
          <Knob :value="homePercent" :size="size" :color="`var(${colorHome})`" />
          <div class="center-x"><i class="mdi mdi-home-outline" :style="{ color: `var(${colorHome})`, fontSize: iconSize }"></i></div>
        </div>
        <div class="mt-1 sm:mt-3 text-2xl sm:text-4xl font-bold tabular-nums">{{ whole(home) }}<span class="font-light pl-1">W</span></div>
      </div>

      <div v-if="e.gridImport || e.gridExport" class="mx-auto text-center">
        <GridIcon :size="istHandy ? 88 : 130" :color="`var(${gridIn > 0 || !gridOut ? colorGrid : '--green'})`" />
        <div v-if="gridIn > 0 || !gridOut" class="mt-4 sm:mt-7 text-2xl sm:text-4xl font-bold tabular-nums">
          {{ whole(gridIn) }}<span class="font-light pl-1">W</span>
        </div>
        <div v-else class="mt-4 sm:mt-7 text-2xl sm:text-4xl font-bold tabular-nums" style="color: var(--green)">
          {{ whole(gridOut) }}<span class="font-light pl-1">W</span>
        </div>
      </div>
    </div>

    <div v-if="e.savings || e.total || e.solarToday || e.consumptionToday || e.gridToday"
      class="energy-totals w-full grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm sm:text-base mt-3">
      <div v-if="e.savings" class="flex flex-col items-center">
        <div class="font-light uppercase">{{ t("saved") }}</div>
        <div class="tabular-nums">{{ decimal(v(e.savings), 2) }} €</div>
      </div>
      <div v-if="e.total" class="flex flex-col items-center">
        <div class="font-light uppercase">{{ t("produced") }}</div>
        <div class="tabular-nums">{{ decimal(v(e.total), 2) }} kWh</div>
      </div>
      <div v-if="e.consumptionToday" class="flex flex-col items-center">
        <div class="font-light uppercase"><i class="mdi mdi-home-outline"></i> {{ t("today") }}</div>
        <div class="tabular-nums">{{ decimal(v(e.consumptionToday), 2) }} kWh</div>
      </div>
      <div v-if="e.solarToday" class="flex flex-col items-center">
        <div class="font-light uppercase"><i class="mdi mdi-white-balance-sunny"></i> {{ t("today") }}</div>
        <div class="tabular-nums">{{ decimal(v(e.solarToday), 2) }} kWh</div>
      </div>
      <div v-if="e.gridToday" class="flex flex-col items-center">
        <div class="font-light uppercase"><GridIcon :size="18" :inline="true" /> {{ t("today") }}</div>
        <div class="tabular-nums">{{ decimal(v(e.gridToday), 2) }} kWh<template v-if="share !== null"> ({{ share }} %)</template></div>
      </div>
    </div>
  </Tile>
</template>
