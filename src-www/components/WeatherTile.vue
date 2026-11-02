<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { beiRuhe } from "../lib/idle";
import Tile from "./ui/Tile.vue";
import { weather, wetterstunden, startHourly } from "../lib/weatherData";
import { getWeatherIconClass } from "../lib/weatherIcon";
import WeatherDetailsDialog from "./WeatherDetailsDialog.vue";
import RegenZeitleiste from "./RainTimeline.vue";
import { t } from "../lib/i18n";

startHourly();

const detailsVisible = ref(false);
const detailsTab = ref<"woche" | "stunden">("woche");
function detailsOeffnen(tab: "woche" | "stunden") { detailsTab.value = tab; detailsVisible.value = true; }

// Uhr für die „jetzt"-Markierung der Zeitleiste, einmal je Minute
const jetzt = ref(new Date());
let uhrTakt: ReturnType<typeof setInterval> | undefined;
onMounted(() => { uhrTakt = setInterval(() => { jetzt.value = new Date(); }, 60_000); });
onUnmounted(() => clearInterval(uhrTakt));
/** Heute aus Open-Meteo (Regen + Temperatur je Stunde); fehlt es, zeigt die Kachel keine Zeitleiste. */
const heuteStunden = computed(() => wetterstunden.value.tage[0] ?? null);
// Nach ein paar Minuten ohne Berührung wieder zu (lib/leerlauf.ts)
beiRuhe(() => { detailsVisible.value = false; });

interface DayView {
  day: string;
  icon: string;
  temp_min: number;
  temp_max: number;
  condition: string;
  wind: number;
  rain: number;
}

function weekdayLabel(dayIndex: number): string {
  if (dayIndex === 0) return "Heute";
  if (dayIndex === 1) return "Morgen";
  const date = new Date();
  date.setDate(date.getDate() + dayIndex);
  return date.toLocaleDateString("de-DE", { weekday: "short" });
}

function toView(day: (typeof weather.value.days)[number], index: number): DayView {
  return {
    day: weekdayLabel(index),
    icon: getWeatherIconClass(day.icon),
    temp_min: Math.round(day.temperaturMin * 10) / 10,
    temp_max: Math.round(day.temperaturMax * 10) / 10,
    condition: day.state,
    wind: Math.round(day.windSpeed),
    rain: day.rain,
  };
}

// Hauptkarte bleibt kompakt bei 3 Tagen - die vollen 6 Tage gibt's im Detail-Popup.
const forecast = computed<DayView[]>(() => weather.value.days.slice(0, 3).map(toView));

