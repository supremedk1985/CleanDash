<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { logger } from "../../lib/logger";
import {
  roborock,
  roborockStateLabel,
  roborockErrorLabel,
  roborockFanLabel,
  roborockAktionen,
  roborockBefehl,
  befehlLaeuft,
  DOCK_STATUS_LABELS,
} from "../../features/roborock";
import type { RoborockAktion } from "../../features/roborock";
import type { Roborock } from "../../features/roborock";

// Zustände, in denen der Roboter trotz errorCode=0 ein Problem meldet
// (Ladefehler, Fehler, Notstopp).
const ERROR_STATES = new Set([9, 12, 40]);

const isError = computed(
  () => !!roborock.value && (roborock.value.errorCode !== 0 || ERROR_STATES.has(roborock.value.state))
);
const isCleaning = computed(() => !!roborock.value?.inCleaning);

// Start/Stop-Tasten (04.09.2026): welche, entscheidet der Zustand — siehe roborockAktionen().
const aktionen = computed(() =>
  roborock.value ? roborockAktionen(roborock.value.state, roborock.value.inCleaning, roborock.value.online, roborock.value.adapterVerbunden) : []
);
const AKTION_META: Record<RoborockAktion, { text: string; icon: string; klasse: string }> = {
  start: { text: "Start", icon: "mdi-play", klasse: "bg-green-500 hover:bg-green-600 text-white" },
  weiter: { text: "Weiter", icon: "mdi-play", klasse: "bg-green-500 hover:bg-green-600 text-white" },
  pause: { text: "Pause", icon: "mdi-pause", klasse: "bg-orange-400 hover:bg-orange-500 text-white" },
  station: { text: "Zur Station", icon: "mdi-home-import-outline", klasse: "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100" },
};
async function aktion(a: RoborockAktion) {
  await roborockBefehl(a);
}



function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function consumableColor(pct: number) {
  if (pct <= 15) return "bg-red-500";
  if (pct <= 35) return "bg-orange-400";
  return "bg-green-500";
}

function batteryColor(pct: number) {
  if (pct <= 20) return "text-red-500";
  if (pct <= 50) return "text-orange-400";
  return "text-green-500";
}

function batteryIcon(pct: number, state: number) {
  const charging = state === 8 || state === 2;
  if (charging) return "mdi-battery-charging";
  if (state === 100) return "mdi-battery";
  if (pct <= 10) return "mdi-battery-alert-variant-outline";
  const rounded = Math.min(90, Math.floor(pct / 10) * 10);
  return rounded <= 0 ? "mdi-battery-outline" : `mdi-battery-${rounded}`;
}

const DOCK_ITEMS_META: Array<{
  key: keyof Pick<
    Roborock,
    "clearWaterBoxStatus" | "dirtyWaterBoxStatus" | "waterBoxFilterStatus" | "dustBagStatus" | "cleanFluidStatus"
  >;
  icon: string;
  name: string;
}> = [
  { key: "clearWaterBoxStatus", icon: "mdi-water", name: "Reinwasser" },
  { key: "dirtyWaterBoxStatus", icon: "mdi-water-alert", name: "Schmutzwasser" },
  { key: "waterBoxFilterStatus", icon: "mdi-air-filter", name: "Wasserfilter" },
  { key: "dustBagStatus", icon: "mdi-trash-can-outline", name: "Staubbeutel" },
  { key: "cleanFluidStatus", icon: "mdi-flask-outline", name: "Reiniger" },
];

const dockItems = computed(() => {
  if (!roborock.value) return [];
  const r = roborock.value;
  return DOCK_ITEMS_META.map((meta) => {
    const value = r[meta.key];
    const label = DOCK_STATUS_LABELS[meta.key]?.[value] ?? "Unbekannt";
    return { ...meta, value, label, ok: value === 2, problem: value === 1 };
  });
});

const consumableItems = computed(() => {
  if (!roborock.value) return [];
  const r = roborock.value;
  return [
    { label: "Hauptbürste", value: r.mainBrushLife },
    { label: "Seitenbürste", value: r.sideBrushLife },
    { label: "Filter", value: r.filterLife },
  ];
});
</script>

