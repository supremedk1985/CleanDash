<script setup lang="ts">
import { ref } from "vue";
import { shoppinglist } from "../../features/shoppingList";
import BringFenster from "./BringFenster.vue";

/** Bring!-Knopf: öffnet das Fenster zum schnellen Hinzufügen. Ein Tipp auf die Liste auch. */
const fenster = ref(false);
</script>

<template>
  <!-- Eine Wurzel: sonst käme das class="mt-4" aus dem Dashboard nicht an -->
  <div>
  <Card>
    <template #title>Einkaufsliste <small class="font-light">Bring!</small></template>
    <template #content>
      <!-- Breit und rot wie in Bring! selbst: die Kachel ist schmal, im Titel brach der Knopf in zwei Zeilen -->
      <button type="button" data-test="bring-knopf" @click="fenster = true"
              class="w-full mb-3 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#EE524F] hover:bg-[#d8423f]
                     text-white text-lg font-bold shadow">
        <i class="pi pi-plus" style="font-size: 18px" aria-hidden="true"></i> Auf die Liste
      </button>
      <!-- Zwei Spalten: bei drei wurden die Namen in der schmalen Mittelspalte zu „F…" -->
      <div v-if="shoppinglist.length" class="grid grid-cols-2 gap-2 cursor-pointer" @click="fenster = true">
        <div
          v-for="(item, index) in shoppinglist"
          :key="index"
          class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
        >
          <span
            class="flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400 flex-shrink-0"
          >
            <i class="mdi mdi-cart-outline" style="font-size: 1rem"></i>
          </span>
          <div class="min-w-0">
            <div class="font-semibold text-sm truncate">{{ item.name }}</div>
            <div v-if="item.specification" class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ item.specification }}
            </div>
          </div>
        </div>
      </div>
      <button v-else type="button" class="w-full text-center text-gray-400 font-light py-6" @click="fenster = true">
        Einkaufsliste ist leer
      </button>
    </template>
  </Card>
  <BringFenster v-model:offen="fenster" />
  </div>
</template>
