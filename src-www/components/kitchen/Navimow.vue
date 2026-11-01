<script setup lang="ts">
/**
 * Navimow.vue -- der Mähroboter im Garten.
 *
 * Von oben nach unten: Titel mit Verbindungs-Badge, Hinweiskasten (Adapter ohne Cloud),
 * Statusbox, Karte mit Live-Position, Tasten, Rückmeldezeile, Kennzahlen, Fußzeile --
 * im Kleid der Staubsauger-Kachel, damit sie kein Fremdkörper ist.
 *
 * Ihr eigentlicher Zweck ist aber weiterhin das Popup: Wenn der Mäher Hilfe braucht
 * (Störung, angehoben, festgefahren), legt es sich über die GANZE Kachel, also auch über
 * die Tasten -- erst „Alles klar!", dann steuern. Dasselbe Muster wie Tonnenticker und
 * Staubsauger, mit LocalStorage je Problem: Verschwindet ein Problem, fällt seine
 * Bestätigung weg, und beim nächsten Mal meldet es sich wieder.
 */
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { beiRuhe } from "../../lib/idle";
import {
  navimow,
  maeherMeldungen,
  zustandText,
  akkuAnzeige,
  flaecheAnzeige,
  hinweisText,
  uhrzeit,
  navimowAktionen,
  navimowTippen,
  navimowAufraeumen,
  karteLaden,
  karte,
  kartenFrame,
  station,
  karteStand,
  karteFehlgeschlagen,
  karteBildDefekt,
  rasen,
  befehlLaeuft,
  befehlOffen,
  befehlMeldung,
  bestaetigung,
  AKTION_TEXT,
  POSITION_VERALTET_S,
  POSITION_UNBRAUCHBAR_S,
} from "../../features/navimow";
import type { NavimowAktion } from "../../features/navimow";
import { backendErreichbar } from "../../compat/iobroker";
import { logger } from "../../lib/logger";
import NavimowKarte from "./NavimowKarte.vue";
import NavimowKarteDialog from "./NavimowKarteDialog.vue";

// Eine langsam tickende Uhr für alles, was vom Alter eines Wertes abhängt („Stand 14:32").
// 30 s reichen -- die Schwellen liegen bei Minuten.
const jetzt = ref(Date.now());
let uhr: ReturnType<typeof setInterval> | null = null;

const zustand = computed(() => navimow.value.zustand);
const maeht = computed(() => zustand.value === "isRunning");
const aktiv = computed(() => maeht.value || zustand.value === "isPaused");
const inStation = computed(() => zustand.value === "isDocked");
const stoerung = computed(() => zustand.value === "Error" || zustand.value === "isLifted");

