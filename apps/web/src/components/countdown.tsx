"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface CountdownProps {
  /** Fecha límite ISO 8601. */
  deadline: string;
  /** Se llama una sola vez, cuando el contador llega a 0 — pensado para
   * disparar un router.refresh() y traer el estado real (el backend ya
   * canceló la reserva en su propio barrido, esto solo refresca la UI). */
  onExpire?: () => void;
  className?: string;
}

function formatRestante(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSegundos = Math.floor(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  if (horas > 0) {
    return `${horas}h ${String(minutos).padStart(2, "0")}m`;
  }
  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}

/**
 * Cuenta regresiva en vivo (T3.7) — tickea cada segundo. Formato "Hh MMm"
 * si falta más de una hora (el timer de confirmación, 2h — mostrar
 * segundos ahí solo generaría ruido); "M:SS" si falta menos (el timer de
 * contacto, 5 min — ahí sí importa la urgencia al segundo).
 *
 * `suppressHydrationWarning` a propósito: el valor inicial se calcula con
 * el reloj del servidor en el render SSR y con el del cliente al
 * hidratar, unos cientos de ms distintos — para un contador en vivo esa
 * diferencia es imperceptible e inevitable (es el patrón que recomienda
 * la propia documentación de Next para relojes/timestamps en vivo), así
 * que no tiene sentido que React la marque como mismatch.
 */
export function Countdown({ deadline, onExpire, className }: CountdownProps) {
  const target = useMemo(() => new Date(deadline).getTime(), [deadline]);
  const [remaining, setRemaining] = useState(() => target - Date.now());
  const yaExpiro = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = target - Date.now();
      setRemaining(next);
      if (next <= 0 && !yaExpiro.current) {
        yaExpiro.current = true;
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [target, onExpire]);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRestante(remaining)}
    </span>
  );
}
