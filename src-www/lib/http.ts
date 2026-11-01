/**
 * http.ts
 * -------
 * Wrapper um `fetch` mit Logging, Request-ID und optionalem Timeout.
 */

import { logger } from './logger';

export type HttpOptions = RequestInit & {
  log?: boolean;
  tag?: string;
  timeoutMs?: number;
};

let requestCounter = 0;

export async function httpFetch(input: RequestInfo | URL, init?: HttpOptions): Promise<Response> {
  const id = ++requestCounter;
  const start = performance.now();
  const opts: HttpOptions = { log: true, ...init };

  const controller = new AbortController();
  const timeout = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;

  const finalInit: RequestInit = {
    ...opts,
    signal: controller.signal,
    headers: {
      //'x-request-id': String(id),
      ...(opts.headers || {}),
    }
  };

  try {
    if (opts.log) logger.debug('http.request', { id, input: String(input), tag: opts.tag });
    const res = await fetch(input, finalInit);
    const dur = Math.round(performance.now() - start);
    if (opts.log) logger.info('http.response', { id, tag: opts.tag, status: res.status, ms: dur, ok: res.ok });
    return res;
  } catch (err: any) {
    const dur = Math.round(performance.now() - start);
    logger.error('http.error', { id, tag: opts.tag, ms: dur, error: err?.message || String(err) });
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
