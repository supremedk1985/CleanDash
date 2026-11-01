<script setup lang="ts">
/** One big button that sets a datapoint to true (callDatapoint), e.g. a gong in the kids' rooms. */
import { computed } from "vue";
import { setState } from "../../compat/iobroker";
import { rawConfig } from "../../lib/store";

const label = computed(() => rawConfig.value.callLabel || "Kinder anklingeln");
const callToEat = async () => {
  if (rawConfig.value.callDatapoint) await setState(rawConfig.value.callDatapoint, true);
};
</script>

<template>
  <button
    @click="callToEat"
    class="flex items-center w-full bg-green-500 hover:bg-green-600
           text-white font-bold rounded-2xl shadow-xl px-6 py-6"
  >
    <i class="pi pi-bell" style="font-size: 60px"></i>
    <div class="h-14 w-px bg-white/40 mx-6"></div>
    <span class="text-2xl">{{ label }}</span>
  </button>
</template>
