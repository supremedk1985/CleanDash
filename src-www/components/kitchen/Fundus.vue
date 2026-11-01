<script setup lang="ts">
/**
 * Fundus auf dem Küchen-Dashboard (Daniel, 03.10.2026): ein Knopf, dahinter eine Vollbildseite zum
 * Suchen und Stöbern -- welche Sache liegt in welcher Kiste, und wie viele muss man abheben. Einräumen und
 * Ändern bleiben in der App; seit dem 03.10. nachmittags kann man hier aber ENTNEHMEN (Daniel: „Entnahme von
 * einzelnen Anzahl oder dem ganzen Stück"): rausnehmen mit Anzahl, zurücklegen, verbrauchen.
 *
 * Drei Wege zu einer Sache: suchen (die Suche des Servers mit Tippfehlern und Verwendungszweck), nach
 * Bereich stöbern, oder über die Kisten. Ein Tipp auf eine Sache zeigt sie groß mit ihrem Ort.
 *
 * Aufgebraucht (Daniel, 08.10.2026): Fällt die Menge durch „Verbraucht" auf null, fragt die Kachel sofort „weg damit
 * oder nachkaufen?". Weg damit löscht die Sache (der Server erlaubt das ohne Anmeldung NUR für Aufgebrauchtes);
 * Nachkaufen behält sie -- aber nicht als „0 ×" in der Kiste, sondern auf der Nachkaufliste.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { beiRuhe } from "../../lib/idle";
import {
  fundus, laden, suchen, fotoUrl, ortText, kistenText, mengeText, rausText, filtern, nachStapel,
  mengeZahl, entnehmen, istLeer, nachkaufliste, entfernen,
} from "../../features/fundus";
import type { FuSache, Entnahme } from "../../features/fundus";
import FundusRaeume from "./FundusRaeume.vue";

const offen = ref(false);
const anfrage = ref("");
const treffer = ref<FuSache[] | null>(null);
const sucheLaeuft = ref(false);
const sucheFehler = ref(false);
const ansicht = ref<"sachen" | "kisten" | "raeume">("sachen");
const bereich = ref<string | null>(null);
const kiste = ref<string | null>(null);
const gewaehlt = ref<FuSache | null>(null);
const grossesFoto = ref<string | null>(null);
// Nachkaufliste statt Kisteninhalt (08.10.2026)
const nachkaufen = ref(false);
// Kurze Meldung über der Liste, z. B. nach „Weg damit"
const meldung = ref<string | null>(null);
let meldungUhr: ReturnType<typeof setTimeout> | undefined;
function melden(text: string) {
  meldung.value = text; clearTimeout(meldungUhr);
  meldungUhr = setTimeout(() => { meldung.value = null; }, 6000);
}
onBeforeUnmount(() => clearTimeout(meldungUhr));
const suchfeld = ref<HTMLInputElement | null>(null);

function oeffnen() {
  offen.value = true;
  anfrage.value = ""; treffer.value = null; bereich.value = null; kiste.value = null;
  gewaehlt.value = null; ansicht.value = "sachen"; nachkaufen.value = false; meldung.value = null;
  void laden();
}
function schliessen() { offen.value = false; gewaehlt.value = null; }
// Nach ein paar Minuten ohne Berührung zu -- beim nächsten Öffnen fängt die Seite wieder vorne an (lib/leerlauf.ts)
beiRuhe(schliessen);

function taste(e: KeyboardEvent) {
  if (e.key !== "Escape" || !offen.value) return;
  if (gewaehlt.value) gewaehlt.value = null; else schliessen();
}
window.addEventListener("keydown", taste);
onBeforeUnmount(() => window.removeEventListener("keydown", taste));

// Suche mit kurzer Pause zwischen den Tasten -- nicht bei jedem Buchstaben fragen.
let zeitgeber: ReturnType<typeof setTimeout> | undefined;
let lauf = 0;
watch(anfrage, (q) => {
  clearTimeout(zeitgeber);
  if (!q.trim()) { treffer.value = null; sucheLaeuft.value = false; return; }
  sucheLaeuft.value = true;
  zeitgeber = setTimeout(async () => {
    const meins = ++lauf;
    const r = await suchen(q);
    if (meins !== lauf) return;              // eine neuere Eingabe hat gewonnen
    sucheLaeuft.value = false;
    sucheFehler.value = r === null;
    treffer.value = r ?? [];
  }, 300);
});

const sucht = computed(() => anfrage.value.trim().length > 0);
const liste = computed<FuSache[]>(() =>
  sucht.value ? (treffer.value ?? []) : filtern(fundus.value.sachen, bereich.value, kiste.value, nachkaufen.value));
const leere = computed(() => nachkaufliste(fundus.value.sachen));
function nachkaufenUmschalten() { nachkaufen.value = !nachkaufen.value; ansicht.value = "sachen"; }
const stapel = computed(() => nachStapel(fundus.value.kisten, fundus.value.raeume));

// Schloss für die Ansicht „Räume" (Daniel, 03.10.2026: „nach Entsperren oben rechts die Kiste verschieben"):
// Schutz gegen Versehen am Küchentablet. Sperrt sich zwei Minuten nach dem letzten Umstellen von selbst wieder,
// ebenso beim Schließen der Seite oder beim Wechsel der Ansicht.
const entsperrt = ref(false);
let schlossUhr: ReturnType<typeof setTimeout> | undefined;
function schlossNachstellen() {
  clearTimeout(schlossUhr);
  if (entsperrt.value) schlossUhr = setTimeout(() => { entsperrt.value = false; }, 120_000);
}
function schlossUmlegen() { entsperrt.value = !entsperrt.value; schlossNachstellen(); }
watch([offen, ansicht], () => { entsperrt.value = false; clearTimeout(schlossUhr); });
onBeforeUnmount(() => clearTimeout(schlossUhr));


function sacheZeigen(s: FuSache) {
  gewaehlt.value = s; grossesFoto.value = s.foto; wieviel.value = 1; rueckmeldung.value = null;
}

// Entnehmen: wie viele (nur wenn die Menge eine Zahl über 1 hat), dann „kommt zurück" oder „verbraucht".
const wieviel = ref(1);
const sendet = ref(false);
const rueckmeldung = ref<{ text: string; fehler: boolean } | null>(null);
const gesamt = computed(() => mengeZahl(gewaehlt.value?.menge));
async function entnahme(aktion: Entnahme) {
  const s = gewaehlt.value;
  if (!s || sendet.value) return;
  const n = (gesamt.value ?? 1) > 1 ? wieviel.value : undefined;
  sendet.value = true;
  const neu = await entnehmen(s.id, aktion, aktion === "zurueck" ? undefined : n);
  sendet.value = false;
  if (!neu) { rueckmeldung.value = { text: "Hat nicht geklappt – ist der Server erreichbar?", fehler: true }; return; }
  if (gewaehlt.value?.id === neu.id) gewaehlt.value = neu;
  // auch die Suchtreffer auf den neuen Stand bringen
  if (treffer.value) treffer.value = treffer.value.map((t) => (t.id === neu.id ? neu : t));
  const rest = mengeZahl(neu.menge);
  rueckmeldung.value = {
    fehler: false,
    text: aktion === "zurueck" ? `Wieder in ${neu.kiste?.code ?? "der Kiste"}`
      : aktion === "raus" ? (n ? `${n} als rausgenommen vermerkt` : "Als rausgenommen vermerkt")
      : rest === 0 ? "Aufgebraucht – weg damit oder nachkaufen?" : `Noch ${neu.menge} in ${neu.kiste?.code ?? "der Kiste"}`,
  };
  wieviel.value = 1;
}
// Bei null (08.10.2026): „Weg damit" entfernt die Sache, „Nachkaufen" lässt sie auf der Nachkaufliste.
async function wegDamit() {
  const s = gewaehlt.value;
  if (!s || sendet.value) return;
  sendet.value = true;
  const name = await entfernen(s.id);
  sendet.value = false;
  if (name === null) { rueckmeldung.value = { text: "Hat nicht geklappt – ist der Server erreichbar?", fehler: true }; return; }
  if (treffer.value) treffer.value = treffer.value.filter((t) => t.id !== s.id);
  gewaehlt.value = null;
  melden(`„${s.name}“ ist aus dem Fundus entfernt.`);
}
function aufNachkaufliste() {
  const s = gewaehlt.value;
  gewaehlt.value = null;
  if (s) melden(`„${s.name}“ steht auf der Nachkaufliste.`);
}
function kisteZeigen(code: string) {
  kiste.value = code; bereich.value = null; ansicht.value = "sachen"; anfrage.value = ""; nachkaufen.value = false;
}
function leeren() { anfrage.value = ""; void nextTick(() => suchfeld.value?.focus()); }
</script>

<template>
  <div>
  <!-- Der Knopf: dieselbe Form wie „Kinder anklingeln", aber in Grau -->
  <button type="button" data-test="fundus-knopf" @click="oeffnen"
          class="flex items-center w-full bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700
                 text-white font-bold rounded shadow-xl px-6 py-6">
    <i class="pi pi-box" style="font-size: 54px" aria-hidden="true"></i>
    <div class="h-14 w-px bg-white/40 mx-6"></div>
    <span class="text-left">
      <span class="block text-2xl">Fundus</span>
      <span class="block text-sm font-normal text-white/80">Was liegt in welcher Kiste?</span>
    </span>
  </button>

  <Teleport to="body">
    <div v-if="offen" data-test="fundus-seite" role="dialog" aria-modal="true" aria-label="Fundus"
         class="fixed inset-0 z-[1100] flex flex-col bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <!-- Kopf: Titel, Suche, Schließen -->
      <div class="flex items-center gap-4 px-5 py-3 bg-white dark:bg-gray-800 shadow">
        <button v-if="gewaehlt" type="button" data-test="fundus-zurueck" @click="gewaehlt = null"
                class="w-14 h-14 shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl" aria-label="Zurück zur Liste">
          <i class="pi pi-arrow-left" style="font-size: 26px" aria-hidden="true"></i>
        </button>
        <div class="shrink-0">
          <div class="text-xl font-bold tracking-wide">FUNDUS</div>
          <div class="text-sm text-gray-500 dark:text-gray-400" data-test="fundus-zahlen">
            {{ fundus.sachen.length - leere.length }} Sachen · {{ fundus.kisten.length }} Kisten<template v-if="leere.length"> · {{ leere.length }} nachkaufen</template>
          </div>
        </div>
        <div v-if="!gewaehlt" class="relative flex-1">
          <i class="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" style="font-size: 22px" aria-hidden="true"></i>
          <input ref="suchfeld" v-model="anfrage" type="search" data-test="fundus-suche" enterkeyhint="search"
                 placeholder="Suchen, z. B. „Abisolieren“ oder „M5 Schraube“" aria-label="Suchen"
                 class="w-full h-14 pl-12 pr-12 text-xl rounded-xl border-2 border-gray-300 focus:border-green-700
                        dark:border-gray-600 dark:focus:border-green-500 bg-white dark:bg-gray-900 outline-none" />
          <button v-if="anfrage" type="button" @click="leeren" aria-label="Suche leeren"
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
        <div v-else class="flex-1"></div>
        <button type="button" data-test="fundus-schliessen" @click="schliessen" aria-label="Schließen"
                class="w-14 h-14 shrink-0 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
          <i class="pi pi-times" style="font-size: 26px" aria-hidden="true"></i>
        </button>
      </div>

      <div v-if="fundus.fehler" class="mx-5 mt-3 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
           data-test="fundus-fehler">
        {{ fundus.fehler }}
      </div>

      <!-- Einzelansicht einer Sache -->
      <div v-if="gewaehlt" class="flex-1 overflow-y-auto p-5" data-test="fundus-detail">
        <div class="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">
          <div class="lg:w-1/2">
            <div class="aspect-square rounded-xl bg-white dark:bg-gray-800 overflow-hidden flex items-center justify-center">
              <img v-if="grossesFoto" :src="fotoUrl(grossesFoto, true) ?? ''" :alt="gewaehlt.name" class="w-full h-full object-contain" />
              <i v-else class="pi pi-image text-gray-400" style="font-size: 64px" aria-hidden="true"></i>
            </div>
            <div v-if="gewaehlt.fotos.length > 1" class="flex gap-2 mt-3 overflow-x-auto">
              <button v-for="f in gewaehlt.fotos" :key="f" type="button" @click="grossesFoto = f"
                      class="w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2"
                      :class="f === grossesFoto ? 'border-green-700 dark:border-green-500' : 'border-transparent'"
                      :aria-label="`Foto ${gewaehlt.fotos.indexOf(f) + 1}`">
                <img :src="fotoUrl(f) ?? ''" alt="" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>
          <div class="lg:w-1/2 flex flex-col gap-4">
            <h2 class="text-3xl font-bold leading-tight" data-test="fundus-detail-name">{{ gewaehlt.name }}</h2>
            <div v-if="rausText(gewaehlt)" class="self-start px-3 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 font-semibold">
              {{ rausText(gewaehlt) }}
            </div>
            <div v-if="istLeer(gewaehlt)" data-test="fundus-leer-marke"
                 class="self-start px-3 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-semibold">
              aufgebraucht – nicht mehr in {{ gewaehlt.kiste?.code ?? "der Kiste" }}
            </div>
            <div v-if="gewaehlt.kiste" class="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800">
              <span class="px-4 py-2 rounded bg-amber-400 text-gray-900 text-3xl font-bold" data-test="fundus-detail-kiste">
                {{ gewaehlt.kiste.code }}
              </span>
              <div>
                <div class="text-lg font-semibold">{{ ortText(gewaehlt.kiste) }}</div>
                <div class="text-gray-500 dark:text-gray-400">{{ kistenText(gewaehlt.kiste) }}</div>
              </div>
            </div>
            <!-- Entnehmen (03.10.2026) -->
            <div class="p-4 rounded-xl bg-white dark:bg-gray-800 flex flex-col gap-3" data-test="fundus-entnahme">
              <!-- Aufgebraucht (08.10.2026): weg damit oder nachkaufen? -->
              <template v-if="istLeer(gewaehlt)">
                <div class="text-lg">Aufgebraucht. Soll es ganz aus dem Fundus, oder willst du es nachkaufen?</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" :disabled="sendet" @click="wegDamit" data-test="fundus-weg"
                          class="px-5 py-4 rounded-xl bg-red-700 text-white text-xl font-semibold disabled:opacity-50">
                    Weg damit<span class="block text-sm font-normal opacity-90">aus dem Fundus entfernen</span>
                  </button>
                  <button type="button" :disabled="sendet" @click="aufNachkaufliste" data-test="fundus-nachkaufen"
                          class="px-5 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-xl font-semibold disabled:opacity-50">
                    Nachkaufen<span class="block text-sm font-normal text-gray-500 dark:text-gray-400">bleibt auf der Nachkaufliste</span>
                  </button>
                </div>
              </template>
              <template v-else-if="gewaehlt.raus_seit">
                <button type="button" :disabled="sendet" @click="entnahme('zurueck')" data-test="fundus-zurueck-gelegt"
                        class="px-5 py-4 rounded-xl bg-green-700 text-white text-xl font-semibold disabled:opacity-50">
                  Zurückgelegt in {{ gewaehlt.kiste?.code ?? "die Kiste" }}
                </button>
              </template>
              <template v-else>
                <div v-if="(gesamt ?? 1) > 1" class="flex items-center gap-3 flex-wrap">
                  <span class="text-lg text-gray-500 dark:text-gray-400 mr-1">Wie viele?</span>
                  <button type="button" aria-label="Eins weniger" :disabled="wieviel <= 1" @click="wieviel--"
                          class="w-14 h-14 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-3xl leading-none disabled:opacity-40">−</button>
                  <span class="min-w-[3.5rem] text-center text-3xl font-bold tabular-nums" data-test="fundus-wieviel">{{ wieviel }}</span>
                  <button type="button" aria-label="Eins mehr" :disabled="wieviel >= (gesamt ?? 1)" @click="wieviel++"
                          class="w-14 h-14 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-3xl leading-none disabled:opacity-40">+</button>
                  <button type="button" @click="wieviel = gesamt ?? 1" data-test="fundus-alle"
                          class="px-4 h-14 rounded-xl text-green-800 dark:text-green-400 font-semibold">alle {{ gesamt }}</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" :disabled="sendet" @click="entnahme('raus')" data-test="fundus-raus"
                          class="px-5 py-4 rounded-xl bg-green-700 text-white text-xl font-semibold disabled:opacity-50">
                    Rausnehmen<span class="block text-sm font-normal opacity-90">kommt wieder zurück</span>
                  </button>
                  <button v-if="gesamt !== null" type="button" :disabled="sendet" @click="entnahme('verbraucht')" data-test="fundus-verbraucht"
                          class="px-5 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-xl font-semibold disabled:opacity-50">
                    Verbraucht<span class="block text-sm font-normal text-gray-500 dark:text-gray-400">Menge senken</span>
                  </button>
                </div>
              </template>
              <div v-if="rueckmeldung" data-test="fundus-rueckmeldung" class="text-lg font-semibold"
                   :class="rueckmeldung.fehler ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-400'">
                {{ rueckmeldung.text }}
              </div>
            </div>
            <dl class="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-lg">
              <template v-if="gewaehlt.menge"><dt class="text-gray-500 dark:text-gray-400">Menge</dt><dd>{{ istLeer(gewaehlt) ? "aufgebraucht" : gewaehlt.menge }}</dd></template>
              <template v-if="gewaehlt.bereich"><dt class="text-gray-500 dark:text-gray-400">Bereich</dt><dd>{{ gewaehlt.bereich }}</dd></template>
            </dl>
            <p v-if="gewaehlt.beschreibung" class="text-lg">{{ gewaehlt.beschreibung }}</p>
            <div v-if="gewaehlt.notiz" class="p-4 rounded-xl bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 whitespace-pre-line">
              {{ gewaehlt.notiz }}
            </div>
            <button v-if="gewaehlt.kiste" type="button" @click="kisteZeigen(gewaehlt.kiste.code); gewaehlt = null"
                    class="self-start px-5 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-semibold hover:bg-gray-200 dark:hover:bg-gray-800">
              Was liegt noch in {{ gewaehlt.kiste.code }}?
            </button>
          </div>
        </div>
      </div>

      <!-- Liste -->
      <div v-else class="flex-1 overflow-y-auto px-5 pb-6">
        <div v-if="meldung" data-test="fundus-meldung" class="mt-3 px-4 py-2 rounded-lg bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200 font-semibold">
          {{ meldung }}
        </div>
        <div v-if="!sucht" class="flex items-center gap-3 py-3 flex-wrap">
          <div class="flex rounded-xl bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
            <button v-for="[w, t] in [['sachen', 'Sachen'], ['kisten', 'Kisten'], ['raeume', 'Räume']] as const" :key="w" type="button"
                    @click="ansicht = w" :data-test="`fundus-ansicht-${w}`"
                    class="px-5 h-11 rounded-lg font-semibold"
                    :class="ansicht === w ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100' : 'text-gray-600 dark:text-gray-300'">
              {{ t }}
            </button>
          </div>
          <!-- Nachkaufliste (08.10.2026): nur da, wenn etwas aufgebraucht ist -->
          <button v-if="leere.length || nachkaufen" type="button" @click="nachkaufenUmschalten" data-test="fundus-nachkaufliste"
                  class="h-11 px-4 rounded-full border-2 font-semibold flex items-center gap-2 whitespace-nowrap"
                  :class="nachkaufen ? 'bg-amber-400 border-amber-400 text-gray-900' : 'border-amber-400 text-amber-800 dark:text-amber-300'"
                  :aria-pressed="nachkaufen">
            <i class="pi pi-shopping-cart" aria-hidden="true"></i>
            Nachkaufen · {{ leere.length }}
          </button>
          <button v-if="ansicht === 'raeume'" type="button" @click="schlossUmlegen" data-test="fundus-schloss"
                  class="ml-auto h-11 px-4 rounded-xl border-2 font-semibold flex items-center gap-2"
                  :class="entsperrt ? 'bg-amber-400 border-amber-400 text-gray-900' : 'border-gray-300 dark:border-gray-600'"
                  :aria-pressed="entsperrt">
            <i class="pi" :class="entsperrt ? 'pi-lock-open' : 'pi-lock'" aria-hidden="true"></i>
            {{ entsperrt ? "Sperren" : "Entsperren" }}
          </button>
          <template v-if="ansicht === 'sachen'">
            <button v-if="kiste" type="button" @click="kiste = null" data-test="fundus-kistenfilter"
                    class="h-11 px-4 rounded-full bg-amber-400 text-gray-900 font-bold flex items-center gap-2">
              {{ kiste }} <i class="pi pi-times" aria-hidden="true"></i>
            </button>
            <div class="flex gap-2 overflow-x-auto">
              <button type="button" @click="bereich = null"
                      class="h-11 px-4 rounded-full border whitespace-nowrap"
                      :class="bereich === null ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 dark:border-gray-600'">
                Alle
              </button>
              <button v-for="b in fundus.bereiche" :key="b" type="button" @click="bereich = b" :data-test="`fundus-bereich`"
                      class="h-11 px-4 rounded-full border whitespace-nowrap"
                      :class="bereich === b ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 dark:border-gray-600'">
                {{ b }}
              </button>
            </div>
          </template>
        </div>
        <div v-else class="py-3 text-gray-500 dark:text-gray-400" data-test="fundus-trefferzahl">
          <template v-if="sucheLaeuft">sucht …</template>
          <template v-else-if="sucheFehler">Die Suche hat nicht geantwortet.</template>
          <template v-else>{{ liste.length === 1 ? "1 Treffer" : `${liste.length} Treffer` }}</template>
        </div>

        <!-- Räume (03.10.2026): Fünfer-Raster, Verschieben nach Entsperren -->
        <FundusRaeume v-if="!sucht && ansicht === 'raeume'" :entsperrt="entsperrt" @oeffnen="kisteZeigen" @bewegt="schlossNachstellen" />

        <!-- Kisten nach Stapel -->
        <div v-else-if="!sucht && ansicht === 'kisten'" class="flex flex-col gap-5" data-test="fundus-kisten">
          <div v-for="g in stapel" :key="`${g.raum}|${g.stapel}`">
            <div class="text-lg font-semibold mb-2">{{ g.raum ? `${g.raum} · ` : "" }}{{ g.stapel ? `Stapel ${g.stapel}` : "Ohne Stapel" }}
              <span class="text-sm font-normal text-gray-500 dark:text-gray-400">– oben zuerst</span></div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <button v-for="k in g.kisten" :key="k.code" type="button" @click="kisteZeigen(k.code)"
                      class="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 text-left hover:ring-2 ring-green-600">
                <span class="shrink-0 whitespace-nowrap px-3 py-1 rounded bg-amber-400 text-gray-900 text-2xl font-bold">{{ k.code }}</span>
                <span>
                  <span class="block font-semibold">{{ k.anzahl ?? 0 }} {{ (k.anzahl ?? 0) === 1 ? "Sache" : "Sachen" }}</span>
                  <span class="block text-sm text-gray-500 dark:text-gray-400">{{ ortText(k) }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Sachen als Kacheln -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" data-test="fundus-liste">
          <button v-for="s in liste" :key="s.id" type="button" @click="sacheZeigen(s)" data-test="fundus-sache"
                  class="flex flex-col rounded-xl bg-white dark:bg-gray-800 overflow-hidden text-left hover:ring-2 ring-green-600">
            <div class="relative aspect-square bg-gray-200 dark:bg-gray-700">
              <img v-if="s.foto" :src="fotoUrl(s.foto) ?? ''" alt="" loading="lazy" class="w-full h-full object-cover" />
              <span v-if="s.kiste" class="absolute left-2 bottom-2 px-2 py-0.5 rounded bg-amber-400 text-gray-900 font-bold">
                {{ s.kiste.code }}
              </span>
              <span v-if="s.raus_seit" class="absolute left-2 top-2 px-2 py-0.5 rounded bg-orange-500 text-white text-xs font-bold">raus</span>
              <span v-else-if="istLeer(s)" class="absolute left-2 top-2 px-2 py-0.5 rounded bg-gray-600 text-white text-xs font-bold" data-test="fundus-leer">leer</span>
            </div>
            <div class="p-3">
              <div class="font-semibold leading-snug line-clamp-2">{{ s.name }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                {{ [istLeer(s) ? "aufgebraucht" : mengeText(s.menge), s.bereich].filter((t) => t).join(" · ") }}
              </div>
            </div>
          </button>
          <div v-if="!liste.length && !fundus.laedt && !sucheLaeuft" class="col-span-full py-10 text-center text-xl text-gray-500 dark:text-gray-400"
               data-test="fundus-leer">
            {{ sucht ? "Nichts gefunden. Ein anderes Wort probieren – oder wofür man es braucht." : nachkaufen ? "Nichts nachzukaufen." : "Hier liegt noch nichts." }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>
