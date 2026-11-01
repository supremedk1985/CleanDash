<script setup lang="ts">
/**
 * Ansicht „Räume" der Fundus-Seite (Daniel, 03.10.2026).
 *
 * Fünfer-Raster: „ein Fünfer-Raster soll es sein, mehr Kisten stehen nicht nebeneinander". Jeder Stapel und jede
 * einzelne Kiste belegt einen Platz, ab dem sechsten geht es in der nächsten Reihe weiter. Innerhalb einer Reihe
 * stehen alle auf demselben Boden (items-end), wie im Regal.
 *
 * Verschieben nur nach dem Entsperren (Schloss oben rechts, sperrt sich von selbst wieder): Kiste mit dem Finger
 * ziehen und auf einen Stapel, „neuer Stapel" oder „einzeln" fallen lassen -- in jedem Raum. Ein kurzer Tipp öffnet
 * weiter den Inhalt. Ziele werden über data-Attribute unter dem Finger gesucht (elementsFromPoint), nicht über eigene
 * Koordinatenlisten -- so stimmen sie auch nach dem Weiterblättern.
 */
import { computed, onBeforeUnmount, ref } from "vue";
import { fundus, nachRaum, naechsterStapel, verschieben, ortText } from "../../features/fundus";
import type { FuKiste } from "../../features/fundus";
import FundusRegalKiste from "./FundusRegalKiste.vue";

const props = defineProps<{ entsperrt: boolean }>();
const emit = defineEmits<{ (e: "oeffnen", code: string): void; (e: "bewegt"): void }>();

const raeume = computed(() => nachRaum(fundus.value.kisten, fundus.value.raeume));
const vorschau = computed(() => {
  const m = new Map<string, string[]>();
  for (const s of fundus.value.sachen) {
    const c = s.kiste?.code;
    if (!c || !s.foto) continue;
    const l = m.get(c) ?? [];
    if (l.length < 3) { l.push(s.foto); m.set(c, l); }
  }
  return m;
});

type Zelle =
  | { art: "stapel"; schluessel: string; raum: string; stapel: string; kisten: FuKiste[]; neu?: boolean }
  | { art: "einzeln"; schluessel: string; raum: string; kiste: FuKiste | null };

/** Die Plätze eines Raums im Raster; beim Ziehen kommen „neuer Stapel" und ein freier Einzelplatz dazu. */
function zellen(r: (typeof raeume.value)[number]): Zelle[] {
  const z: Zelle[] = r.stapel.map((s) => ({ art: "stapel", schluessel: `s:${s.stapel}`, raum: r.raum, stapel: s.stapel, kisten: s.kisten }));
  for (const k of r.lose) z.push({ art: "einzeln", schluessel: `e:${k.code}`, raum: r.raum, kiste: k });
  if (zug.value?.aktiv) {
    const neu = naechsterStapel(fundus.value.kisten, r.raum);
    z.push({ art: "stapel", schluessel: `s:${neu}`, raum: r.raum, stapel: neu, kisten: [], neu: true });
    z.push({ art: "einzeln", schluessel: "e:frei", raum: r.raum, kiste: null });
  }
  return z;
}

// ---------------------------------------------------------------- Ziehen
interface Zug { kiste: FuKiste; startX: number; startY: number; x: number; y: number; dx: number; dy: number; breite: number; aktiv: boolean }
const zug = ref<Zug | null>(null);
const ziel = ref<{ raum: string; stapel: string; position: number; schluessel: string } | null>(null);
const meldung = ref<{ text: string; fehler: boolean } | null>(null);
let blaettern = 0;
let scroller: HTMLElement | null = null;

function runter(e: PointerEvent, k: FuKiste) {
  if (!props.entsperrt || e.button !== 0) return;
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  scroller = (e.currentTarget as HTMLElement).closest(".overflow-y-auto");
  zug.value = { kiste: k, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
    dx: e.clientX - r.left, dy: e.clientY - r.top, breite: r.width, aktiv: false };
  window.addEventListener("pointermove", bewegen);
  window.addEventListener("pointerup", los);
  window.addEventListener("pointercancel", abbrechen);
}

function bewegen(e: PointerEvent) {
  const z = zug.value;
  if (!z) return;
  z.x = e.clientX; z.y = e.clientY;
  // Erst ab ein paar Pixeln ist es ein Ziehen -- ein Tipp bleibt ein Tipp.
  if (!z.aktiv && Math.hypot(z.x - z.startX, z.y - z.startY) > 8) { z.aktiv = true; blaettern = requestAnimationFrame(randBlaettern); }
  if (z.aktiv) { e.preventDefault(); ziel.value = zielUnter(z); }
}

