<script setup lang="ts">
/**
 * Schnell etwas auf die Bring!-Liste, mit Autovervollständigung.
 *
 * Was „schnell" hier heißt:
 *  - Vorschläge ab dem ersten Buchstaben, aus Bring!s Katalog, aus „zuletzt verwendet" und eigenen Artikeln; Tippfehler
 *    („Tomaen") und andere Wörter („Klopapier") werden verstanden. Ein Tipp auf einen Vorschlag = drauf.
 *  - Enter nimmt den ersten (grün umrandeten) Vorschlag. Danach ist das Feld leer und behält den Fokus -- die Tastatur
 *    bleibt offen, der nächste Artikel kann sofort kommen.
 *  - Mengen gleich mit eintippen („3 Äpfel", „500 g Hack", „Milch, laktosefrei") oder einen Mengenknopf tippen.
 *  - Ohne Eingabe stehen die häufigen Artikel da, ein Tipp genügt.
 *  - Was schon drauf steht, ist markiert und wird nicht doppelt angelegt.
 *  - Jeder hinzugefügte Artikel lässt sich mit ✕ zurücknehmen.
 *  - Spracheingabe, wenn das Gerät sie kann („Milch, Brot und Eier" → drei Artikel). Im Kiosk-Browser des
 *    Küchentablets fehlt sie meist; dann erscheint der Knopf nicht.
 * Das Fenster hängt OBEN am Bildschirm: unten liegt am Tablet die Tastatur.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { beiRuhe } from "../../lib/idle";
import {
  LISTEN, inhalt, vorschlaege, haeufige, eingabeZerlegen, hinzufuegen, entfernen, bildUrl, imKatalog, normal,
} from "../../features/bring";
import type { Vorschlag } from "../../features/bring";

const offen = defineModel<boolean>("offen", { default: false });

const listeId = ref(LISTEN[0]!.id);
const text = ref("");
const menge = ref("");
const feld = ref<HTMLInputElement | null>(null);
const sendet = ref(false);
const meldung = ref<{ text: string; fehler: boolean } | null>(null);
/** In diesem Fenster hinzugefügt, neueste zuerst -- zum Zurücknehmen */
const neu = ref<{ name: string; zusatz: string; listeId: string }[]>([]);
const ohneBild = ref(new Set<string>());

const MENGEN = ["2", "3", "4", "6", "10", "500 g", "1 kg", "1 l", "2 l"];

const zerlegt = computed(() => eingabeZerlegen(text.value));
const tippt = computed(() => zerlegt.value.name.length > 0);
const liste = computed(() => vorschlaege(text.value, listeId.value));
const haeufig = computed(() => haeufige(listeId.value));
const drauf = computed(() => inhalt.value[listeId.value] ?? []);
/** Der Zusatz, der beim nächsten Hinzufügen gilt: Mengenknopf vor Getipptem */
const zusatz = computed(() => menge.value || zerlegt.value.zusatz);

function fokus() { void nextTick(() => feld.value?.focus()); }

watch(offen, (o) => {
  if (!o) return;
  text.value = ""; menge.value = ""; meldung.value = null; neu.value = [];
  fokus();
});
watch(listeId, () => { meldung.value = null; fokus(); });

function schliessen() { offen.value = false; }
beiRuhe(schliessen);
function taste(e: KeyboardEvent) { if (e.key === "Escape" && offen.value) schliessen(); }
window.addEventListener("keydown", taste);
onBeforeUnmount(() => window.removeEventListener("keydown", taste));

let meldungUhr: ReturnType<typeof setTimeout> | undefined;
function melden(t: string, fehler = false) {
  meldung.value = { text: t, fehler };
  clearTimeout(meldungUhr);
  meldungUhr = setTimeout(() => { meldung.value = null; }, fehler ? 6000 : 3000);
}

async function nehmen(v: Vorschlag, mitZusatz?: string) {
  if (sendet.value) return;
  const z = (mitZusatz ?? zusatz.value).trim();
  if (v.schonDrauf && !z) {
    melden(`${v.name} steht schon auf „${listenName.value}“.`);
    text.value = ""; fokus();
    return;
  }
  sendet.value = true;
  const ok = await hinzufuegen(listeId.value, v.name, z);
  sendet.value = false;
  if (!ok) { melden("Hat nicht geklappt – ist ioBroker erreichbar?", true); fokus(); return; }
  neu.value = [{ name: v.name, zusatz: z, listeId: listeId.value }, ...neu.value.filter((n) => normal(n.name) !== normal(v.name))];
  melden(`✓ ${v.name}${z ? ` (${z})` : ""} ${v.schonDrauf ? "geändert" : "ist drauf"}`);
  text.value = ""; menge.value = "";
  fokus();
}

function enter() {
  const erster = liste.value[0];
  if (erster) void nehmen(erster);
}

async function zuruecknehmen(n: { name: string; listeId: string }) {
  if (await entfernen(n.listeId, n.name)) {
    neu.value = neu.value.filter((x) => x !== n);
    melden(`${n.name} wieder heruntergenommen`);
  } else melden("Hat nicht geklappt – ist ioBroker erreichbar?", true);
  fokus();
}

