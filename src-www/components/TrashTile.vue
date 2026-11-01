<script setup lang="ts">
/** The next waste collection and the one after, in the colours set up in the trashschedule adapter. */
import { computed } from "vue";
import { mdiTrashCan } from "@mdi/js";
import Icon from "./Icon.vue";
import { config, trashColorMap, values } from "../lib/store";
import { trashIds } from "../lib/config";
import { pickup } from "../lib/tiles";
import { t, whenDays } from "../lib/i18n";

const ids = computed(() => (config.value?.trash ? trashIds(config.value.trash) : []));
const next = computed(() => pickup(values[ids.value[0]], values[ids.value[1]]));
const after = computed(() => pickup(values[ids.value[2]], values[ids.value[3]]));
const color = (type: string) => trashColorMap.value[type] ?? "var(--muted)";
</script>

<template>
  <section class="card" data-test="trash">
    <header class="card-head"><h2 class="card-title">{{ t("trash") }}</h2></header>
    <div v-if="next" class="pickup" :class="{ soon: next.daysLeft <= 1 }">
      <span class="bins">
        <Icon v-for="ty in next.types" :key="ty" :path="mdiTrashCan" :size="40" :style="{ color: color(ty) }" />
      </span>
      <span class="grow">
        <span class="block strong">{{ whenDays(next.daysLeft) }}</span>
        <span class="block muted">{{ next.types.join(", ") }}</span>
      </span>
    </div>
    <p v-else class="muted small">–</p>
    <div v-if="after" class="pickup later small">
      <span class="bins">
        <Icon v-for="ty in after.types" :key="ty" :path="mdiTrashCan" :size="22" :style="{ color: color(ty) }" />
      </span>
      <span class="grow muted">{{ t("then") }} {{ whenDays(after.daysLeft) }}: {{ after.types.join(", ") }}</span>
    </div>
  </section>
</template>
