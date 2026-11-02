<script setup lang="ts">
/**
 * Eine Kiste in der Ansicht „Räume": gezeichnet wie im Regal -- IKEA UPPSNOFSAD schwarz mit weißem
 * Etikett, SAMLA milchig, sonst neutral --, mit Nummer, bis zu zwei Inhaltsfotos (im Fünfer-Raster ist nicht mehr Platz) und der Zahl der Sachen.
 */
import { computed } from "vue";
import { fotoUrl, kistenAussehen } from "../../features/fundus";
import type { FuKiste } from "../../features/fundus";

const props = defineProps<{ kiste: FuKiste; fotos: string[] }>();
defineEmits<{ (e: "oeffnen", code: string): void }>();

const aussehen = computed(() => kistenAussehen(props.kiste));
const KLASSE = {
  dunkel: "bg-[#1c1d1f] text-white border-[#45474b]",
  milchig: "bg-[#dce5ec]/90 text-gray-900 border-[#8fa0ae]",
  neutral: "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600",
} as const;
</script>

<template>
  <button type="button" @click="$emit('oeffnen', kiste.code)" data-test="fundus-raum-kiste"
          class="h-20 w-full rounded-lg border-2 px-3 flex items-center gap-2.5 text-left overflow-hidden shadow-sm hover:ring-2 ring-green-600"
          :class="KLASSE[aussehen]">
    <span v-if="aussehen === 'dunkel'" class="w-4 h-6 rounded-sm bg-[#f2f2ee] shrink-0" aria-hidden="true"></span>
    <span v-else class="w-1.5 h-8 rounded-full shrink-0" :class="aussehen === 'milchig' ? 'bg-[#8fa0ae]' : 'bg-amber-400'"
          aria-hidden="true"></span>
    <span class="text-2xl font-bold whitespace-nowrap">{{ kiste.code }}</span>
    <span class="flex -space-x-2 ml-auto min-w-0 overflow-hidden">
      <img v-for="f in fotos.slice(0, 2)" :key="f" :src="fotoUrl(f) ?? ''" alt="" loading="lazy" class="w-9 h-9 rounded-md object-cover ring-2 shrink-0"
           :class="aussehen === 'dunkel' ? 'ring-[#1c1d1f]' : 'ring-white dark:ring-gray-700'" />
    </span>
    <span class="min-w-[2rem] text-right text-lg font-semibold opacity-80">{{ kiste.anzahl ?? 0 }}</span>
  </button>
</template>
