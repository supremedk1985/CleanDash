<script setup lang="ts">
/**
 * The house tile: rooms grouped by floor. Per room the temperature large, setpoint and humidity below, then the
 * light (state, brightness, one switch for the whole room) and the shutters as state. A room with light on is
 * tinted warm. Tapping a room opens its lamps, shutters and setpoint. Head: lights on, open windows, all off.
 */
import { computed, ref } from "vue";
import { mdiFire, mdiLightbulbOn, mdiLightbulbOutline, mdiPower, mdiWaterOutline, mdiWindowClosedVariant, mdiWindowOpenVariant, mdiWindowShutter } from "@mdi/js";
import Icon from "./Icon.vue";
import OnOff from "./OnOff.vue";
import RoomDialog from "./RoomDialog.vue";
import { ask, config, lampStates, switchLamp, switchLamps, values } from "../lib/store";
import { num, roomLight, shutterClosed, truthy, windowState, type WindowState } from "../lib/values";
import type { Lamp, Room, Shutter } from "../lib/config";
import { number1, t } from "../lib/i18n";

const floors = computed(() => config.value?.floors ?? []);
const otherLamps = computed(() => config.value?.otherLamps ?? []);

const win = (r: Room): WindowState | null => (r.window ? windowState(values[r.window], r.windowMode) : null);
const light = (r: Room) => roomLight(r.lamps, lampStates.value);
const temp = (r: Room) => (r.temperature ? num(values[r.temperature]) : null);
const setp = (r: Room) => (r.setpoint ? num(values[r.setpoint]) : null);
const hum = (r: Room) => (r.humidity ? num(values[r.humidity]) : null);
const heating = (r: Room) => (r.heating ? truthy(values[r.heating]) || (num(values[r.heating]) ?? 0) > 0 : false);

const lampsOn = computed(() => (config.value?.lamps ?? []).filter((l) => lampStates.value[l.key]?.on));
const openWindows = computed(() => (config.value?.rooms ?? []).filter((r) => { const w = win(r); return w === "open" || w === "tilted"; }).map((r) => r.name));

function lightText(r: Room) {
  const l = light(r);
  if (l.on) return t("lightCount", { on: l.on, of: l.of });
  return l.of === 1 ? t("lightOff") : t("lightsOffCount", { of: l.of });
}

function lightShort(r: Room) {
  const l = light(r);
  return l.on ? t("lightShort", { on: l.on, of: l.of }) : t("off");
}

function shutterText(s: Shutter, i: number, count: number) {
  const p = shutterClosed(values[s.position], s);
  const name = s.name || (count > 1 ? `${t("shutter")} ${i + 1}` : t("shutter"));
  const value = p === null ? "–" : p <= 0 ? t("shutterOpen") : p >= 100 ? t("shutterClosed") : `${p} %`;
  return { name, value };
}

function roomSwitch(r: Room, on: boolean) {
  ask({ text: t(on ? "askRoomOn" : "askRoomOff", { room: r.name }), run: () => switchLamps(r.lamps, on) }, r.lamps.length > 1);
}

function lampSwitch(l: Lamp, on: boolean) {
  ask({ text: t("askSwitch", { name: l.name, state: t(on ? "switchOnWord" : "switchOffWord") }), run: () => switchLamp(l, on) });
}

function allOff() {
  const lamps = lampsOn.value;
  ask({ text: t("allLightsOff") + "?", detail: t("askAllOff", { n: lamps.length }), run: () => switchLamps(lamps, false) }, true);
}

const openRoom = ref<string | null>(null);
const roomInDialog = computed(() => config.value?.rooms.find((r) => r.name === openRoom.value) ?? null);
</script>

