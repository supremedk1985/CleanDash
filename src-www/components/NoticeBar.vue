<script setup lang="ts">
/** The notices at the top of the page, newest cause first in the order the sources list them. */
import { mdiAlertCircleOutline, mdiClose, mdiInformationOutline } from "@mdi/js";
import Icon from "./Icon.vue";
import { dismiss, notices } from "../lib/notices";
import { t } from "../lib/i18n";
</script>

<template>
  <div v-if="notices.length" class="notices" role="status" aria-live="polite">
    <div v-for="n in notices" :key="n.key" class="notice" :class="n.level" :data-test="`notice-${n.key}`">
      <Icon :path="n.level === 'alert' ? mdiAlertCircleOutline : mdiInformationOutline" :size="22" />
      <span class="grow">{{ n.text }}</span>
      <button type="button" class="icon-btn" :aria-label="t('dismiss')" @click="dismiss(n)"><Icon :path="mdiClose" :size="18" /></button>
    </div>
  </div>
</template>
