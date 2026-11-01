<script setup lang="ts">
/**
 * Die Einzelheiten einer Aufgabe -- als Popup auf dem Küchendashboard.
 *
 * Daniel am 13.09.: „Wenn man auf dem Dashboard auf den Text klickt, dann
 * sollen die Details in einem Popup kommen."
 *
 * Es ist bewusst eine LESE-Ansicht: In der Küche steht man im Vorbeigehen davor
 * und will wissen, was zu der Zeile gehört -- alle Schritte, die Notiz, wie oft
 * schon versucht wurde. Geändert wird in der App, wo man angemeldet ist und
 * weiß, wer man ist. Das Einzige, was hier geht, ist Abhaken (Entscheidung 13),
 * und dafür gibt es den Knopf in der Zeile.
 */
import { computed } from "vue";
import Dialog from "../../compat/primevue/Dialog.vue";
import { notizZeilen, vorWieLange, nebenzeile } from "../../features/aufgaben";
import type { KachelAufgabe, KachelPerson } from "../../features/aufgaben";

const props = defineProps<{
  aufgabe: KachelAufgabe | null;
  personen: Record<string, KachelPerson>;
}>();

const visible = defineModel<boolean>("visible", { default: false });

const notiz = computed(() => notizZeilen(props.aufgabe?.notiz));

function name(id: string | undefined): string {
  if (!id) return "";
  if (id === "beide") return "beide";
  if (id === "kueche") return "Küche";
  return props.personen[id]?.name ?? id;
}

function farbe(id: string): string {
  return props.personen[id]?.farbe ?? "#9aa3a0";
}

const wichtigkeit = computed(() =>
  props.aufgabe?.prio === "dringend" ? "Dringend"
  : props.aufgabe?.prio === "normal" ? "Normal" : "Kann warten",
);
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="aufgabe?.titel ?? ''"
    :style="{ width: '32rem', maxWidth: '95vw' }"
    data-pruef="popup"
  >
    <div v-if="aufgabe" class="flex flex-col gap-3 text-sm">
      <!-- Wer und wie eilig: dieselben Zeichen wie in der Zeile, damit man
           nicht umdenken muss. -->
      <div class="flex items-center gap-2 flex-wrap" data-pruef="popup-kopf">
        <span v-for="p in aufgabe.beteiligte" :key="p"
              class="px-2 py-0.5 rounded-full text-xs text-white"
              :style="{ backgroundColor: farbe(p) }" :data-person="p">
          {{ name(p) }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400" data-pruef="popup-prio">
          {{ wichtigkeit }}
        </span>
      </div>

      <div v-if="aufgabe.schritte && aufgabe.schritte.length" data-pruef="popup-schritte">
        <div class="font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          Schritte
        </div>
        <ul class="flex flex-col gap-1">
          <li v-for="s in aufgabe.schritte" :key="s.nr" class="flex items-start gap-2"
              :data-pruef="'popup-schritt'" :data-erledigt="s.erledigt ? '1' : '0'">
            <span class="pi text-xs mt-0.5"
                  :class="s.erledigt ? 'pi-check-circle text-emerald-600' : 'pi-circle text-gray-400'"
                  aria-hidden="true"></span>
            <span :class="s.erledigt ? 'line-through text-gray-400 dark:text-gray-500' : ''">
              {{ s.text }}
              <span class="text-xs text-gray-500 dark:text-gray-400">· {{ name(s.zustaendig) }}</span>
            </span>
          </li>
        </ul>
      </div>
      <div v-else class="text-gray-500 dark:text-gray-400" data-pruef="popup-ohne-schritte">
        Diese Aufgabe hat keine Schritte.
      </div>

      <div v-if="notiz.length" data-pruef="popup-notiz">
        <div class="font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          Notiz
        </div>
        <!-- Die Auszeichnung der App wird entfernt, nicht ausgeführt: Was aus
             einem Eingabefeld kommt, wird hier nie als HTML dargestellt. -->
        <p v-for="(z, i) in notiz" :key="i" class="leading-snug"
           :class="z.punkt ? 'pl-3 before:content-[\'•\'] before:mr-1' : ''">{{ z.text }}</p>
      </div>

      <div class="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-0.5"
           data-pruef="popup-fuss">
        <span v-if="aufgabe.stufe_text">Nachfragen: {{ aufgabe.stufe_text }}</span>
        <span v-if="aufgabe.versuche">
          {{ aufgabe.versuche === 1 ? "Einmal versucht" : aufgabe.versuche + "-mal versucht" }}
          <template v-if="aufgabe.letzter_versuch">, zuletzt {{ vorWieLange(aufgabe.letzter_versuch) }}</template>
        </span>
        <span v-if="aufgabe.anhaenge">{{ aufgabe.anhaenge }} Anhang/Anhänge -- in der App ansehen</span>
        <span v-if="aufgabe.angelegt_von">
          Angelegt von {{ name(aufgabe.angelegt_von) }}
          <template v-if="aufgabe.angelegt_am">{{ vorWieLange(aufgabe.angelegt_am) }}</template>
        </span>
        <span v-if="!aufgabe.schritte?.length && nebenzeile(aufgabe, personen)">
          {{ nebenzeile(aufgabe, personen) }}
        </span>
      </div>
    </div>
  </Dialog>
</template>
