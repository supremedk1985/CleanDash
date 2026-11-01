<script setup lang="ts">
import { fuel } from "../../features/fuel";
import { computed } from "vue";
import FuelIcon from "./FuelIcon.vue";
import { istHandy } from "../../lib/phone";

// Jede Sorte färbt sich nach IHREM Delta — vorher hing auch das Diesel-Icon
// am E10-Preis und war damit schlicht falsch.
const deltaFarbe = (delta: number) => (delta <= 0 ? "--green" : "--red");
const e10Farbe = computed(() => deltaFarbe(fuel.value.e10.delta));
const dieselFarbe = computed(() => deltaFarbe(fuel.value.diesel.delta));

</script>
<template>
  <Card>
    <template #content>
    <div class="p-card-title"><strong>E10</strong> {{ fuel.e10.station }}</div>
      <div class="flex">
        <div class="flex-none">
          <FuelIcon :size="istHandy ? 70 : 130" :color="`var(${e10Farbe})`" />
        </div>
        <div class="flex-1 pt-1 sm:pt-3">
          <div class="text-4xl sm:text-6xl text-right"> {{ fuel.e10.price }} € </div>
          <div class="text-lg sm:text-2xl text-right"> {{ fuel.e10.delta }} €
          </div>
        </div>
      </div>
      <div class="p-card-title mt-2"><strong>Diesel</strong> {{ fuel.diesel.station }}</div>
      <div class="flex">
        <div class="flex-none">
          <FuelIcon :size="istHandy ? 70 : 130" :color="`var(${dieselFarbe})`" />
        </div>
        <div class="flex-1 pt-1 sm:pt-3">
          <div class="text-4xl sm:text-6xl text-right"> {{ fuel.diesel.price }} € </div>
          <div class="text-lg sm:text-2xl text-right"> {{ fuel.diesel.delta }} €
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
<style></style>
