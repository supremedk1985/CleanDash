<script setup lang="ts">
import { computed } from "vue";

import { paperless } from "../../features/paperless";

const count = computed(() =>paperless.value.count_inbox);

const state = computed(() => {
  if (count.value === 0) return "empty";
  if (count.value > 15) return "full";
  return "filled";
});

</script>

<template>

  <card>
    <template #title>Dokumenten Sauger <small>Ablage</small></template>
    <template #content>
       

        
<div
    class="flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300"
    :class="{
      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400': state === 'empty',
      'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400': state === 'filled',
      'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400': state === 'full'
    }"
  >
    <!-- Icon -->
    <img
      v-if="state === 'empty'"
      src="../../assets/inbox_empty.svg"
      class="w-6 h-6 opacity-50"
    />

    <img
      v-else-if="state === 'filled'"
      src="../../assets/inbox.svg"
      class="w-6 h-6"
    />

    <img
      v-else
      src="../../assets/inbox_full.svg"
      class="w-6 h-6"
    />

    <!-- Counter -->
    <div class="text-lg font-semibold">
      {{ count }}
    </div>

    <!-- Progress Bar -->
    <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        class="h-full transition-all duration-500"
        :class="{
          'bg-gray-400 w-0': state === 'empty',
          'bg-blue-500': state === 'filled',
          'bg-red-500 w-full': state === 'full'
        }"
        :style="state === 'filled' ? { width: (count * 10) + '%' } : {}"
      />
    </div>
  </div>



    </template>
  </card>



</template>