<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Modal from "./ui/Modal.vue";
import ChartCanvas from "./ui/ChartCanvas.vue";
import { weather, wetterstunden } from "../lib/weatherData";
import { getWeatherIconClass } from "../lib/weatherIcon";
import { isDark } from "../lib/store";
import RegenZeitleiste from "./RainTimeline.vue";

const visible = defineModel<boolean>("visible", { default: false });
const props = withDefaults(defineProps<{ tab?: "woche" | "stunden" }>(), { tab: "woche" });
const reiter = ref<string>(props.tab);
// Beim Öffnen auf den Reiter springen, über den man gekommen ist (Kalender → Woche, Zeitleiste → Stunden)
watch(visible, (offen) => { if (offen) reiter.value = props.tab; });

/** Heute, morgen, übermorgen als Zeitleisten untereinander. */
const stundenTage = computed(() =>
  wetterstunden.value.tage.slice(0, 3).map((tag, i) => ({
    tag,
    titel: i === 0 ? "Heute" : i === 1 ? "Morgen"
      : new Date(`${tag.datum}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long" }),
  })),
);

const colors = computed(() =>
  isDark.value
    ? { temperature: "#d95926", rain: "#3987e5", textSecondary: "#c3c2b7", muted: "#898781", gridline: "#2c2c2a" }
    : { temperature: "#eb6834", rain: "#2a78d6", textSecondary: "#52514e", muted: "#898781", gridline: "#e1e0d9" }
);

function weekdayLabel(dayIndex: number): string {
  if (dayIndex === 0) return "Heute";
  if (dayIndex === 1) return "Morgen";
  const date = new Date();
  date.setDate(date.getDate() + dayIndex);
  return date.toLocaleDateString("de-DE", { weekday: "short" });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

const week = computed(() =>
  weather.value.days.map((day, index) => ({
    day: weekdayLabel(index),
    icon: getWeatherIconClass(day.icon),
    temp_min: Math.round(day.temperaturMin * 10) / 10,
    temp_max: Math.round(day.temperaturMax * 10) / 10,
    rain: day.rain,
  }))
);

const current = computed(() => weather.value.current);

const temperatureChartConfig = computed(() => {
  const c = colors.value;
  return {
    type: "line" as const,
    data: {
      labels: weather.value.hourly.map((h) => formatTime(h.time)),
      datasets: [
        {
          label: "Temperatur",
          data: weather.value.hourly.map((h) => Math.round(h.temperature * 10) / 10),
          borderColor: c.temperature,
          backgroundColor: c.temperature,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.parsed.y} °C` } } },
      scales: {
        x: { ticks: { color: c.textSecondary }, grid: { display: false } },
        y: { ticks: { color: c.textSecondary }, grid: { color: c.gridline }, title: { display: true, text: "°C", color: c.muted } },
      },
    },
  };
});

const rainChartConfig = computed(() => {
  const c = colors.value;
  return {
    type: "bar" as const,
    data: {
      labels: weather.value.hourly.map((h) => formatTime(h.time)),
      datasets: [
        {
          label: "Niederschlag",
          data: weather.value.hourly.map((h) => h.rain),
          backgroundColor: c.rain,
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.parsed.y} mm` } } },
      scales: {
        x: { ticks: { color: c.textSecondary }, grid: { display: false } },
        y: { ticks: { color: c.textSecondary }, grid: { color: c.gridline }, title: { display: true, text: "mm", color: c.muted } },
      },
    },
  };
});
</script>

<template>
  <Modal v-model:visible="visible" title="Wetter – Woche &amp; Details" width="40rem">
    <div class="tabs" role="tablist">
      <button v-for="r in [['stunden', 'Stunden'], ['woche', 'Woche'], ['details', 'Details']]" :key="r[0]" type="button" role="tab"
        class="tab" :class="{ active: reiter === r[0] }" :aria-selected="reiter === r[0]" @click="reiter = r[0]">{{ r[1] }}</button>
    </div>
    <div>
        <div v-if="reiter === 'stunden'">
          <div v-if="stundenTage.length" class="space-y-4">
            <RegenZeitleiste v-for="t in stundenTage" :key="t.tag.datum" :tag="t.tag" :titel="t.titel" :jetzt="new Date()" :hoehe="110" />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Breite Balken: Regenwahrscheinlichkeit · schmale blaue: Regenmenge · Linie: Temperatur · Daten: Open-Meteo
            </p>
          </div>
          <p v-else class="text-sm text-gray-500">Keine Stundenvorhersage erreichbar.</p>
        </div>
        <div v-if="reiter === 'woche'">
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div v-for="d in week" :key="d.day" class="text-center p-2 rounded-lg border dark:border-gray-700">
              <div class="font-semibold text-sm">{{ d.day }}</div>
              <i :class="['wi', d.icon]" style="font-size: 2.5rem" class="my-1 block"></i>
              <div class="text-sm">{{ d.temp_max }}°</div>
              <div class="text-xs font-light">{{ d.temp_min }}°</div>
              <div class="text-xs font-light mt-1">🌧 {{ d.rain }} mm</div>
            </div>
          </div>
        </div>

        <div v-if="reiter === 'details'">
          <div class="space-y-6">
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <div class="font-light text-sm">Temperatur</div>
                <div class="text-lg font-semibold">{{ current.temperature.toFixed(1) }}°C</div>
              </div>
              <div>
                <div class="font-light text-sm">Wind</div>
                <div class="text-lg font-semibold">{{ Math.round(current.windSpeed) }} km/h</div>
                <div class="text-xs font-light">Böen {{ Math.round(current.windGust) }} km/h</div>
              </div>
              <div>
                <div class="font-light text-sm">Luftfeuchtigkeit</div>
                <div class="text-lg font-semibold">{{ current.humidity }}%</div>
              </div>
              <div>
                <div class="font-light text-sm">Luftdruck</div>
                <div class="text-lg font-semibold">{{ current.pressure }} hPa</div>
              </div>
              <div>
                <div class="font-light text-sm"><i class="wi wi-sunrise"></i> Sonnenaufgang</div>
                <div class="text-lg font-semibold">{{ formatTime(current.sunrise) }}</div>
              </div>
              <div>
                <div class="font-light text-sm"><i class="wi wi-sunset"></i> Sonnenuntergang</div>
                <div class="text-lg font-semibold">{{ formatTime(current.sunset) }}</div>
              </div>
            </div>

            <div>
              <div class="font-semibold mb-1">Temperaturverlauf - nächste 24h</div>
              <div style="height: 160px">
                <ChartCanvas :config="temperatureChartConfig" />
              </div>
            </div>

            <div>
              <div class="font-semibold mb-1">Niederschlag - nächste 24h</div>
              <div style="height: 120px">
                <ChartCanvas :config="rainChartConfig" />
              </div>
            </div>
          </div>
        </div>
    </div>
  </Modal>
</template>
