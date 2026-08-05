"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Device-local preference storage for demo settings.
 * Reads through useSyncExternalStore so SSR renders defaults and the client
 * swaps in stored values during hydration without an effect.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or quota exceeded; preferences stay in memory for this render.
  }
  for (const listener of listeners) listener();
}

const noopSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

/** False during SSR and the hydration pass, true once the client is live. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}

// getSnapshot must return a stable reference, so parsed objects are cached per raw string.
const objectCache = new Map<string, { raw: string | null; value: unknown }>();

export function useLocalObject<T extends object>(key: string, defaults: T) {
  const getSnapshot = useCallback(() => {
    const raw = readRaw(key);
    const cached = objectCache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;

    let value = defaults;
    if (raw) {
      try {
        value = { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
      } catch {
        value = defaults;
      }
    }
    objectCache.set(key, { raw, value });
    return value;
  }, [key, defaults]);

  const getServerSnapshot = useCallback(() => defaults, [defaults]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback((next: T) => writeRaw(key, JSON.stringify(next)), [key]);

  return [value, setValue] as const;
}

export function useLocalString<T extends string>(
  key: string,
  fallback: T,
  resolve: (raw: string | null) => T,
) {
  const getSnapshot = useCallback(() => resolve(readRaw(key)), [key, resolve]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback((next: T) => writeRaw(key, next), [key]);

  return [value, setValue] as const;
}

/** Transient "Saved" acknowledgement that clears itself. */
export function useSavedFlash(ms = 1800) {
  const [flashed, setFlashed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback(() => {
    setFlashed(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlashed(false), ms);
  }, [ms]);

  return [flashed, flash] as const;
}
