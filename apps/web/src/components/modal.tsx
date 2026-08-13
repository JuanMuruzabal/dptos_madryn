"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  labelledBy: string;
}

/**
 * Modal genérico centrado, con fondo oscurecido (T3.6) — pensado en
 * primer lugar para el formulario de reserva, pero sin nada específico de
 * reservas: reutilizable donde haga falta (panel admin, Sprint 4, seguro
 * necesita algo así para confirmar/editar reservas).
 *
 * Cierra con click en el fondo, con Escape, y bloquea el scroll del body
 * mientras está abierto — sin eso, el usuario puede scrollear la página
 * de atrás sin darse cuenta de que el modal sigue ahí.
 *
 * Portal a document.body a propósito (bug real, 2026-08-12): el header
 * (fixed, z-50) quedaba pisando el modal cuando este se renderizaba
 * dentro del <div sticky> de la barra lateral de reserva — `position:
 * sticky` crea su propio contexto de apilamiento en CSS, así que el
 * z-index del modal solo se comparaba *dentro* de ese contexto, nunca
 * contra el header. Portalear al body sortea el problema del todo: no
 * importa en qué parte del árbol se monte el modal, corre a nivel
 * viewport. El chequeo `typeof document === "undefined"` (en vez de un
 * estado "mounted" seteado en un efecto) evita reventar en SSR sin
 * arriesgar un mismatch de hidratación: en este componente el modal
 * nunca forma parte del render inicial (nace de un click después de
 * hidratar), así que no hace falta el paso extra de "montado" — alcanza
 * con la guarda sincrónica.
 */
export function Modal({ onClose, children, labelledBy }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md bg-sand p-6 shadow-2xl md:p-8"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
