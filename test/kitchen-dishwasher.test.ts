import { describe, it, expect } from "vitest";
import { Dishwasher } from "../src-www/features/dishwasher";

describe("Dishwasher", () => {
  it("derives running/ready/delayed-start from the raw ioBroker operation state suffix", () => {
    expect(new Dishwasher("BSH_Common_EnumType_OperationState_Run").isRunning()).toBe(true);
    expect(new Dishwasher("BSH_Common_EnumType_OperationState_Ready").isReady()).toBe(true);
    expect(new Dishwasher("BSH_Common_EnumType_OperationState_DelayedStart").isDelayedStart()).toBe(true);
    expect(new Dishwasher("BSH_Common_EnumType_OperationState_Run").isReady()).toBe(false);
  });

  it("formats remaining time as HH:MM", () => {
    const dishwasher = new Dishwasher("", 0, "", 5400); // 1h30m
    expect(dishwasher.getFormattedTimeRemaining()).toBe("01:30");
  });

  it("maps the known program id to a display name, and falls back to the raw id otherwise", () => {
    expect(new Dishwasher("", 0, "Dishcare.Dishwasher.Program.Auto2").getProgrammName()).toBe("Auto 45-65°");
    expect(new Dishwasher("", 0, "Dishcare.Dishwasher.Program.Unknown").getProgrammName()).toBe(
      "Dishcare.Dishwasher.Program.Unknown"
    );
  });
});

describe("Robustheit gegen kaputte Adapter-Antworten", () => {
  it("übersteht eine Zahl als OperationState (fetchState-0 bei val=null)", () => {
    const d = new Dishwasher(0 as unknown as string, 0, "", 0);
    expect(d.isRunning()).toBe(false);
    expect(d.isReady()).toBe(false);
    expect(d.isDelayedStart()).toBe(false);
  });

  it("übersteht undefined als OperationState", () => {
    const d = new Dishwasher(undefined as unknown as string, 0, "", 0);
    expect(d.isRunning()).toBe(false);
  });
});


describe("Dishwasher.isVerbunden", () => {
  it("ist ohne Angabe verbunden (Altdaten, Tests) und sonst wie gemeldet", () => {
    expect(new Dishwasher("BSH.Common.EnumType.OperationState.Ready").isVerbunden()).toBe(true);
    expect(new Dishwasher("BSH.Common.EnumType.OperationState.Ready", 0, "", 0, false).isVerbunden()).toBe(false);
  });
});
