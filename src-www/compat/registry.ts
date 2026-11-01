export type PollInterval = "fast" | "slow";

export interface FeatureModule {
  name: string;
  interval: PollInterval;
  poll: () => Promise<void>;
}