// ─── Titel-Badge: drei getrennte Wahrheitsquellen ───
const badge = computed(() => {
  if (!backendErreichbar.value) return { text: "ioBroker?", klasse: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" };
  if (!navimow.value.adapterVerbunden) return { text: "Adapter getrennt", klasse: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400" };
  if (zustand.value === "Offline") return { text: "Offline", klasse: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" };
  return { text: "Online", klasse: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" };
});

// ─── Statusbox ───
const akkuIcon = computed(() => {
  const p = navimow.value.akku ?? 0;
  if (inStation.value) return "mdi-battery-charging";
  if (p <= 10) return "mdi-battery-alert-variant-outline";
  const stufe = Math.min(90, Math.floor(p / 10) * 10);
  return stufe <= 0 ? "mdi-battery-outline" : `mdi-battery-${stufe}`;
});

const zustandIcon = computed(() => {
  switch (zustand.value) {
    case "isRunning": return "mdi-robot-mower";
    case "isDocked": return "mdi-home-import-outline";
    case "isDocking": return "mdi-home-import-outline";
    case "isLifted": return "mdi-arrow-up-bold-box";
    case "Error": return "mdi-alert-circle";
    case "Offline": return "mdi-lan-disconnect";
    case "": return "mdi-robot-mower-outline";
    default: return zustandText(zustand.value) === "unbekannt" ? "mdi-help-circle-outline" : "mdi-robot-mower-outline";
  }
});

const hinweis = computed(() => hinweisText(navimow.value, jetzt.value));

// ─── Karte ───
const dialogOffen = ref(false);
// Die große Mähkarte schließt sich nach ein paar Minuten Ruhe; der Hilferuf bleibt bewusst stehen (lib/leerlauf.ts).
beiRuhe(() => { dialogOffen.value = false; });
/** <img @error>: Platzhalter zeigen; der nächste Kartenabruf versucht es neu. */
function bildDefektMelden() {
  karteBildDefekt.value = true;
}
function karteTippen() {
  dialogOffen.value = true;
  // Ein Abruf, wenn der letzte > 30 s her ist -- entscheidet kartenLadenNoetig.
  karteLaden("dialog").catch(() => undefined);
}

const positionUnbrauchbar = computed(
  () => navimow.value.positionAlterSek > POSITION_UNBRAUCHBAR_S,
);
const positionVeraltet = computed(
  () => navimow.value.positionVeraltet || navimow.value.positionAlterSek > POSITION_VERALTET_S,
);

/** Der Live-Mäher auf der Karte -- null heißt ausgeblendet. Farbe nach Zustand. */
const maeherOverlay = computed(() => {
  const m = navimow.value;
  if (!m.adapterVerbunden || inStation.value || positionUnbrauchbar.value) return null;
  if (m.x === 0 && m.y === 0) return null;
  let klasse: string;
  if (positionVeraltet.value) klasse = "text-gray-500 opacity-50";
  else if (m.zustand === "isRunning") klasse = m.stillstandMin >= 3 ? "text-orange-500" : "text-green-500 animate-pulse";
  else if (m.zustand === "isDocking") klasse = "text-blue-500";
  else if (stoerung.value) klasse = "text-orange-500";
  else klasse = "text-gray-500";
  return { x: m.x, y: m.y, klasse };
});

function positionsAlter(sek: number): string {
  if (sek < 60) return `vor ${Math.round(sek)} s`;
  return `vor ${Math.floor(sek / 60)} min`;
}

const fusszeile = computed(() => {
  const teile: string[] = [];
  if (karteStand.value !== null) {
    teile.push(`Karte ${uhrzeit(karteStand.value)}${karteFehlgeschlagen.value ? " (Neuladen fehlgeschlagen)" : ""}`);
  }
  teile.push(`Position ${positionsAlter(navimow.value.positionAlterSek)}`);
  if (!navimow.value.adapterVerbunden) teile.push("Adapter getrennt");
  return teile.join(" · ");
});
const fusszeileOrange = computed(() => positionVeraltet.value || karteFehlgeschlagen.value);

// ─── Tasten ───
const aktionen = computed(() =>
  navimowAktionen(zustand.value, navimow.value.adapterVerbunden, backendErreichbar.value),
);
const AKTION_META: Record<NavimowAktion, { icon: string; klasse: string }> = {
  start: { icon: "mdi-play", klasse: "bg-green-500 hover:bg-green-600 text-white" },
  weiter: { icon: "mdi-play", klasse: "bg-green-500 hover:bg-green-600 text-white" },
  pause: { icon: "mdi-pause", klasse: "bg-orange-400 hover:bg-orange-500 text-white" },
  station: { icon: "mdi-home-import-outline", klasse: "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100" },
};
/** Die gedrückte Taste zeigt den Spinner statt der Ikone, solange die Sperre läuft. */
const gedrueckt = ref<NavimowAktion | null>(null);

async function tippen(a: NavimowAktion) {
  gedrueckt.value = a;
  const ergebnis = await navimowTippen(a);
  if (ergebnis === "bestaetigen" || ergebnis === "verworfen") gedrueckt.value = null;
}
watch(befehlLaeuft, (laeuft) => {
  if (!laeuft) gedrueckt.value = null;
});

// Der Rückfall nach 5 s kommt aus dem Modul (bestaetigung wird dort wieder null).
function wartetAufBestaetigung(a: NavimowAktion) {
  return bestaetigung.value?.aktion === a;
}

const meldungKlasse = computed(() => {
  switch (befehlMeldung.value?.art) {
    case "ok": return "text-green-600 dark:text-green-400";
    case "warnung": return "text-orange-500";
    case "fehler": return "text-red-600 dark:text-red-400";
    default: return "";
  }
});

// ─── Kennzahlen ───
function akkuFarbe(p: number) {
  if (p <= 0) return ""; // 0 heißt „nichts gemessen", nicht „leer" -- dann steht ohnehin die Cloud-Stufe da
  if (p <= 20) return "text-red-500";
  if (p <= 50) return "text-orange-400";
  return "";
}

// ─── Popup, gleiches Muster wie Tonnenticker und Staubsauger ───
const SPEICHER_KEY = "navimowBestaetigt";
const meldungen = computed(() => maeherMeldungen(navimow.value));
const offeneMeldungen = ref<ReturnType<typeof maeherMeldungen>>([]);

function bestaetigte(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SPEICHER_KEY) || "[]"));
  } catch (err: any) {
    // LocalStorage kann in Kiosk-WebViews mit abgeschaltetem DOM-Storage werfen.
    // Dann lieber melden als schweigen.
    logger.warn("navimow.localStorage.read.failed", { error: err?.message || String(err) });
    return new Set();
  }
}
function speichereBestaetigte(s: Set<string>) {
  try {
    localStorage.setItem(SPEICHER_KEY, JSON.stringify([...s]));
  } catch (err: any) {
    logger.warn("navimow.localStorage.write.failed", { error: err?.message || String(err) });
  }
}
function pruefeMeldungen() {
  const aktuell = new Set(meldungen.value.map((m) => m.schluessel));
  const best = bestaetigte();
  // Bestätigungen NUR aufräumen, wenn wir überhaupt wissen, wie es dem Mäher geht.
  // Gefunden am 13.09. von einem Playwright-Test: Direkt nach dem Laden der Seite ist
  // `zustand` leer und die Meldungsliste damit leer -- nicht weil die Probleme weg sind,
  // sondern weil noch nichts abgerufen wurde. Wer in diesem Moment aufräumt, löscht die
  // Bestätigung, und beim ersten Abruf kommt dasselbe Popup wieder. Im Kiosk, der die Seite
  // nachts neu lädt, hätte der Mäher jeden Morgen erneut „Hilfe" gerufen.
  const datenDa = !!navimow.value.zustand;
  let geaendert = false;
  if (datenDa) {
    for (const k of [...best]) if (!aktuell.has(k)) { best.delete(k); geaendert = true; }
  }
  if (geaendert) speichereBestaetigte(best);
  offeneMeldungen.value = meldungen.value.filter((m) => !best.has(m.schluessel));
}
function bestaetigen() {
  const best = bestaetigte();
  for (const m of meldungen.value) best.add(m.schluessel);
  speichereBestaetigte(best);
  offeneMeldungen.value = [];
}

