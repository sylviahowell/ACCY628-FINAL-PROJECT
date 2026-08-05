/**
 * Lightweight structured logging for server actions / middleware.
 * Keeps PII minimal; safe to leave as console JSON for the demo and CI.
 */
export type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  action: string;
  message?: string;
  userId?: string | null;
  role?: string | null;
  path?: string;
  error?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export function logEvent(event: LogEvent) {
  const payload = {
    ts: new Date().toISOString(),
    ...event,
  };
  const line = JSON.stringify(payload);
  if (event.level === "error") console.error(line);
  else if (event.level === "warn") console.warn(line);
  else console.info(line);
}