/** Was liegt unter dem Finger? Eine Zelle (data-zelle) und darin die Kisten (data-kiste) für den Platz. */
function zielUnter(z: Zug) {
  const zelle = document.elementsFromPoint(z.x, z.y).find((el) => (el as HTMLElement).dataset?.zelle) as HTMLElement | undefined;
  if (!zelle) return null;
  const { raum = "", stapel = "", zelle: schluessel = "" } = zelle.dataset;
  if (!stapel) return { raum, stapel: "", position: 1, schluessel };
  const andere = [...zelle.querySelectorAll<HTMLElement>("[data-kiste]")].filter((el) => el.dataset.kiste !== z.kiste.code);
  const darueber = andere.filter((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 < z.y; }).length;
  return { raum, stapel, position: darueber + 1, schluessel };
}

function randBlaettern() {
  const z = zug.value;
  if (!z?.aktiv) return;
  if (scroller) {
    const r = scroller.getBoundingClientRect();
    const rand = 90;
    const tiefe = z.y < r.top + rand ? -(r.top + rand - z.y) / rand : z.y > r.bottom - rand ? (z.y - (r.bottom - rand)) / rand : 0;
    if (tiefe) { scroller.scrollTop += Math.max(-1, Math.min(1, tiefe)) * 18; ziel.value = zielUnter(z); }
  }
  blaettern = requestAnimationFrame(randBlaettern);
}

function aufraeumen() {
  window.removeEventListener("pointermove", bewegen);
  window.removeEventListener("pointerup", los);
  window.removeEventListener("pointercancel", abbrechen);
  cancelAnimationFrame(blaettern);
}

async function los() {
  const z = zug.value, zi = ziel.value;
  aufraeumen();
  zug.value = null; ziel.value = null;
  if (!z) return;
  if (!z.aktiv) { emit("oeffnen", z.kiste.code); return; }
  if (!zi) return;
  const k = z.kiste;
  const gleich = (k.raum ?? "") === zi.raum && k.stapel === zi.stapel && (zi.stapel === "" || k.position === zi.position);
  if (gleich) return;
  emit("bewegt");
  const fehler = await verschieben(k.code, { raum: zi.raum, stapel: zi.stapel, position: zi.position });
  const jetzt = fundus.value.kisten.find((x) => x.code === k.code);
  meldung.value = fehler ? { text: fehler, fehler: true } : { text: `${k.code} steht jetzt: ${ortText(jetzt)}`, fehler: false };
}

function abbrechen() { aufraeumen(); zug.value = null; ziel.value = null; }
onBeforeUnmount(aufraeumen);

/** Wo die Einfügemarke in einem Stapel steht: vor der Kiste mit diesem Index (mit der gezogenen mitgezählt). */
function markeVor(z: Zelle): number | null {
  if (z.art !== "stapel" || ziel.value?.schluessel !== z.schluessel || ziel.value.raum !== z.raum || !zug.value) return null;
  const ohne = z.kisten.filter((k) => k.code !== zug.value!.kiste.code);
  const vor = ohne[ziel.value.position - 1];
  return vor ? z.kisten.indexOf(vor) : z.kisten.length;
}
const istZiel = (z: Zelle) => ziel.value?.schluessel === z.schluessel && ziel.value.raum === z.raum;
</script>