async function streichen(name: string) {
  if (await entfernen(listeId.value, name)) melden(`${name} von der Liste genommen`);
  else melden("Hat nicht geklappt – ist ioBroker erreichbar?", true);
}

function mengeWaehlen(m: string) { menge.value = menge.value === m ? "" : m; fokus(); }

const listenName = computed(() => LISTEN.find((l) => l.id === listeId.value)?.name ?? "");

function bild(v: { schluessel?: string; name: string }) {
  const u = bildUrl(v.schluessel);
  return u && !ohneBild.value.has(u) ? u : undefined;
}
function bildFehlt(v: { schluessel?: string }) {
  const u = bildUrl(v.schluessel);
  if (u) ohneBild.value = new Set([...ohneBild.value, u]);
}

// ------------------------------------------------------------------ Spracheingabe (nur wenn das Gerät sie kann)
const Erkennung = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const kannSprechen = !!Erkennung;
const hoert = ref(false);
let erkennung: any = null;
function sprechen() {
  if (!kannSprechen) return;
  if (hoert.value) { erkennung?.stop(); return; }
  erkennung = new Erkennung();
  erkennung.lang = "de-DE"; erkennung.interimResults = false; erkennung.maxAlternatives = 1;
  erkennung.onresult = async (e: any) => {
    const gesagt: string = e.results?.[0]?.[0]?.transcript ?? "";
    // „Milch, Brot und Eier" → drei Artikel
    for (const teil of gesagt.split(/,|\bund\b/i).map((t) => t.trim()).filter(Boolean)) {
      const { name, zusatz: z } = eingabeZerlegen(teil);
      const k = imKatalog(name);
      const n = k?.name ?? name.charAt(0).toUpperCase() + name.slice(1);
      await nehmen({ name: n, schluessel: k?.schluessel, schonDrauf: drauf.value.some((d) => normal(d.name) === normal(n)), haeufig: false }, z);
    }
  };
  erkennung.onend = () => { hoert.value = false; };
  erkennung.onerror = () => { hoert.value = false; melden("Nicht verstanden – bitte tippen.", true); };
  hoert.value = true;
  erkennung.start();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="offen" class="fixed inset-0 z-[1100] bg-black/50 flex justify-center items-start p-3 sm:p-4"
         data-test="bring-fenster" role="dialog" aria-modal="true" aria-label="Auf die Bring!-Liste"
         @click.self="schliessen">
      <div class="w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl shadow-2xl
                  bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <!-- Kopf: Bring!-Rot, Listenwahl, Schließen -->
        <div class="flex items-center gap-3 px-4 py-3 bg-[#EE524F] text-white rounded-t-2xl">
          <i class="pi pi-shopping-cart" style="font-size: 26px" aria-hidden="true"></i>
          <div class="text-xl font-bold mr-2">Auf die Liste</div>
          <div class="flex gap-1 flex-wrap" role="radiogroup" aria-label="Liste">
            <button v-for="l in LISTEN" :key="l.id" type="button" role="radio" :aria-checked="l.id === listeId"
                    :data-test="'bring-liste-' + l.name" @click="listeId = l.id"
                    class="px-3 py-1.5 rounded-full text-sm font-semibold border border-white/70"
                    :class="l.id === listeId ? 'bg-white text-[#C93A37]' : 'bg-transparent text-white'">
              {{ l.name }} <span class="opacity-70">{{ (inhalt[l.id] ?? []).length }}</span>
            </button>
          </div>
          <button type="button" class="ml-auto w-12 h-12 rounded-full hover:bg-white/20" aria-label="Schließen"
                  data-test="bring-schliessen" @click="schliessen">
            <i class="pi pi-times" style="font-size: 22px" aria-hidden="true"></i>
          </button>
        </div>

        <div class="p-4 flex flex-col gap-3">
          <!-- Eingabe -->
          <form class="flex items-center gap-2" @submit.prevent="enter">
            <div class="relative flex-1">
              <input ref="feld" v-model="text" data-test="bring-eingabe" type="text" autocomplete="off" autocapitalize="sentences"
                     enterkeyhint="done" :disabled="sendet"
                     placeholder="Was fehlt? z. B. „3 Äpfel“ oder „Milch, laktosefrei“"
                     class="w-full text-2xl px-4 py-3 pr-12 rounded-xl border-2 border-gray-300 focus:border-[#EE524F] outline-none
                            bg-white dark:bg-gray-900 dark:border-gray-600" />
              <button v-if="text" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                      text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Eingabe leeren"
                      @click="text = ''; fokus()">
                <i class="pi pi-times-circle" style="font-size: 20px" aria-hidden="true"></i>
              </button>
            </div>
            <button v-if="kannSprechen" type="button" data-test="bring-sprechen" @click="sprechen"
                    class="w-14 h-14 rounded-xl border-2" :aria-label="hoert ? 'Zuhören beenden' : 'Sprechen'"
                    :class="hoert ? 'bg-[#EE524F] border-[#EE524F] text-white animate-pulse' : 'border-gray-300 dark:border-gray-600'">
              <i class="pi pi-microphone" style="font-size: 24px" aria-hidden="true"></i>
            </button>
          </form>

          <!-- Mengen: gelten für den nächsten Artikel -->
          <div class="flex items-center gap-2 flex-wrap" data-test="bring-mengen">
            <span class="text-sm text-gray-500 dark:text-gray-400 mr-1">Menge</span>
            <button v-for="m in MENGEN" :key="m" type="button" @click="mengeWaehlen(m)" :data-test="'bring-menge-' + m"
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold border"
                    :class="menge === m ? 'bg-[#EE524F] border-[#EE524F] text-white' : 'border-gray-300 dark:border-gray-600'">
              {{ m }}
            </button>
            <span v-if="zusatz" class="ml-auto text-sm text-gray-600 dark:text-gray-300" data-test="bring-zusatz">
              Zusatz: <b>{{ zusatz }}</b>
            </span>
          </div>

          <!-- Vorschläge beim Tippen, sonst die häufigen -->
          <div>
            <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              {{ tippt ? "Vorschläge – Enter nimmt den ersten" : `Häufig auf „${listenName}“` }}
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" data-test="bring-vorschlaege">
              <button v-for="(v, i) in (tippt ? liste : haeufig)" :key="v.name + i" type="button"
                      :data-test="'bring-vorschlag'" :data-name="v.name" :data-schon="v.schonDrauf ? '1' : '0'"
                      @click="nehmen(v)"
                      class="relative flex items-center gap-3 p-2.5 rounded-xl border-2 text-left min-h-[4.25rem]
                             hover:bg-gray-50 dark:hover:bg-gray-700"
                      :class="[tippt && i === 0 ? 'border-emerald-600 dark:border-emerald-400' : 'border-gray-200 dark:border-gray-700',
                               v.schonDrauf ? 'opacity-60' : '']">
                <!-- Bring!s Bilder sind weiße Strichzeichnungen für rote Kacheln -- auf blassem Grund unsichtbar -->
                <span class="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center bg-[#EE524F]"
                      :class="v.schonDrauf ? 'bg-gray-400 dark:bg-gray-600' : ''">
                  <img v-if="bild(v)" :src="bild(v)" alt="" class="w-9 h-9 object-contain" @error="bildFehlt(v)" />
                  <span v-else class="text-lg font-bold text-white">
                    {{ v.eigen ? "+" : v.name.charAt(0) }}
                  </span>
                </span>
                <span class="min-w-0">
                  <span class="block font-semibold leading-tight truncate">{{ v.eigen ? `„${v.name}“` : v.name }}</span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ v.schonDrauf ? "steht schon drauf" : v.eigen ? "als eigenen Artikel" : v.zusatz ? `zuletzt: ${v.zusatz}` : v.abteilung ?? "" }}
                  </span>
                </span>
              </button>
              <div v-if="!tippt && !haeufig.length" class="col-span-full text-sm text-gray-400 py-3">
                Noch nichts Häufiges – einfach lostippen.
              </div>
            </div>
          </div>

          <!-- Rückmeldung -->
          <div v-if="meldung" data-test="bring-meldung" role="status"
               class="px-3 py-2 rounded-lg text-sm font-semibold"
               :class="meldung.fehler ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                                       : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'">
            {{ meldung.text }}
          </div>

          <!-- Gerade hinzugefügt (zum Zurücknehmen) und was schon drauf steht -->
          <div v-if="neu.length" data-test="bring-neu">
            <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Gerade hinzugefügt</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="n in neu" :key="n.listeId + n.name"
                    class="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-sm">
                {{ n.name }}<span v-if="n.zusatz" class="text-gray-500 dark:text-gray-400">· {{ n.zusatz }}</span>
                <button type="button" class="w-8 h-8 rounded-full hover:bg-black/10" :aria-label="`${n.name} zurücknehmen`"
                        data-test="bring-zuruecknehmen" @click="zuruecknehmen(n)">
                  <i class="pi pi-undo" style="font-size: 13px" aria-hidden="true"></i>
                </button>
              </span>
            </div>
          </div>
          <div data-test="bring-drauf">
            <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Steht schon auf „{{ listenName }}“ ({{ drauf.length }})
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="d in drauf" :key="d.name"
                    class="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm">
                {{ d.name }}<span v-if="d.specification" class="text-gray-500 dark:text-gray-400">· {{ d.specification }}</span>
                <button type="button" class="w-8 h-8 rounded-full hover:bg-black/10" :aria-label="`${d.name} von der Liste nehmen`"
                        data-test="bring-streichen" @click="streichen(d.name)">
                  <i class="pi pi-times" style="font-size: 12px" aria-hidden="true"></i>
                </button>
              </span>
              <span v-if="!drauf.length" class="text-sm text-gray-400">Die Liste ist leer.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
