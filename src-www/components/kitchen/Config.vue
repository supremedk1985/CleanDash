<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Button from "../../compat/primevue/Button.vue";
import ToggleButton from "../../compat/primevue/ToggleButton.vue";
import { isDark, setManualTheme, getThemeDiagnostics } from "../../lib/theme";
import { logBuffer } from "../../lib/logger";
import { draft, requestMoveMode } from "../../lib/layout";
import { t } from "../../lib/i18n";

const lastUpdated = ref(new Date().toLocaleString());
const showDiagnostics = ref(false);
const copyStatus = ref("");
const appVersion = __APP_VERSION__;

const reloadPage = () => {
  location.reload();
};

// Zählt Warnungen/Fehler, damit man auf einen Blick sieht, ob überhaupt
// etwas Auffälliges passiert ist (wichtig auf Geräten ohne DevTools-Zugriff).
const issueCount = computed(
  () => logBuffer.value.filter((e) => e.level === "error" || e.level === "warn").length
);

const diagnosticsText = computed(() => {
  const diag = getThemeDiagnostics();
  // Reine HTTP-Polling-Logs (info-Level, ~40 pro Zyklus) würden Warnungen/Fehler
  // sofort aus den letzten Einträgen verdrängen - deshalb hier nur warn/error zeigen.
  const issues = logBuffer.value.filter((e) => e.level === "error" || e.level === "warn");
  const lines = [
    `Zeitpunkt: ${new Date().toLocaleString()}`,
    `Version: ${appVersion}`,
    `User-Agent: ${navigator.userAgent}`,
    "",
    "--- Theme-Diagnose ---",
    ...Object.entries(diag).map(([key, value]) => `${key}: ${value}`),
    "",
    `--- Warnungen & Fehler (${issues.length} von ${logBuffer.value.length} Log-Einträgen insgesamt) ---`,
    ...(issues.length
      ? issues
          .slice(-50)
          .map((e) => `[${e.t}] [${e.level.toUpperCase()}] ${e.msg}${e.meta ? " " + JSON.stringify(e.meta) : ""}`)
      : ["(keine)"]),
  ];
  return lines.join("\n");
});

async function copyDiagnostics() {
  try {
    await navigator.clipboard.writeText(diagnosticsText.value);
    copyStatus.value = "Kopiert!";
  } catch {
    copyStatus.value = "Kopieren fehlgeschlagen - Text unten manuell markieren";
  }
  setTimeout(() => (copyStatus.value = ""), 4000);
}

let clockTimer: number;

onMounted(() => {
  clockTimer = window.setInterval(() => {
    lastUpdated.value = new Date().toLocaleString();
  }, 10000);
});

onUnmounted(() => {
  clearInterval(clockTimer);
});
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-600 dark:text-gray-300 space-y-3"
  >
    <div class="flex justify-between items-center">
      <span class="flex items-center gap-2">
        <i class="pi pi-refresh text-gray-400 dark:text-gray-500"></i>
        Neu laden
      </span>
      <Button
        icon="pi pi-refresh"
        text
        rounded
        class="!p-1 !text-gray-500 dark:!text-gray-400 hover:!text-blue-600 dark:hover:!text-blue-400"
        @click="reloadPage"
      />
    </div>

    <div class="flex justify-between items-center">
      <span class="flex items-center gap-2">
        <i class="pi pi-moon text-gray-400 dark:text-gray-500"></i>
        Darstellung
      </span>
      <ToggleButton
        :modelValue="isDark"
        @update:modelValue="setManualTheme"
        onIcon="pi pi-moon"
        offIcon="pi pi-sun"
        onLabel=""
        offLabel=""
        class="!text-xs !px-2 !py-1"
      />
    </div>

    <div class="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
      <div class="flex items-center gap-2">
        <i class="mdi mdi-view-dashboard-edit-outline text-lg" style="color: var(--brand)" aria-hidden="true"></i>
        <div class="flex flex-col">
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t("moveArrange") }}</span>
          <span>{{ t("moveOnlyHere") }}</span>
        </div>
      </div>
      <button v-if="!draft" type="button" class="move-start" data-test="move-start" @click="requestMoveMode">{{ t("moveStart") }}</button>
    </div>
    <div class="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
      <span class="flex items-center gap-2">
        <i class="pi pi-clock text-gray-400 dark:text-gray-500"></i>
        Update
      </span>
      <span class="font-mono">{{ lastUpdated }}</span>
    </div>

    <div class="flex justify-between items-center">
      <span class="flex items-center gap-2">
        <i class="pi pi-tag text-gray-400 dark:text-gray-500"></i>
        Version
      </span>
      <span class="font-mono">{{ appVersion }}</span>
    </div>

    <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        class="w-full flex justify-between items-center"
        @click="showDiagnostics = !showDiagnostics"
      >
        <span class="flex items-center gap-2">
          <i class="pi pi-wrench text-gray-400 dark:text-gray-500"></i>
          Diagnose
          <span
            v-if="issueCount > 0"
            class="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
          >
            {{ issueCount }}
          </span>
        </span>
        <i :class="['pi', showDiagnostics ? 'pi-chevron-up' : 'pi-chevron-down', 'text-gray-400']"></i>
      </button>

      <div v-if="showDiagnostics" class="mt-2 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-gray-500 dark:text-gray-400">
            {{ logBuffer.length }} Log-Einträge, {{ issueCount }} davon Warnung/Fehler
          </span>
          <Button label="Diagnose kopieren" size="small" text class="!text-xs !p-1" @click="copyDiagnostics" />
        </div>
        <div v-if="copyStatus" class="text-blue-600 dark:text-blue-400">{{ copyStatus }}</div>
        <textarea
          readonly
          rows="8"
          class="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-mono text-[10px] p-2"
          :value="diagnosticsText"
          @focus="($event.target as HTMLTextAreaElement).select()"
        ></textarea>
      </div>
    </div>
  </div>
</template>
