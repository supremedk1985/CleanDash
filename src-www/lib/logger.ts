/** The kitchen tiles log through this; the last entries are kept for the diagnostics in the settings panel. */
import { ref } from "vue";

export interface LogEntry { t: string; level: "info" | "warn" | "error"; msg: string; meta?: unknown }
export const logBuffer = ref<LogEntry[]>([]);

function add(level: LogEntry["level"], msg: string, meta?: unknown) {
  logBuffer.value = [...logBuffer.value.slice(-199), { t: new Date().toLocaleTimeString(), level, msg, meta }];
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(msg, meta ?? "");
}

export const logger = {
  info: (msg: string, meta?: unknown) => add("info", msg, meta),
  warn: (msg: string, meta?: unknown) => add("warn", msg, meta),
  error: (msg: string, meta?: unknown) => add("error", msg, meta),
  debug: (_msg: string, _meta?: unknown) => undefined,
};
