<script setup lang="ts">
/**
 * Notices lie over the page at the top (the tiles do not move). Each one can be put on snooze for five minutes;
 * if its cause is still there afterwards, it comes back.
 */
import { mdiAlertCircleOutline, mdiInformationOutline } from "@mdi/js";
import Icon from "./Icon.vue";
import { notices, snooze } from "../lib/notices";
import { t } from "../lib/i18n";
</script>

<template>
  <div v-if="notices.length" class="notices" role="status" aria-live="polite">
    <div v-for="n in notices" :key="n.key" class="notice" :class="n.level" :data-test="`notice-${n.key}`"
      :style="n.color ? { borderColor: n.color } : undefined">
      <i v-if="n.icon" :class="n.icon" class="notice-icon" :style="n.color ? { color: n.color } : undefined" aria-hidden="true"></i>
      <Icon v-else :path="n.level === 'alert' ? mdiAlertCircleOutline : mdiInformationOutline" :size="40" />
      <span class="grow">{{ n.text }}</span>
      <button type="button" class="btn primary snooze" :data-test="`snooze-${n.key}`" @click="snooze(n)">
        <i class="mdi mdi-alarm-snooze" aria-hidden="true"></i>{{ t("snooze") }}
      </button>
    </div>
  </div>
</template>