<template>
  <div class="relative">
    <!-- Help calls and station notices are notices at the top of the page now (lib/notices.ts). -->
    <card>
    <template #title>
      <div class="flex items-center justify-between w-full">
        <span>Staubsaugerroboter <small v-if="roborock">{{ roborock.name }}</small></span>
        <span
          v-if="roborock"
          class="text-xs font-normal px-2 py-0.5 rounded-full"
          :class="
            roborock.online
              ? 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          "
        >
          {{ roborock.online ? "Online" : "Offline" }}
        </span>
      </div>
    </template>

    <template #content>
      <div v-if="roborock">
        <!-- Adapter ohne Cloud-Verbindung: dann sind alle Werte unten alt - das muss man sehen -->
        <div
          v-if="!roborock.adapterVerbunden"
          class="flex items-center gap-2 px-4 py-2 rounded-xl mb-3 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-sm"
        >
          <i class="mdi mdi-cloud-off-outline text-xl"></i>
          <span>Keine Verbindung zum Roboter-Adapter – die Werte unten sind der letzte bekannte Stand.</span>
        </div>
        <!-- Statuszeile -->
        <div
          class="flex items-center gap-3 px-4 py-2 rounded-xl mb-3 transition-colors duration-300"
          :class="
            isError
              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          "
        >
          <i class="mdi mdi-robot-vacuum text-3xl" :class="{ 'animate-pulse': isCleaning }"></i>
          <div class="flex-1">
            <div class="font-semibold text-lg">{{ roborockStateLabel(roborock.state) }}</div>
            <div v-if="isError" class="text-sm">{{ roborockErrorLabel(roborock.errorCode) }}</div>
          </div>
        </div>

        <!-- Start / Pause / Zur Station — große Tasten fürs Küchen-Tablet -->
        <div v-if="aktionen.length" class="grid gap-2 mb-3" :class="aktionen.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
          <button
            v-for="a in aktionen"
            :key="a"
            type="button"
            :disabled="befehlLaeuft"
            @click="aktion(a)"
            class="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-lg shadow transition-colors disabled:opacity-50"
            :class="AKTION_META[a].klasse"
          >
            <i class="mdi text-2xl" :class="AKTION_META[a].icon"></i>
            <span>{{ AKTION_META[a].text }}</span>
          </button>
        </div>

        <!-- Akku -->
        <div class="flex items-center gap-3 mb-3">
          <i class="mdi text-2xl" :class="[batteryIcon(roborock.battery, roborock.state), batteryColor(roborock.battery)]"></i>
          <div class="flex-1">
            <ProgressBar :value="roborock.battery" style="height: 1.1rem" />
          </div>
        </div>

        <!-- Letzte Reinigung -->
        <div class="grid grid-cols-3 gap-1 text-center mb-1">
          <div>
            <div class="text-lg font-bold truncate">{{ roborock.cleanArea }} m²</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Fläche</div>
          </div>
          <div>
            <div class="text-lg font-bold truncate">{{ formatDuration(roborock.cleanTime) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Dauer</div>
          </div>
          <div>
            <div class="text-lg font-bold truncate">{{ roborockFanLabel(roborock.fanPower) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Saugkraft</div>
          </div>
        </div>
        <ProgressBar v-if="isCleaning" :value="roborock.cleanPercent" class="mt-2" />
      </div>
      <div v-else class="m-4 text-center font-light">Lade Daten…</div>
    </template>

    <template #footer v-if="roborock">
      <!-- Verbrauchsmaterial -->
      <div class="space-y-2 mb-3">
        <div v-for="item in consumableItems" :key="item.label" class="flex items-center gap-2 text-xs">
          <div class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">{{ item.label }}</div>
          <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="consumableColor(item.value)"
              :style="{ width: item.value + '%' }"
            ></div>
          </div>
          <div class="w-9 text-right">{{ item.value }}%</div>
        </div>
      </div>

      <!-- Dockingstation -->
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2">
        <div
          v-for="item in dockItems"
          :key="item.key"
          class="flex items-center gap-1"
          :class="
            item.ok
              ? 'text-green-600 dark:text-green-400'
              : item.problem
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
          "
        >
          <i class="mdi" :class="item.icon"></i>
          <span class="truncate" :title="item.name + ': ' + item.label">{{ item.name }}</span>
        </div>
      </div>

      <!-- WLAN -->
      <div class="text-right text-xs text-gray-400 dark:text-gray-500">
        <i class="mdi mdi-wifi"></i> {{ roborock.rssi }} dBm
      </div>
    </template>
  </card>
  </div>
</template>
