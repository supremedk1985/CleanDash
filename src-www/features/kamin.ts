import { computed, ref } from "vue";
import { fetchBulk } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

/**
 * Fireplace watched by a thermocouple in the flue pipe (the author's own device, not published) or any script that
 * fills a folder (stovePrefix) with: temperatur, zustand (kalt | brennt | nachlegen), kraft (0–1), hoechst,
 * schwelle, modul, erreichbar, meldung. The tile appears only while the fire burns. Format: README.
 */
export interface Kamin {
  temperatur?: number;
  zustand: string;
  kraft: number;
  hoechst?: number;
  schwelle?: number;
  modul?: number;
  erreichbar: boolean;
  meldung: string;
}

export const kamin = ref<Kamin>();

/** burning (or waiting for wood) and the device answers — then the tile is shown */
export function kaminBrennt(k: Pick<Kamin, "zustand" | "erreichbar"> | undefined): boolean {
  return !!k && k.erreichbar && (k.zustand === "brennt" || k.zustand === "nachlegen");
}
export const kaminSichtbar = computed(() => kaminBrennt(kamin.value));

const NAMEN = ["temperatur", "zustand", "kraft", "hoechst", "schwelle", "modul", "erreichbar", "meldung"] as const;

function zahl(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
}

async function poll() {
  const p = rawConfig.value.stovePrefix;
  if (!p) return;
  const w = await fetchBulk(NAMEN.map((n) => `${p}.${n}`));
  const g = (n: string) => w[`${p}.${n}`];
  kamin.value = {
    temperatur: zahl(g("temperatur")), zustand: String(g("zustand") ?? ""), kraft: zahl(g("kraft")) ?? 0,
    hoechst: zahl(g("hoechst")), schwelle: zahl(g("schwelle")), modul: zahl(g("modul")),
    erreichbar: g("erreichbar") === true || g("erreichbar") === "true", meldung: String(g("meldung") ?? ""),
  };
}

export const kaminFeature: FeatureModule = { name: "kamin", interval: "fast", poll };