/** Uhrzeit aus einem Unix-Zeitstempel (Sekunden ODER Millisekunden - der Adapter liefert beides). */
function uhr(ts: number): string {
  if (!ts) return "--:--";
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Die vierte Spalte: Einzelheiten zum HEUTIGEN Tag, die in der Tageskachel keinen Platz haben.
 * Bewusst nur Werte, die man am Küchentisch wirklich braucht -- jetzige Temperatur (die
 * Tageskachel zeigt Min/Max), Böen (entscheidet über Sonnenschirm und Trampolin), Feuchte,
 * Luftdruck sowie Sonnenauf- und -untergang.
 */
const heuteDetails = computed(() => {
  const c = weather.value.current;
  return [
    { icon: "wi-thermometer", label: "jetzt", wert: `${Math.round(c.temperature * 10) / 10} °C` },
    { icon: "wi-strong-wind", label: "Böen", wert: `${Math.round(c.windGust)} km/h` },
    { icon: "wi-humidity", label: "Luft", wert: `${Math.round(c.humidity)} %` },
    { icon: "wi-barometer", label: "Druck", wert: `${Math.round(c.pressure)} hPa` },
    { icon: "wi-sunrise", label: "auf", wert: uhr(c.sunrise) },
    { icon: "wi-sunset", label: "unter", wert: uhr(c.sunset) },
  ];
});
</script>

<template>
  <Tile :title="t('forecast')" data-test="weather">
    <template #action>
      <button type="button" class="icon-btn" aria-label="Mehr Tage & Details" @click="detailsOeffnen('woche')">
        <i class="mdi mdi-calendar-month-outline text-2xl" style="color: var(--brand)" aria-hidden="true"></i>
      </button>
    </template>
      <WeatherDetailsDialog v-model:visible="detailsVisible" :tab="detailsTab" />

      <!-- Heute über die volle Kachelbreite mit der
           Regen-Zeitleiste, darunter Morgen und Übermorgen nebeneinander, jeder
           mit seiner eigenen kleinen Zeitleiste. Antippen öffnet die drei Tage groß (Reiter „Stunden"). -->
      <div class="space-y-3">
        <div v-if="forecast[0]" class="rounded-xl bg-blue-50 dark:bg-blue-950 shadow-sm px-4 pt-3 pb-2" data-test="wetter-heute">
          <!-- Handy: Kleinwerte unter Symbol und Temperatur statt daneben -- daneben überlappten sie bei 339 px (27.10.) -->
          <div class="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2">
            <i aria-hidden="true" :class="['wi', forecast[0].icon]" style="color: var(--blue-500); font-size: 3.6rem; line-height: 1"></i>
            <div class="min-w-0">
              <div class="text-lg font-semibold">Heute</div>
              <div class="text-3xl leading-tight tabular-nums">
                {{ forecast[0].temp_max }}<span class="font-light">°</span>
                <span class="text-lg font-light text-gray-500 dark:text-gray-400">/ {{ forecast[0].temp_min }}°</span>
              </div>
              <div class="text-sm">{{ forecast[0].condition }}</div>
            </div>
            <div class="w-full sm:w-auto sm:ml-auto grid grid-cols-2 gap-x-5 gap-y-0.5 text-xs">
              <div v-for="d in heuteDetails" :key="d.label" class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  <i aria-hidden="true" :class="['wi', d.icon, 'text-base']" style="color: var(--blue-500)"></i>
                  {{ d.label }}
                </span>
                <span class="font-semibold tabular-nums whitespace-nowrap">{{ d.wert }}</span>
              </div>
            </div>
          </div>
          <button
            v-if="heuteStunden"
            type="button"
            class="block w-full mt-2 text-left"
            data-test="regen-zeitleiste"
            aria-label="Regen und Temperatur für drei Tage zeigen"
            @click="detailsOeffnen('stunden')"
          >
            <RegenZeitleiste :tag="heuteStunden" :jetzt="jetzt" :hoehe="120" />
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            v-for="(day, i) in forecast.slice(1)"
            :key="day.day"
            type="button"
            class="rounded-xl border border-gray-200 dark:border-gray-700 px-3 pt-2 pb-1 text-left min-w-0"
            :data-test="`wetter-tag-${i + 1}`"
            @click="detailsOeffnen('stunden')"
          >
            <div class="flex flex-wrap sm:flex-nowrap items-center gap-x-3">
              <i aria-hidden="true" :class="['wi', day.icon]" style="color: var(--blue-500); font-size: 2.4rem; line-height: 1"></i>
              <div class="min-w-0">
                <div class="font-semibold">{{ day.day }}</div>
                <div class="text-xl leading-tight tabular-nums">
                  {{ day.temp_max }}<span class="font-light">°</span>
                  <span class="text-sm font-light text-gray-500 dark:text-gray-400">/ {{ day.temp_min }}°</span>
                </div>
              </div>
              <!-- Handy: Wetterlage, Wind und Regen als eigene Zeile, daneben brach die Temperatur um (27.10.) -->
              <div class="w-full sm:w-auto sm:ml-auto sm:text-right text-xs text-gray-500 dark:text-gray-400 min-w-0">
                <div class="truncate">{{ day.condition }}</div>
                <div class="whitespace-nowrap">🌬 {{ day.wind }} km/h · 🌧 {{ day.rain }} mm</div>
              </div>
            </div>
            <RegenZeitleiste v-if="wetterstunden.tage[i + 1]" class="mt-1" :tag="wetterstunden.tage[i + 1]" :hoehe="120" :schrift="15" />
          </button>
        </div>
      </div>
  </Tile>
</template>

