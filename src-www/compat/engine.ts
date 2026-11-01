/** Runs the tiles' poll functions: fast ones every 5 s, slow ones every 90 s, as on the kitchen dashboard. */
import type { FeatureModule, PollInterval } from "./registry";

const INTERVAL_MS: Record<PollInterval, number> = { fast: 5000, slow: 90000 };
const modules: FeatureModule[] = [];
let running = false;

async function tick(interval: PollInterval) {
  await Promise.all(modules.filter((m) => m.interval === interval).map((m) => m.poll().catch(() => undefined)));
  setTimeout(() => tick(interval), INTERVAL_MS[interval]);
}

/** Register the modules of the configured tiles once the configuration is known; starts polling. */
export function startPolling(list: FeatureModule[]) {
  for (const m of list) if (!modules.includes(m)) modules.push(m);
  if (running) return;
  running = true;
  tick("fast");
  tick("slow");
}

/** A tile can ask for a fresh poll right after a write. */
export async function pollNow(name: string) {
  await Promise.all(modules.filter((m) => m.name === name).map((m) => m.poll().catch(() => undefined)));
}
