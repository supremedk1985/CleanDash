import { ref } from "vue";
import { fetchState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

export interface Printer3D {
  connected: boolean;
  printing: boolean;
  printjob_name: string;
  completion: string | number;
  printtime: string | number;
  printtime_left: string | number;
}

export const printer_3d = ref<Printer3D>({
  connected: false,
  printing: false,
  printjob_name: "",
  completion: "",
  printtime: "",
  printtime_left: ""
});

/** The octoprint instance from the settings */
const inst = () => (rawConfig.value.printerInstance ?? "").replace(/^system\.adapter\./, "");

async function poll() {
  const [connected, printing, printjob_name, completion, printtime, printtime_left] = await Promise.all([
    fetchState<boolean>(`${inst()}.info.connection`),
    fetchState<boolean>(`${inst()}.printing`),
    fetchState<string>(`${inst()}.printjob.file.name`),
    fetchState<string | number>(`${inst()}.printjob.progress.completion`),
    fetchState<string | number>(`${inst()}.printjob.progress.printtime`),
    fetchState<string | number>(`${inst()}.printjob.progress.printtimeLeft`),
  ]);
  printer_3d.value = { connected, printing, printjob_name, completion, printtime, printtime_left };
}

export const printer3dFeature: FeatureModule = { name: "printer3d", interval: "slow", poll };