<template>
  <div class="flex flex-col gap-6 pb-4" data-test="fundus-raeume">
    <div v-if="entsperrt" class="px-4 py-3 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
         data-test="fundus-entsperrt-hinweis">
      Entsperrt: Kiste mit dem Finger ziehen und auf einen Stapel, „neuer Stapel" oder „einzeln" fallen lassen – auch in einen
      anderen Raum. Sperrt sich nach zwei Minuten von selbst.
    </div>
    <div v-if="meldung" class="text-lg font-semibold" data-test="fundus-raeume-meldung"
         :class="meldung.fehler ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-400'">{{ meldung.text }}</div>

    <section v-for="r in raeume" :key="r.raum || '-'" data-test="fundus-raum"
             class="rounded-2xl bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <header class="flex items-center gap-3 mb-5">
        <span class="w-11 h-11 rounded-xl bg-green-700 text-white flex items-center justify-center shrink-0">
          <i class="pi" :class="r.raum ? 'pi-home' : 'pi-question'" style="font-size: 20px" aria-hidden="true"></i>
        </span>
        <div>
          <h3 class="text-2xl font-bold leading-tight" data-test="fundus-raum-name">{{ r.raum || "Ohne Raum" }}</h3>
          <div class="text-gray-500 dark:text-gray-400">
            {{ r.kisten === 1 ? "1 Kiste" : `${r.kisten} Kisten` }} · {{ r.sachen === 1 ? "1 Sache" : `${r.sachen} Sachen` }}
            <template v-if="r.stapel.length"> · {{ r.stapel.length === 1 ? "1 Stapel" : `${r.stapel.length} Stapel` }}</template>
          </div>
        </div>
      </header>
      <!-- Fünfer-Raster: Stapel und einzelne Kisten belegen je einen Platz, gemeinsamer Boden je Reihe -->
      <div class="grid grid-cols-5 gap-x-4 gap-y-6 items-end">
        <div v-for="z in zellen(r)" :key="z.schluessel" class="min-w-0 flex flex-col rounded-lg"
             :class="istZiel(z) ? 'bg-green-600/15 ring-2 ring-green-600 p-1 -m-1' : ''"
             :data-zelle="z.schluessel" :data-raum="z.raum" :data-stapel="z.art === 'stapel' ? z.stapel : ''"
             data-test="fundus-raum-platz">
          <div class="flex flex-col gap-1.5">
            <template v-if="z.art === 'stapel'">
              <template v-for="(k, i) in z.kisten" :key="k.code">
                <div v-if="markeVor(z) === i" class="h-1 rounded-full bg-green-600" data-test="fundus-marke"></div>
                <div :data-kiste="k.code" @pointerdown="runter($event, k)"
                     :class="[entsperrt ? 'touch-none cursor-grab' : '', zug?.aktiv && zug.kiste.code === k.code ? 'opacity-30' : '']">
                  <FundusRegalKiste :kiste="k" :fotos="vorschau.get(k.code) ?? []" @oeffnen="(c) => !entsperrt && emit('oeffnen', c)" />
                </div>
              </template>
              <div v-if="markeVor(z) === z.kisten.length && z.kisten.length" class="h-1 rounded-full bg-green-600" data-test="fundus-marke"></div>
              <div v-if="!z.kisten.length" class="h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600
                   flex items-center justify-center text-gray-500 dark:text-gray-400">hier ablegen</div>
            </template>
            <template v-else>
              <div v-if="z.kiste" :data-kiste="z.kiste.code" @pointerdown="runter($event, z.kiste!)"
                   :class="[entsperrt ? 'touch-none cursor-grab' : '', zug?.aktiv && zug.kiste.code === z.kiste.code ? 'opacity-30' : '']">
                <FundusRegalKiste :kiste="z.kiste" :fotos="vorschau.get(z.kiste.code) ?? []" @oeffnen="(c) => !entsperrt && emit('oeffnen', c)" />
              </div>
              <div v-else class="h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600
                   flex items-center justify-center text-gray-500 dark:text-gray-400">hier ablegen</div>
            </template>
          </div>
          <div class="h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-2"></div>
          <div class="mt-1.5 text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase truncate">
            <template v-if="z.art === 'stapel'">{{ z.neu ? `Neu: Stapel ${z.stapel}` : `Stapel ${z.stapel}` }}</template>
            <template v-else>einzeln</template>
          </div>
        </div>
      </div>
    </section>
    <div v-if="!raeume.length && !fundus.laedt" class="py-10 text-center text-xl text-gray-500 dark:text-gray-400">Noch keine Kisten.</div>
    <p class="text-gray-500 dark:text-gray-400">
      Antippen zeigt, was in der Kiste liegt. Zum Umstellen oben rechts entsperren; Räume legt man in der App an.
    </p>

    <!-- Die gezogene Kiste folgt dem Finger -->
    <div v-if="zug?.aktiv" class="fixed z-[70] pointer-events-none opacity-90 shadow-2xl rounded-lg"
         :style="{ left: `${zug.x - zug.dx}px`, top: `${zug.y - zug.dy}px`, width: `${zug.breite}px` }" data-test="fundus-geist">
      <FundusRegalKiste :kiste="zug.kiste" :fotos="vorschau.get(zug.kiste.code) ?? []" />
    </div>
  </div>
</template>
