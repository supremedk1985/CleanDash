<script setup lang="ts">
/**
 * Die Aufgaben-Kachel (MachIchGleich).
 *
 * Drei Dinge, die man der Kachel ansehen soll, ohne sie zu bedienen:
 *   1. WAS offen ist            -> Titel
 *   2. WEN es angeht            -> Farbstreifen links (einer je Person)
 *   3. WIE eilig es ist         -> Punkt rechts
 * Alles Weitere (Erinnerungstakt, Versuchszeiten) steht in der App. In der
 * Küche will man abhaken, nicht blättern.
 */
import { computed, onMounted, ref } from "vue";
import { beiRuhe } from "../../lib/idle";
import Dialog from "../../compat/primevue/Dialog.vue";
import Button from "../../compat/primevue/Button.vue";
import { aufgaben, abhaken, nebenzeile, HOECHSTENS, poll } from "../../features/aufgaben";
import type { KachelAufgabe } from "../../features/aufgaben";
import AufgabenDialog from "./AufgabenDialog.vue";

const laeuft = ref<string | null>(null);
/** Welche Aufgabe im Popup steht (Text antippen -> Details). */
const offene = ref<KachelAufgabe | null>(null);
const popupOffen = ref(false);
/**
 * Welche Aufgabe gerade abgehakt werden soll.
 *
 * Ein Haken fragt erst nach: Ein Wandtablet wird im Vorbeigehen gestreift --
 * ein verirrter Fingertipp nähme dem anderen sonst still die Erinnerung weg
 * (ein Haken genügt für beide).
 */
const nachfrage = ref<KachelAufgabe | null>(null);

const sichtbare = computed(() => aufgaben.value.aufgaben.slice(0, HOECHSTENS));
const weitere = computed(() => Math.max(0, aufgaben.value.aufgaben.length - HOECHSTENS));

const stand = computed(() =>
  aufgaben.value.stand
    ? aufgaben.value.stand.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null,
);

function farbe(person: string): string {
  return aufgaben.value.personen[person]?.farbe ?? "#9aa3a0";
}

function oeffnen(a: KachelAufgabe) {
  offene.value = a;
  popupOffen.value = true;
}

function fragen(a: KachelAufgabe) {
  if (laeuft.value) return;
  nachfrage.value = a;
}

async function tippen(a: KachelAufgabe) {
  nachfrage.value = null;
  if (laeuft.value) return;
  laeuft.value = a.id;
  await abhaken(a);
  laeuft.value = null;
}

/** Was genau abgehakt wird -- der nächste offene Schritt, nicht die Aufgabe.
 * Die Rückfrage muss das sagen, sonst beantwortet man sie
 *  für etwas anderes, als dann passiert. */
const nachfrageText = computed(() => {
  const a = nachfrage.value;
  if (!a) return "";
  if (a.schritt && a.schritt.von > 1) {
    return `Schritt ${a.schritt.nr} von ${a.schritt.von} abhaken: „${a.schritt.text}“?`;
  }
  if (a.schritt) return `„${a.schritt.text}“ abhaken?`;
  return `„${a.titel}“ als erledigt markieren?`;
});

/** PrimeVue braucht ein schreibbares v-model; die Wahrheit bleibt `nachfrage`. */
const nachfrageOffen = computed({
  get: () => nachfrage.value !== null,
  set: (offen: boolean) => { if (!offen) nachfrage.value = null; },
});

onMounted(() => { if (!aufgaben.value.stand) poll(); });
// Nach ein paar Minuten ohne Berührung: Aufgabe und Rückfrage wieder zu (lib/leerlauf.ts)
beiRuhe(() => { popupOffen.value = false; nachfrage.value = null; });
</script>

