import { ref } from "vue";
import { fetchState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

/**
 * Wie viele Dokumente im Paperless-Posteingang liegen.
 *
 * Die Zahl kommt NICHT direkt von Paperless, sondern aus ioBroker: Das Skript
 * `script.js.Dashboard.Paperless` fragt alle fünf Minuten `/api/statistics/` ab
 * und schreibt `documents_inbox` nach `javascript.0.paperless.docCount`. Der
 * Umweg hat einen Grund -- Paperless verlangt einen API-Token, und der hätte im
 * Bundle dieser Seite im Klartext gestanden, also für jeden im Haus lesbar.
 *
 * ACHTUNG, hier steckte sieben Wochen lang ein Fehler: Das ioBroker-Skript
 * zeigte nach dem Umzug von Paperless (28.07.2026) weiter auf die alte
 * NAS-Adresse und schrieb deshalb 0. Die Kachel sah dabei völlig gesund aus --
 * eine leere Ablage ist schließlich plausibel. Wenn die Zahl hier falsch wirkt,
 * ist die erste Frage nicht „was macht die Kachel", sondern:
 *
 *     curl -s http://127.0.0.1:8085/getPlainValue/javascript.0.paperless.lastStatus
 *     curl -s http://127.0.0.1:8085/getPlainValue/javascript.0.paperless.lastError
 */
export interface Paperless {
  count_inbox: number;
}

export const paperless = ref<Paperless>({
  count_inbox: 0
});

async function poll() {
  const id = rawConfig.value.paperlessCount;
  if (!id) return;
  const count_inbox = await fetchState<number>(id);
  paperless.value = { count_inbox };
}

export const paperlessFeature: FeatureModule = { name: "paperless", interval: "slow", poll };
