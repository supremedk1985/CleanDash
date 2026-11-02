import { ref } from "vue";
import { fetchState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

/**
 * Wie viele Dokumente im Paperless-Posteingang liegen.
 *
 * Die Zahl kommt NICHT direkt von Paperless, sondern aus einem Datenpunkt
 * (paperlessCount), den zum Beispiel ein ioBroker-Skript aus `/api/statistics/`
 * (`documents_inbox`) füllt. Der Umweg hat einen Grund -- Paperless verlangt
 * einen API-Token, und der stünde sonst im Klartext im Bundle dieser Seite.
 *
 * Wirkt die Zahl falsch (etwa dauerhaft 0), zuerst das Skript prüfen: eine
 * leere Ablage sieht plausibel aus, auch wenn das Skript nichts mehr erreicht.
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
