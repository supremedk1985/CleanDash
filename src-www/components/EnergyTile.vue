<script setup lang="ts">
/**
 * Energy at a glance: what the sun delivers, what the house uses, what flows to or from the grid, the battery.
 * Below, today's totals. Every value is optional; the tile shows what is configured.
 */
import { computed } from "vue";
import { mdiBatteryHigh, mdiBatteryLow, mdiBatteryMedium, mdiHomeLightningBoltOutline, mdiTransmissionTower, mdiWhiteBalanceSunny } from "@mdi/js";
import Icon from "./Icon.vue";
import { config, values } from "../lib/store";
import { num } from "../lib/values";
import { gridShare } from "../lib/tiles";
import { decimal, t } from "../lib/i18n";

const e = computed(() => config.value?.energy);
const v = (id?: string) => (id ? num(values[id]) : null);

const solar = computed(() => v(e.value?.solar));
const home = computed(() => v(e.value?.consumption));
const gridIn = computed(() => v(e.value?.gridImport));
const gridOut = computed(() => v(e.value?.gridExport));
const soc = computed(() => v(e.value?.batteryLevel));
const charge = computed(() => v(e.value?.batteryCharge));
const discharge = computed(() => v(e.value?.batteryDischarge));
const batteryIcon = computed(() => ((soc.value ?? 0) >= 70 ? mdiBatteryHigh : (soc.value ?? 0) >= 30 ? mdiBatteryMedium : mdiBatteryLow));

/** Grid: drawing from it is shown as such, feeding in as feed-in; whichever is non-zero wins. */
const grid = computed(() => {
  if ((gridIn.value ?? 0) > 0) return { label: t("grid"), watts: gridIn.value, cls: "draw" };
  if ((gridOut.value ?? 0) > 0) return { label: t("feedIn"), watts: gridOut.value, cls: "give" };
  if (gridIn.value === null && gridOut.value === null) return null;
  return { label: t("grid"), watts: 0, cls: "" };
});

const today = computed(() => ({
  solar: v(e.value?.solarToday),
  home: v(e.value?.consumptionToday),
  grid: v(e.value?.gridToday),
}));
const share = computed(() => gridShare(today.value.home, today.value.grid));
const watts = (x: number | null) => (x === null ? "–" : Math.round(x).toLocaleString());
</script>

<template>
  <section class="card" data-test="energy">
    <header class="card-head"><h2 class="card-title">{{ t("energy") }}</h2></header>
    <div class="flows">
      <div v-if="e?.solar" class="flow" :class="{ active: (solar ?? 0) > 0 }">
        <Icon class="flow-icon sun" :path="mdiWhiteBalanceSunny" :size="30" />
        <span class="flow-value">{{ watts(solar) }}<small> W</small></span>
        <span class="label">{{ t("solar") }}</span>
      </div>
      <div v-if="e?.consumption" class="flow">
        <Icon class="flow-icon" :path="mdiHomeLightningBoltOutline" :size="30" />
        <span class="flow-value">{{ watts(home) }}<small> W</small></span>
        <span class="label">{{ t("home") }}</span>
      </div>
      <div v-if="grid" class="flow" :class="grid.cls">
        <Icon class="flow-icon" :path="mdiTransmissionTower" :size="30" />
        <span class="flow-value">{{ watts(grid.watts) }}<small> W</small></span>
        <span class="label">{{ grid.label }}</span>
      </div>
      <div v-if="e?.batteryLevel" class="flow">
        <Icon class="flow-icon" :path="batteryIcon" :size="30" />
        <span class="flow-value">{{ soc === null ? "–" : Math.round(soc) }}<small> %</small></span>
        <span class="label">
          <template v-if="(charge ?? 0) > 0">+{{ watts(charge) }} W</template>
          <template v-else-if="(discharge ?? 0) > 0">−{{ watts(discharge) }} W</template>
          <template v-else>{{ t("battery") }}</template>
        </span>
        <span class="bar"><span :style="{ width: `${Math.max(0, Math.min(100, soc ?? 0))}%` }"></span></span>
      </div>
    </div>
    <div v-if="e?.solarToday || e?.consumptionToday || e?.gridToday" class="today small">
      <span class="label">{{ t("todayKwh") }}</span>
      <span v-if="e?.solarToday" class="with-icon"><Icon :path="mdiWhiteBalanceSunny" :size="16" />{{ decimal(today.solar) }} kWh</span>
      <span v-if="e?.consumptionToday" class="with-icon"><Icon :path="mdiHomeLightningBoltOutline" :size="16" />{{ decimal(today.home) }} kWh</span>
      <span v-if="e?.gridToday" class="with-icon"><Icon :path="mdiTransmissionTower" :size="16" />{{ decimal(today.grid) }} kWh<template v-if="share !== null"> · {{ t("fromGrid", { share }) }}</template></span>
    </div>
  </section>
</template>
