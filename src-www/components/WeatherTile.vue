<script setup lang="ts">
/** Weather from the openweathermap adapter: now, the next 24 hours in 3-hour steps, the coming days. */
import { computed } from "vue";
import { mdiWaterOutline, mdiWeatherSunsetDown, mdiWeatherSunsetUp, mdiWeatherWindy } from "@mdi/js";
import Icon from "./Icon.vue";
import { config, values } from "../lib/store";
import { WEATHER_DAYS, WEATHER_PERIODS } from "../lib/config";
import { num } from "../lib/values";
import { kmh, owmCode, time, weatherIcon } from "../lib/tiles";
import { clock, decimal, t, weekday } from "../lib/i18n";

const f = computed(() => `${config.value?.weather?.base}.forecast`);
const v = (k: string) => values[`${f.value}.${k}`];

const now = computed(() => ({
  temp: num(v("current.temperature")),
  state: typeof v("current.state") === "string" ? (v("current.state") as string) : "",
  icon: weatherIcon(owmCode(v("current.icon"))),
  wind: kmh(num(v("current.windSpeed"))),
  humidity: num(v("current.humidity")),
  sunrise: time(v("current.sunrise")),
  sunset: time(v("current.sunset")),
}));

const hours = computed(() =>
  Array.from({ length: WEATHER_PERIODS }, (_, i) => ({
    at: time(v(`period${i}.date`)),
    temp: num(v(`period${i}.temperatureMax`)),
    rain: num(v(`period${i}.precipitation`)),
    icon: weatherIcon(owmCode(v(`period${i}.icon`))),
  })).filter((h) => h.at),
);

// day0 is today; the tile shows the next five
const days = computed(() =>
  Array.from({ length: WEATHER_DAYS - 1 }, (_, i) => i + 1).map((i) => ({
    at: time(v(`day${i}.date`)),
    max: num(v(`day${i}.temperatureMax`)),
    min: num(v(`day${i}.temperatureMin`)),
    rain: num(v(`day${i}.precipitation`)),
    icon: weatherIcon(owmCode(v(`day${i}.icon`))),
  })).filter((d) => d.at),
);
const round = (x: number | null) => (x === null ? "–" : Math.round(x));
</script>

<template>
  <section class="card" data-test="weather">
    <header class="card-head"><h2 class="card-title">{{ t("weather") }}</h2></header>
    <div class="weather-now">
      <Icon class="weather-big" :path="now.icon" :size="64" />
      <div class="grow">
        <div class="temp big">{{ decimal(now.temp) }}<span class="deg">°</span></div>
        <div class="muted">{{ now.state }}</div>
      </div>
      <div class="weather-facts small muted">
        <span v-if="now.wind !== null" class="with-icon"><Icon :path="mdiWeatherWindy" :size="16" />{{ now.wind }} km/h</span>
        <span v-if="now.humidity !== null" class="with-icon"><Icon :path="mdiWaterOutline" :size="16" />{{ Math.round(now.humidity) }} %</span>
        <span v-if="now.sunrise" class="with-icon"><Icon :path="mdiWeatherSunsetUp" :size="16" />{{ clock(now.sunrise) }}</span>
        <span v-if="now.sunset" class="with-icon"><Icon :path="mdiWeatherSunsetDown" :size="16" />{{ clock(now.sunset) }}</span>
      </div>
    </div>

    <div v-if="hours.length" class="strip">
      <div v-for="(h, i) in hours" :key="i" class="strip-cell">
        <span class="muted small">{{ clock(h.at!) }}</span>
        <Icon :path="h.icon" :size="26" />
        <strong>{{ round(h.temp) }}°</strong>
        <span class="rain small" :class="{ none: !h.rain }">{{ h.rain ? `${decimal(h.rain)} mm` : "·" }}</span>
      </div>
    </div>

    <div v-if="days.length" class="days">
      <div v-for="(d, i) in days" :key="i" class="day">
        <span class="day-name">{{ weekday(d.at!) }}</span>
        <Icon :path="d.icon" :size="24" />
        <span class="day-temp"><strong>{{ round(d.max) }}°</strong> <span class="muted">{{ round(d.min) }}°</span></span>
        <span class="rain small" :class="{ none: !d.rain }">{{ d.rain ? `${decimal(d.rain)} mm` : "" }}</span>
      </div>
    </div>
  </section>
</template>