<template>
  <card>
    <template #title>
      MachIchGleich
      <small v-if="aufgaben.aufgaben.length">
        {{ aufgaben.aufgaben.length }} offen<span v-if="aufgaben.dringend"> · {{ aufgaben.dringend }} dringend</span>
      </small>
    </template>
    <template #content>
      <!-- Ehrlich sein, wenn der Stand alt ist -- dieselbe Regel wie beim
           ioBroker-Banner oben auf dem Dashboard. -->
      <div v-if="!aufgaben.erreichbar"
           class="mb-2 px-3 py-1 rounded-lg text-sm bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
           data-pruef="nicht-erreichbar">
        MachIchGleich nicht erreichbar<span v-if="stand">, Stand {{ stand }} Uhr</span>
      </div>

      <div v-if="!sichtbare.length" class="px-3 py-4 text-base text-gray-500 dark:text-gray-400"
           data-pruef="leer">
        Nichts offen.
      </div>

      <ul v-else class="flex flex-col" data-pruef="liste">
        <li v-for="a in sichtbare" :key="a.id"
            class="flex items-start gap-3 py-2 border-b last:border-b-0 border-gray-200 dark:border-gray-700"
            :data-pruef="'zeile'" :data-id="a.id">
          <!-- ein Streifen je beteiligter Person -->
          <span class="flex gap-0.5 self-stretch shrink-0" data-pruef="streifen"
                :aria-label="'Beteiligt: ' + a.beteiligte.map(p => aufgaben.personen[p]?.name ?? p).join(', ')">
            <i v-for="p in a.beteiligte" :key="p" class="w-1.5 rounded-full block"
               :style="{ backgroundColor: farbe(p) }" :data-person="p" aria-hidden="true"></i>
          </span>

          <button type="button"
                  class="shrink-0 mt-0.5 w-6 h-6 rounded border-2 border-gray-400 dark:border-gray-500
                         hover:border-emerald-500 disabled:opacity-40 transition-colors"
                  :disabled="laeuft === a.id"
                  :aria-label="'Abhaken: ' + a.titel"
                  :data-pruef="'haken'"
                  @click="fragen(a)"></button>

          <!-- Der Text öffnet die Einzelheiten, der Haken hakt ab. Zwei Ziele
               in einer Zeile, aber jedes mit eigener Fläche -- so trifft man
               im Vorbeigehen nicht das Falsche. -->
          <div class="flex-1 min-w-0 cursor-pointer" data-pruef="text" role="button" tabindex="0"
               :aria-label="'Einzelheiten: ' + a.titel"
               @click="oeffnen(a)" @keydown.enter="oeffnen(a)">
            <div class="font-semibold text-base leading-snug" data-pruef="titel">{{ a.titel }}</div>
            <div v-if="nebenzeile(a, aufgaben.personen)"
                 class="text-sm text-gray-500 dark:text-gray-400 truncate" data-pruef="neben">
              {{ nebenzeile(a, aufgaben.personen) }}
            </div>
          </div>

          <!-- nur die Klammer mit einer Zahl, kein Vorschaubild -->
          <span v-if="a.anhaenge" class="shrink-0 mt-0.5 text-sm text-gray-500 dark:text-gray-400
                       flex items-center gap-0.5" data-pruef="klammer"
                :aria-label="a.anhaenge + ' Anhänge'">
            <span class="pi pi-paperclip text-xs" aria-hidden="true"></span>{{ a.anhaenge }}
          </span>

          <!-- der Punkt sagt, wie eilig -->
          <span class="shrink-0 mt-2 w-3 h-3 rounded-full"
                :class="{
                  'bg-red-500': a.prio === 'dringend',
                  'bg-amber-500': a.prio === 'normal',
                  'border-2 border-gray-400': a.prio === 'kann_warten',
                }"
                :data-pruef="'prio'" :data-prio="a.prio"
                :aria-label="a.prio === 'dringend' ? 'Dringend' : a.prio === 'normal' ? 'Normal' : 'Kann warten'"></span>
        </li>
      </ul>

      <div v-if="weitere" class="pt-2 text-sm text-gray-500 dark:text-gray-400" data-pruef="weitere">
        und {{ weitere }} weitere in der App
      </div>

      <!-- Wartende Aufgaben stehen nicht in der Liste: Hier gehört hin, was man
           im Vorbeigehen tun kann. Ganz verschweigen wäre aber falsch. -->
      <div v-if="aufgaben.wartend" class="pt-2 text-sm text-gray-500 dark:text-gray-400"
           data-pruef="wartend">
        <span class="pi pi-hourglass text-xs mr-1" aria-hidden="true"></span>
        {{ aufgaben.wartend === 1 ? "eine Aufgabe wartet" : aufgaben.wartend + " Aufgaben warten" }}
        auf etwas
      </div>

      <!-- Was schon geschafft ist. Dieselbe Zahl wie in der App, sie überlebt
           das Aufräumen dort. -->
      <div v-if="aufgaben.bilanz.erledigt" class="pt-2 text-sm text-emerald-700 dark:text-emerald-400"
           data-pruef="bilanz">
        <span class="pi pi-check-circle text-xs mr-1" aria-hidden="true"></span>
        {{ aufgaben.bilanz.erledigt }} schon erledigt
      </div>

      <AufgabenDialog v-model:visible="popupOffen" :aufgabe="offene" :personen="aufgaben.personen" />

      <Dialog v-model:visible="nachfrageOffen" modal header="Wirklich erledigt?"
              :style="{ width: '24rem', maxWidth: '92vw' }" data-pruef="nachfrage">
        <p class="text-sm">{{ nachfrageText }}</p>
        <template #footer>
          <Button label="Abbrechen" text data-pruef="nachfrage-nein" @click="nachfrage = null" />
          <Button label="Erledigt" data-pruef="nachfrage-ja"
                  @click="nachfrage && tippen(nachfrage)" />
        </template>
      </Dialog>
    </template>
  </card>
</template>
