import { ref } from "vue";
import { fetchState } from "../compat/iobroker";
import type { FeatureModule } from "./registry";
import { rawConfig } from "../lib/store";

export class Dishwasher {
  runningState: string;
  progress: number;
  selectedProgramm: string;
  remainingTime: number;
  /** Meldet die Home-Connect-Cloud die Maschine als verbunden? Wenn nicht, ist alles andere hier Konserve. */
  verbunden: boolean;

  constructor(
    runningState = "",
    progress = 0,
    selectedProgramm = "",
    remainingTime = 0,
    verbunden = true
  ) {
    this.verbunden = !!verbunden;
    // fetchState kann bei val=null eine 0 liefern — endsWith() auf einer Zahl
    // wäre ein TypeError, der die ganze Kachel abräumt.
    this.runningState = String(runningState ?? "");
    this.progress = progress;
    this.selectedProgramm = selectedProgramm;
    this.remainingTime = remainingTime;
  }

  getProgrammImage() {
    let img = "";

    switch (this.selectedProgramm) {
      case "Dishcare.Dishwasher.Program.Auto2":
        img = "auto";
        break;

      default:
        break;
    }

    return "src/assets/dishwasher/" + img + ".webp";
  }

  getProgrammName() {
    switch (this.selectedProgramm) {
      case "Dishcare.Dishwasher.Program.Auto2":
        return "Auto 45-65°";
      default:
        return this.selectedProgramm;
    }
  }

  getFormattedTimeRemaining() {
    const hours = Math.floor(this.remainingTime / 3600);
    const minutes = Math.floor((this.remainingTime % 3600) / 60);

    // führende Nullen ergänzen
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");

    return `${hh}:${mm}`;
  }

  getFormattedEndTime(): string {
    const now = new Date();
    const endTime = new Date(now.getTime() + this.remainingTime * 1000);

    const hh = String(endTime.getHours()).padStart(2, "0");
    const mm = String(endTime.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  isRunning(): boolean {
    return this.runningState.endsWith("Run");
  }

  isReady(): boolean {
    return this.runningState.endsWith("Ready");
  }

  isDelayedStart(): boolean {
    return this.runningState.endsWith("DelayedStart");
  }

  /**
   * false = die Cloud hat die Maschine verloren (general.connected). Dann stimmt kein Zustand
   * hier mehr - am 04.09.2026 zeigte die Kachel „Bereit" vom 31.08., während die Maschine lief.
   */
  isVerbunden(): boolean {
    return this.verbunden;
  }
}

export const dishwasher = ref<Dishwasher>();

/** The dishwasher from the settings (dishwasherDevice), e.g. homeconnect.0.<haId> */
const PREFIX = () => rawConfig.value.dishwasherDevice ?? "";

async function poll() {
  const [runningState, progress, selectedProgramm, remainingTime, verbunden] = await Promise.all([
    fetchState<string>(`${PREFIX()}.status.BSH_Common_Status_OperationState`),
    fetchState<number>(`${PREFIX()}.programs.active.options.BSH_Common_Option_ProgramProgress`),
    fetchState<string>(`${PREFIX()}.programs.selected.BSH_Common_Root_SelectedProgram`),
    fetchState<number>(`${PREFIX()}.programs.active.options.BSH_Common_Option_RemainingProgramTime`),
    // general.connected kommt vom Adapter bei jedem Start frisch - anders als die
    // Ereignis-Datenpunkte, die stehen bleiben, wenn die Cloud die Maschine verliert.
    fetchState<boolean>(`${PREFIX()}.general.connected`),
  ]);
  dishwasher.value = new Dishwasher(runningState, progress, selectedProgramm, remainingTime, verbunden);
}

export const dishwasherFeature: FeatureModule = { name: "dishwasher", interval: "slow", poll };
