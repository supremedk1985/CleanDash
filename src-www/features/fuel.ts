import { ref } from "vue";
import { fetchState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

export interface FuelEntry {
  station: string;
  price: number;
  delta: number;
}

export interface Fuel {
  e10: FuelEntry;
  diesel: FuelEntry;
}

export const fuel = ref<Fuel>({
  e10: { station: "", price: 0, delta: 0 },
  diesel: { station: "", price: 0, delta: 0 },
});

/** The tankerkoenig instance from the settings */
const inst = () => (rawConfig.value.fuelInstance ?? "").replace(/^system\.adapter\./, "");

async function fetchEntry(kind: "e10" | "diesel"): Promise<FuelEntry> {
  const [station, price, delta] = await Promise.all([
    fetchState<string>(`${inst()}.stations.cheapest.${kind}.name`),
    fetchState<number>(`${inst()}.stations.cheapest.${kind}.short`),
    fetchState<number>(`${inst()}.stations.cheapest.${kind}.difference`),
  ]);
  return { station, price, delta };
}

async function poll() {
  const [e10, diesel] = await Promise.all([fetchEntry("e10"), fetchEntry("diesel")]);
  fuel.value = { e10, diesel };
}

export const fuelFeature: FeatureModule = { name: "fuel", interval: "slow", poll };
