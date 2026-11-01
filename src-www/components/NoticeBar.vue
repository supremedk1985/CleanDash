<script setup lang="ts">
/**
 * Notices lie over the page on the left, the rest of the page is dimmed (the tiles do not move). Each one can be
 * snoozed for five minutes; bins and a finished dishwasher can also be marked done.
 */
import Bin from "./ui/Bin.vue";
import { dismiss, notices, snooze } from "../lib/notices";
import { t } from "../lib/i18n";
</script>

<template>
  <template v-if="notices.length">
    <div class="notice-dim" aria-hidden="true"></div>
    <div class="notices" role="alert" aria-live="assertive">
      <div v-for="n in notices" :key="n.key" class="notice" :class="n.level" :data-test="`notice-${n.key}`"
        :style="n.color ? { borderColor: n.color } : undefined">
        <div class="notice-art">
          <Bin v-if="n.bin" :color="n.color ?? '#9ca3af'" :label="n.bin.label" :width="150" />
          <i v-else :class="n.icon ?? 'mdi mdi-alert-circle-outline'" :style="n.color ? { color: n.color } : undefined" aria-hidden="true"></i>
        </div>
        <div class="notice-body">
          <div v-if="n.eyebrow" class="notice-eyebrow">{{ n.eyebrow }}</div>
          <div class="notice-title">{{ n.title }}</div>
          <div v-if="n.detail" class="notice-detail">{{ n.detail }}</div>
          <div class="notice-buttons">
            <button type="button" class="nb nb-snooze" :data-test="`snooze-${n.key}`" @click="snooze(n)">
              <i class="mdi mdi-alarm-snooze" aria-hidden="true"></i>{{ t("snooze") }}
            </button>
            <button v-if="n.done" type="button" class="nb nb-done" :data-test="`done-${n.key}`" @click="dismiss(n)">
              <i class="mdi mdi-check-bold" aria-hidden="true"></i>{{ t("done") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
