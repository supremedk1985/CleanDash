<script setup lang="ts">
/**
 * One room in detail: temperature with setpoint (− / + in 0.5 steps, applied with one button), every lamp with
 * switch and dimmer, the shutters with fully open / fully closed and a slider. Sliders send when released.
 */
import { computed, ref, watch } from "vue";
import { mdiArrowDownBold, mdiArrowUpBold, mdiClose, mdiLightbulbOn, mdiLightbulbOutline, mdiMinus, mdiPlus, mdiThermometer, mdiWindowShutter } from "@mdi/js";
import Icon from "./Icon.vue";
import OnOff from "./OnOff.vue";
import { ask, dimLamp, lampStates, moveShutter, setSetpoint, switchLamp, switchLamps, values } from "../lib/store";
import { clampSetpoint, num, roomLight, shutterClosed, truthy } from "../lib/values";
import type { Lamp, Room, Shutter } from "../lib/config";
import { number1, t } from "../lib/i18n";

const props = defineProps<{ room: Room | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

const temp = computed(() => (props.room?.temperature ? num(values[props.room.temperature]) : null));
const hum = computed(() => (props.room?.humidity ? num(values[props.room.humidity]) : null));
const heating = computed(() => {
  const h = props.room?.heating;
  return h ? truthy(values[h]) || (num(values[h]) ?? 0) > 0 : null;
});
const current = computed(() => (props.room?.setpoint ? num(values[props.room.setpoint]) : null));

// the setpoint is changed locally first; several taps add up, one button writes
const wanted = ref<number | null>(null);
watch(() => props.room?.name, () => { wanted.value = null; });
const shown = computed(() => wanted.value ?? current.value);
function step(by: number) {
  if (shown.value === null) return;
  wanted.value = clampSetpoint(shown.value + by);
}
function applySetpoint() {
  const r = props.room;
  const v = wanted.value;
  if (!r || v === null) return;
  ask({ text: t("askSetpoint", { room: r.name, value: number1(v) }), run: async () => { await setSetpoint(r, v); wanted.value = null; } });
}

const together = computed(() => roomLight(props.room?.lamps ?? [], lampStates.value));

function lampSwitch(l: Lamp, on: boolean) {
  ask({ text: t("askSwitch", { name: l.name, state: t(on ? "switchOnWord" : "switchOffWord") }), run: () => switchLamp(l, on) });
}

// dimmers and shutter sliders: the value follows the finger, the question comes when it is released
const dragging = ref<Record<string, number>>({});
const level = (l: Lamp) => dragging.value[l.key] ?? lampStates.value[l.key]?.level ?? 100;
function dimRelease(l: Lamp, e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  ask({ text: t("askDim", { name: l.name, level: v }), run: () => dimLamp(l, v) });
  const { [l.key]: _, ...rest } = dragging.value;
  dragging.value = rest;
}

const closed = (s: Shutter) => dragging.value[s.key] ?? shutterClosed(values[s.position], s);
const shutterName = (s: Shutter, i: number) => s.name || (props.room && props.room.shutters.length > 1 ? `${t("shutter")} ${i + 1}` : t("shutter"));
function shutterTo(s: Shutter, i: number, v: number) {
  const label = v <= 0 ? t("shutterOpen") : v >= 100 ? t("shutterClosed") : `${v} %`;
  ask({ text: t("askShutter", { name: shutterName(s, i), value: label }), run: () => moveShutter(s, v) });
  const { [s.key]: _, ...rest } = dragging.value;
  dragging.value = rest;
}

function roomOff() {
  const r = props.room;
  if (r) ask({ text: t("askRoomOff", { room: r.name }), run: () => switchLamps(r.lamps, false) }, true);
}
</script>

<template>
  <div v-if="room" class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="room-title" data-test="room-dialog">
      <header class="dialog-head">
        <h2 id="room-title" class="dialog-title">{{ room.name }}</h2>
        <button type="button" class="icon-btn" :aria-label="t('close')" @click="emit('close')"><Icon :path="mdiClose" /></button>
      </header>

      <div v-if="room.temperature || room.setpoint" class="climate">
        <Icon class="muted" :path="mdiThermometer" :size="32" />
        <div class="grow">
          <div class="temp">{{ number1(temp) }}<span class="deg">°</span></div>
          <div class="muted small">
            <template v-if="hum !== null">{{ t("humidity") }} {{ Math.round(hum) }} %</template>
            <template v-if="hum !== null && heating !== null"> · </template>
            <template v-if="heating !== null">{{ heating ? t("heating") : t("heatingIdle") }}</template>
          </div>
        </div>
        <div v-if="room.setpoint" class="setpoint">
          <button type="button" class="icon-btn round" :aria-label="t('colder')" data-test="colder" @click="step(-0.5)"><Icon :path="mdiMinus" /></button>
          <div class="setpoint-value">
            <div class="muted small">{{ t("setpoint") }}</div>
            <div class="strong" data-test="setpoint">{{ number1(shown) }}°</div>
          </div>
          <button type="button" class="icon-btn round" :aria-label="t('warmer')" data-test="warmer" @click="step(0.5)"><Icon :path="mdiPlus" /></button>
          <button v-if="wanted !== null && wanted !== current" type="button" class="btn small primary" data-test="apply-setpoint" @click="applySetpoint">OK</button>
        </div>
      </div>

      <div v-if="room.lamps.length" class="list">
        <div class="list-head">
          <span class="label">{{ t("lightCount", { on: together.on, of: together.of }) }}</span>
          <button v-if="together.on" type="button" class="btn small ghost" data-test="room-all-off" @click="roomOff">{{ t("allOff") }}</button>
        </div>
        <div v-for="l in room.lamps" :key="l.key" class="list-row" :data-test="`lamp-${l.name}`">
          <span class="bulb" :class="{ lit: lampStates[l.key]?.on }">
            <Icon :path="lampStates[l.key]?.on ? mdiLightbulbOn : mdiLightbulbOutline" />
          </span>
          <span class="grow">
            <span class="block">{{ l.name }}</span>
            <span v-if="!lampStates[l.key]?.reachable" class="block muted small">{{ t("unreachable") }}</span>
          </span>
          <span v-if="lampStates[l.key]?.on && lampStates[l.key]?.dimmable" class="dimmer">
            <input type="range" min="1" max="100" :value="level(l)" :aria-label="`${t('brightness')} ${l.name}`"
              @input="(e) => (dragging = { ...dragging, [l.key]: Number((e.target as HTMLInputElement).value) })" @change="(e) => dimRelease(l, e)" />
            <span class="muted small num">{{ level(l) }} %</span>
          </span>
          <OnOff large :on="!!lampStates[l.key]?.on" :label="`${l.name}: ${lampStates[l.key]?.on ? t('off') : t('on')}`" @toggle="(on) => lampSwitch(l, on)" />
        </div>
      </div>
      <p v-else class="muted small">{{ t("noLamps") }}</p>

      <div v-for="(s, i) in room.shutters" :key="s.key" class="shutter" :data-test="`shutter-${i}`">
        <div class="shutter-top">
          <Icon class="muted" :path="mdiWindowShutter" />
          <span class="grow">{{ shutterName(s, i) }}</span>
          <strong>{{ closed(s) === null ? "–" : `${closed(s)} %` }}</strong>
        </div>
        <div class="shutter-controls">
          <button type="button" class="icon-btn" :aria-label="t('shutterUp')" @click="shutterTo(s, i, 0)"><Icon :path="mdiArrowUpBold" /></button>
          <input type="range" min="0" max="100" class="grow" :value="closed(s) ?? 0" :aria-label="shutterName(s, i)"
            @input="(e) => (dragging = { ...dragging, [s.key]: Number((e.target as HTMLInputElement).value) })"
            @change="(e) => shutterTo(s, i, Number((e.target as HTMLInputElement).value))" />
          <button type="button" class="icon-btn" :aria-label="t('shutterDown')" @click="shutterTo(s, i, 100)"><Icon :path="mdiArrowDownBold" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
