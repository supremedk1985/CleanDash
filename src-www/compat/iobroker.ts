/**
 * The read/write functions the kitchen dashboard's tiles were written against (formerly simple-api), answered
 * through CleanDash's connection: the ioBroker socket with login and rights, or the demo house.
 *
 * Same rules as before: a network error throws (the tile keeps its last value and the banner shows the outage);
 * a missing or null value reads as 0, because several tiles rely on that.
 */
import { connected as backendErreichbar, getSource, lastContact as letzterKontakt } from "../lib/store";

export { backendErreichbar, letzterKontakt };

export async function fetchState<T = any>(stateId: string): Promise<T> {
  const v = (await getSource().read([stateId]))[stateId];
  return (v === null || v === undefined ? 0 : v) as T;
}

/** Several datapoints at once; missing or null ones are left out of the result. */
export async function fetchBulk(stateIds: string[]): Promise<Record<string, unknown>> {
  if (!stateIds.length) return {};
  const all = await getSource().read(stateIds);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

export async function setState(stateId: string, value: string | number | boolean): Promise<boolean> {
  try {
    await getSource().write(stateId, value);
    return true;
  } catch {
    return false;
  }
}

/** Recorded values ([value, ms] per datapoint) from ioBroker's default history adapter. */
export async function history(ids: string[], from: number, to: number, step?: number): Promise<Record<string, [unknown, number][]>> {
  return getSource().history(ids, from, to, step);
}