onMounted(() => {
  pruefeMeldungen();
  uhr = setInterval(() => { jetzt.value = Date.now(); }, 30_000);
});
onUnmounted(() => {
  if (uhr) clearInterval(uhr);
  navimowAufraeumen();
});
watch(
  () => [navimow.value.zustand, navimow.value.stillstandMin, navimow.value.adapterVerbunden],
  () => pruefeMeldungen(),
  { immediate: true },
);
</script>

<template>
  <div class="relative">
    <!-- Hilferuf: über der GANZEN Kachel, auch über den Tasten -->
    <div
      v-if="offeneMeldungen.length"
      data-test="hilferuf"
      class="absolute inset-0 flex items-center justify-center bg-black/50 z-50 rounded p-4"
    >
      <div class="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
        <i aria-hidden="true" class="mdi mdi-robot-mower text-5xl text-orange-500"></i>
        <p class="text-2xl font-bold mt-2 mb-4 dark:text-white">Der Mäher braucht Hilfe</p>
        <ul class="text-left text-lg mb-6 space-y-2 dark:text-gray-100">
          <li v-for="m in offeneMeldungen" :key="m.schluessel" class="flex items-start gap-2">
            <i aria-hidden="true" class="mdi text-2xl text-orange-500" :class="m.icon"></i>
            <span>{{ m.text }}</span>
          </li>
        </ul>
        <button
          @click="bestaetigen"
          class="bg-blue-600 text-white text-xl font-semibold px-8 py-4 rounded-full hover:bg-blue-700 transition"
        >
          Alles klar!
        </button>
      </div>
    </div>

    <card>
      <template #title>
        <div class="flex items-center justify-between w-full">
          <span>Rasenmäher</span>
          <span data-test="badge" class="text-xs font-normal px-2 py-0.5 rounded-full" :class="badge.klasse">
            {{ badge.text }}
          </span>
        </div>
      </template>

      <template #content>
        <!-- Adapter ohne Cloud-Verbindung: dann sind alle Werte unten alt - das muss man sehen -->
        <div
          v-if="!navimow.adapterVerbunden"
          data-test="hinweiskasten"
          class="flex items-center gap-2 px-4 py-2 rounded-xl mb-3 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-sm"
        >
          <i aria-hidden="true" class="mdi mdi-cloud-off-outline text-xl"></i>
          <span>Keine Verbindung zur Navimow-Cloud – die Werte sind der letzte bekannte Stand.</span>
        </div>

        <!-- Statusbox -->
        <div
          data-test="statusbox"
          class="flex items-center gap-3 px-4 py-2 rounded-xl mb-3 transition-colors duration-300"
          :class="
            stoerung
              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          "
        >
          <i aria-hidden="true" class="mdi text-3xl" :class="[zustandIcon, { 'animate-pulse': maeht }]"></i>
          <div class="flex-1">
            <div class="font-semibold text-lg" data-test="zustand">{{ zustandText(zustand) }}</div>
            <div class="text-sm flex items-center gap-1">
              <i aria-hidden="true" class="mdi" :class="akkuIcon"></i>
              <span>{{ akkuAnzeige(navimow) }}</span>
              <template v-if="aktiv">
                <span class="mx-1">·</span>
                <span data-test="fortschritt">{{ navimow.fortschritt !== null ? `${navimow.fortschritt} % gemäht` : "Fortschritt noch unbekannt" }}</span>
              </template>
            </div>
            <div v-if="hinweis" data-test="hinweis" class="text-sm" :class="hinweis.farbe === 'orange' ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'">
              {{ hinweis.text }}
            </div>
          </div>
        </div>

        <!-- Karte: immer sichtbar, Tipp öffnet sie groß -->
        <div class="mb-3">
          <NavimowKarte
            :bild="karte"
            :frame="kartenFrame"
            :station="station"
            :maeher="maeherOverlay"
            :bild-defekt="karteBildDefekt"
            :rasen="rasen"
            :winkel="navimow.winkel"
            @bildfehler="bildDefektMelden"
            @tipp="karteTippen"
          />
          <ProgressBar
            v-if="aktiv && navimow.fortschritt !== null && navimow.fortschritt > 0"
            :value="navimow.fortschritt"
            :show-value="false"
            style="height: 0.6rem"
            class="mt-2"
          />
        </div>
        <NavimowKarteDialog
          v-model:visible="dialogOffen"
          :bild="karte"
          :frame="kartenFrame"
          :station="station"
          :maeher="maeherOverlay"
          :bild-defekt="karteBildDefekt"
          :fusszeile="fusszeile"
          :rasen="rasen"
          :winkel="navimow.winkel"
        />

        <!-- Tasten: höchstens zwei, eine für „Machen", eine für „Heim" -->
        <div v-if="aktionen.length" data-test="tasten" class="grid gap-2 mb-3" :class="aktionen.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
          <template v-for="a in aktionen" :key="a">
            <!-- Befehl geschickt, Antwort offen: die Taste wird zur Pille -->
            <div
              v-if="befehlOffen?.aktion === a"
              data-test="pille"
              class="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-center"
            >
              <i aria-hidden="true" class="mdi mdi-loading mdi-spin text-2xl"></i>
              <span>{{ AKTION_TEXT[a] }} geschickt … <span class="font-normal">Antwort dauert 1–2 min</span></span>
            </div>
            <button
              v-else-if="wartetAufBestaetigung(a)"
              type="button"
              :disabled="befehlLaeuft"
              @click="tippen(a)"
              class="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-lg shadow transition-colors disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white"
            >
              <i aria-hidden="true" class="mdi mdi-check text-2xl"></i>
              <span>Wirklich mähen?</span>
            </button>
            <button
              v-else
              type="button"
              :disabled="befehlLaeuft"
              @click="tippen(a)"
              class="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-lg shadow transition-colors disabled:opacity-50"
              :class="AKTION_META[a].klasse"
            >
              <i aria-hidden="true" class="mdi text-2xl" :class="gedrueckt === a && befehlLaeuft ? 'mdi-loading mdi-spin' : AKTION_META[a].icon"></i>
              <span>{{ AKTION_TEXT[a] }}</span>
            </button>
          </template>
        </div>

        <!-- Rückmeldezeile: nur nach einem Befehl -->
        <div v-if="befehlMeldung" data-test="rueckmeldung" class="text-sm mb-3" :class="meldungKlasse">
          {{ befehlMeldung.text }}
        </div>

        <!-- Kennzahlen -->
        <div class="grid grid-cols-3 gap-1 text-center mb-1">
          <div>
            <div class="text-lg font-bold truncate" :class="akkuFarbe(navimow.akku)">{{ akkuAnzeige(navimow) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Akku</div>
          </div>
          <div>
            <div class="text-lg font-bold truncate">{{ flaecheAnzeige(navimow.wochenFlaeche) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Diese Woche</div>
          </div>
          <div>
            <div class="text-lg font-bold truncate">{{ flaecheAnzeige(navimow.letzteFlaeche) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Zuletzt</div>
          </div>
        </div>

        <!-- Fußzeile: Kartenzeit und Positionsalter getrennt -- sie zu mischen wäre die
             Vermischung, die am 04.09. fünf Wochen Konserve verborgen hat -->
        <div data-test="fusszeile" class="text-right text-xs mt-2" :class="fusszeileOrange ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'">
          {{ fusszeile }}
        </div>
      </template>
    </card>
  </div>
</template>
