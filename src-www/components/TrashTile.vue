<script setup lang="ts">
/**
 * Bin ticker: the next collection as a large bin in its colour with the days left written on it (pulsing when it
 * is today or tomorrow), the one after as a smaller bin. Colours come from the trashschedule instance. The reminder
 * "collected tomorrow" is a notice at the top of the page (lib/notices.ts), not a dialog on the tile.
 */
import { computed } from "vue";
import Tile from "./ui/Tile.vue";
import { config, trashColorMap, values } from "../lib/store";
import { trashIds } from "../lib/config";
import { pickup } from "../lib/tiles";
import { t } from "../lib/i18n";

const ids = computed(() => (config.value?.trash ? trashIds(config.value.trash) : []));
const next = computed(() => pickup(values[ids.value[0]], values[ids.value[1]]));
const after = computed(() => pickup(values[ids.value[2]], values[ids.value[3]]));
const color = (types: string[] | undefined) => (types?.length ? trashColorMap.value[types[0]] : undefined) ?? "#9ca3af";

const label = (days: number) =>
  days <= 0 ? { big: t("today").toUpperCase(), small: "" } : days === 1 ? { big: t("tomorrow").toUpperCase(), small: "" } : { big: String(days), small: t("days") };
</script>

<template>
  <Tile :title="t('binTicker')" data-test="trash">
    <div class="w-full grid grid-cols-[4fr_3fr] gap-3 p-1 sm:gap-4 sm:p-2 items-end">
      <div v-for="(p, i) in [next, after]" :key="i" class="relative" :title="p?.types.join(', ')">
        <svg viewBox="0 0 152 157" class="w-full h-full" :class="{ 'animate-pulse': i === 0 && p && p.daysLeft <= 1 }" role="img"
          :aria-label="p ? `${p.types.join(', ')}: ${label(p.daysLeft).big} ${label(p.daysLeft).small}` : '–'">
          <g transform="translate(0,157) scale(0.1,-0.1)" :fill="color(p?.types)" stroke="none">
            <path d="M290 1430 c-22 -21 -30 -37 -28 -55 2 -14 6 -25 11 -25 4 0 183 0 397 0 l390 0 0 23 c-1 26 -15 46 -50 70 -22 15 -60 17 -356 17 l-332 0 -32 -30z" />
            <path d="M186 1307 c-30 -22 -17 -60 24 -73 43 -14 45 -20 60 -264 6 -102 16 -250 21 -330 5 -80 14 -206 19 -280 12 -189 -2 -180 270 -180 114 0 215 3 224 6 11 4 14 13 10 30 -8 30 12 90 44 133 28 38 92 70 139 71 38 0 34 -18 58 290 9 113 20 243 26 290 5 47 9 111 9 142 0 82 9 88 136 88 58 0 114 5 125 10 25 14 25 56 0 70 -31 16 -1142 14 -1165 -3z" />
            <path d="M970 383 c-85 -31 -120 -73 -120 -144 0 -78 70 -149 147 -149 69 0 143 77 143 150 0 59 -46 117 -109 139 -37 12 -39 12 -61 4z m64 -94 c61 -48 6 -138 -68 -109 -51 19 -54 99 -4 120 34 13 43 12 72 -11z" />
            <path d="M974 255 c-9 -21 3 -45 21 -45 21 0 30 27 15 45 -16 19 -29 19 -36 0z" />
          </g>
        </svg>
        <div v-if="p" class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-center leading-tight"
          :class="i === 0 ? (p.daysLeft > 1 ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl') : 'text-xl sm:text-3xl'"
          :style="{ marginRight: i === 0 ? '35px' : '20px' }">
          <span>{{ label(p.daysLeft).big }}</span><span v-if="label(p.daysLeft).small">{{ label(p.daysLeft).small }}</span>
        </div>
      </div>
    </div>
    <div v-if="next" class="text-center text-sm muted">{{ next.types.join(", ") }}<template v-if="after"> · {{ t("then") }} {{ after.types.join(", ") }}</template></div>
  </Tile>
</template>
