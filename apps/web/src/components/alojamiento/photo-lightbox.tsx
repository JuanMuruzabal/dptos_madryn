"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Foto } from "@turismo-marcuzzi/shared-types";

interface PhotoLightboxProps {
  fotos: Foto[];
  nombre: string;
  initialIndex: number;
  onClose: () => void;
}

/**
 * Visor de foto/video en pantalla completa (2026-08-17, pedido del
 * cliente: "al presionar una imagen en la pagina de alojamiento o video,
 * se pueda ver en pantalla completa, porque a veces no se aprecia muy
 * bien y agrega puntos en la accesibilidad") — se dispara desde Gallery
 * (abajo), no reemplaza el visor chico embebido en la página, es una capa
 * aparte por encima de todo.
 *
 * Mismo mecanismo base que Modal (portal a document.body, Escape cierra,
 * bloquea scroll del body) pero con su propia presentación: fondo casi
 * negro edge-to-edge en vez de una tarjeta clara centrada — acá el
 * contenido ES la imagen, no un formulario, así que no tiene sentido el
 * padding/rounded-md/max-w-lg de Modal.
 */
export function PhotoLightbox({ fotos, nombre, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (fotos.length > 1) {
        if (e.key === "ArrowRight") setIndex((i) => (i + 1) % fotos.length);
        if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + fotos.length) % fotos.length);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, fotos.length]);

  if (typeof document === "undefined") return null;

  const activa = fotos[index];
  if (!activa) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4"
      onClick={onClose}
      role="presentation"
    >
      {/* stopPropagation (bug real): sin esto, el click acá también le
          llega al fondo (bubbling) y dispara el SU propio onClick={onClose}
          — terminaba llamando a onClose 2 veces por un solo click. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-sand/10 text-sand transition-colors hover:bg-sand/20"
      >
        <X size={22} aria-hidden />
      </button>

      {/* z-10 (bug real, reportado en mobile): sin esto, el <div
          role="dialog"> de abajo —más adelante en el DOM, position:
          relative con z-index:auto también— terminaba pintándose por
          encima de estos botones. En desktop no se notaba porque el
          diálogo queda angosto y centrado (max-w-5xl), lejos de los
          bordes; en mobile w-full lo estira casi al ancho completo de la
          pantalla, exactamente donde están las flechas, y las tapaba. */}
      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i - 1 + fotos.length) % fotos.length);
            }}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-sand/10 text-sand transition-colors hover:bg-sand/20 md:left-6"
          >
            <ChevronLeft size={26} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % fotos.length);
            }}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-sand/10 text-sand transition-colors hover:bg-sand/20 md:right-6"
          >
            <ChevronRight size={26} aria-hidden />
          </button>
        </>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${nombre} — ${activa.tipo === "video" ? "video" : "foto"} ${index + 1} de ${fotos.length}`}
        onClick={(e) => e.stopPropagation()}
        className="relative h-full max-h-[85vh] w-full max-w-5xl"
      >
        {activa.tipo === "video" ? (
          <video
            key={activa.id}
            src={activa.url}
            controls
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <Image
            key={activa.id}
            src={activa.url}
            alt={`${nombre} — foto ${index + 1} de ${fotos.length}`}
            fill
            sizes="100vw"
            className="object-contain"
          />
        )}
      </div>

      {fotos.length > 1 && (
        <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-sm text-sand/70">
          {index + 1} / {fotos.length}
        </p>
      )}
    </div>,
    document.body,
  );
}