<template>
  <section class="card" data-test="house">
    <header class="card-head">
      <h2 class="card-title">{{ t("house") }}</h2>
      <div class="chips">
        <span class="chip" :class="{ warm: lampsOn.length }" data-test="lights-on">
          <Icon :path="lampsOn.length ? mdiLightbulbOn : mdiLightbulbOutline" :size="16" />
          {{ lampsOn.length === 0 ? t("allOff") : lampsOn.length === 1 ? t("lightOn") : t("lightsOn", { n: lampsOn.length }) }}
        </span>
        <span v-if="config?.rooms.some((r) => r.window)" class="chip" :class="{ alert: openWindows.length }" data-test="windows">
          <Icon :path="openWindows.length ? mdiWindowOpenVariant : mdiWindowClosedVariant" :size="16" />
          {{ openWindows.length ? t("windowsOpen", { rooms: openWindows.join(", ") }) : t("windowsClosed") }}
        </span>
        <button v-if="lampsOn.length" type="button" class="btn small ghost" data-test="all-off" @click="allOff">
          <Icon :path="mdiPower" :size="16" /> {{ t("allLightsOff") }}
        </button>
      </div>
    </header>

    <div class="floors">
      <section v-for="f in floors" :key="f.name" class="floor">
        <h3 v-if="f.name" class="label">{{ f.name }}</h3>
        <div class="rooms">
          <div v-for="r in f.rooms" :key="r.name" class="room" :class="{ lit: light(r).on > 0 }" :data-test="`room-${r.name}`">
            <button type="button" class="room-open" :aria-label="r.name" @click="openRoom = r.name">
              <span class="room-head">
                <span class="room-name">{{ r.name }}</span>
                <span v-if="win(r) === 'open' || win(r) === 'tilted'" class="badge alert">{{ win(r) === "open" ? t("windowOpen") : t("windowTilted") }}</span>
                <Icon v-else-if="heating(r)" class="heat" :path="mdiFire" :size="18" :label="t('heating')" />
              </span>
              <template v-if="r.temperature">
                <span class="temp-row">
                  <span class="temp" data-test="temperature">{{ number1(temp(r)) }}<span class="deg">°</span></span>
                  <span v-if="r.setpoint" class="muted small">{{ t("setpoint") }} {{ number1(setp(r)) }}°</span>
                </span>
                <span v-if="hum(r) !== null" class="muted small with-icon"><Icon :path="mdiWaterOutline" :size="14" />{{ Math.round(hum(r)!) }} %</span>
              </template>
              <span v-else class="muted small">{{ t("noThermostat") }}</span>
            </button>

            <span v-if="r.lamps.length" class="room-light" :data-test="`light-${r.name}`">
              <Icon :class="light(r).on ? 'warm-icon' : 'muted'" :path="light(r).on ? mdiLightbulbOn : mdiLightbulbOutline" :size="20" />
              <span class="grow">
                <span class="small long">{{ lightText(r) }}</span><span class="small short">{{ lightShort(r) }}</span>
                <span class="bar"><span :style="{ width: `${light(r).on ? light(r).level : 0}%` }"></span></span>
              </span>
              <OnOff :on="light(r).on > 0" :label="`${r.name}: ${light(r).on ? t('off') : t('on')}`" @toggle="(on) => roomSwitch(r, on)" />
            </span>

            <span v-for="(s, i) in r.shutters" :key="s.key" class="shutter-row small muted">
              <Icon :path="mdiWindowShutter" :size="16" />
              <span class="grow">{{ shutterText(s, i, r.shutters.length).name }}</span>
              <strong>{{ shutterText(s, i, r.shutters.length).value }}</strong>
            </span>
          </div>
        </div>
      </section>

      <section v-if="otherLamps.length" class="floor">
        <h3 class="label">{{ t("otherLights") }}</h3>
        <div class="others">
          <button v-for="l in otherLamps" :key="l.key" type="button" role="switch" class="other" :class="{ lit: lampStates[l.key]?.on }"
            :aria-checked="!!lampStates[l.key]?.on" :data-test="`other-${l.name}`" @click="lampSwitch(l, !lampStates[l.key]?.on)">
            <Icon :class="lampStates[l.key]?.on ? 'warm-icon' : 'muted'" :path="lampStates[l.key]?.on ? mdiLightbulbOn : mdiLightbulbOutline" :size="20" />
            <span class="other-text">
              <span>{{ l.name }}</span>
              <span class="muted small">{{ lampStates[l.key]?.on === null ? "…" : lampStates[l.key]?.on ? t("on") : t("off") }}</span>
            </span>
          </button>
        </div>
      </section>

      <p class="muted small">{{ t("roomHint") }}</p>
    </div>

    <RoomDialog :room="roomInDialog" @close="openRoom = null" />
  </section>
</template>
