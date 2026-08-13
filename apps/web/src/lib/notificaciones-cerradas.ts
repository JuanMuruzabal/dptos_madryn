"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado "cerrado" de notificaciones individuales (banner de espera de
 * confirmación + ítems del panel 🔔, T3.9) — vive en localStorage, no en
 * el backend: cerrar un aviso es una preferencia de este navegador, no
 * cambia el estado real de la reserva. Las claves combinan contexto +
 * reserva (+ tipo cuando aplica) para que cerrar el banner de una reserva
 * no la oculte también del panel de notificaciones, y para que una
 * reserva que pasa de "esperando confirmación" a "confirmada" vuelva a
 * aparecer como novedad (ver reserva-urgencia.ts).
 *
 * `useSyncExternalStore` en vez de leer localStorage en un `useEffect` +
 * `useState`: evita el mismatch de hidratación (SSR no tiene
 * localStorage) sin caer en el patrón "mounted" que ya se descartó acá
 * por el lint `react-hooks/set-state-in-effect` (ver modal.tsx) — el
 * snapshot del servidor es siempre "nada cerrado" y React actualiza solo
 * al valor real del cliente apenas hidrata.
 */
const STORAGE_KEY = "tm.notificaciones.cerradas";

// Referencia estable: useSyncExternalStore exige que getServerSnapshot (y
// getSnapshot cuando no cambió nada) devuelvan la MISMA referencia entre
// llamadas — un `[]` nuevo en cada invocación dispara "getServerSnapshot
// should be cached" y un loop infinito de renders (bug real, atrapado en
// dev al levantar el servidor).
const SIN_CERRAR: string[] = [];

const listeners = new Set<() => void>();

function leer(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

let snapshot: string[] = typeof window === "undefined" ? SIN_CERRAR : leer();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  return snapshot;
}

function getServerSnapshot(): string[] {
  return SIN_CERRAR;
}

/** Marca una clave como cerrada y notifica a todos los componentes que
 * usan `useCerradas()` para que se re-rendericen. */
export function marcarCerrada(clave: string) {
  if (typeof window === "undefined") return;
  if (snapshot.includes(clave)) return;
  snapshot = [...snapshot, clave];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  for (const listener of listeners) listener();
}

/** Hook: set reactivo de claves cerradas por el usuario en este navegador. */
export function useCerradas(): Set<string> {
  const claves = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return new Set(claves);
}
