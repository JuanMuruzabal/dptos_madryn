"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { placeholderGradient } from "@/lib/placeholder-gradient";
import { PhotoLightbox } from "@/components/alojamiento/photo-lightbox";

interface GalleryProps {
  fotos: Foto[];
  nombre: string;
  placeholderSeed: string;
}

/** Foto o video (T4.13) en el visor principal/miniatura — un solo lugar
 * para la lógica de "qué tag renderizar según el tipo", en vez de
 * repetirla en cada punto de uso. */
function Media({ foto, alt, priority, sizes, className }: {
  foto: Foto;
  alt: string;
  priority?: boolean;
  sizes: string;
  className: string;
}) {
  if (foto.tipo === "video") {
    return (
      <video
        src={foto.url}
        controls
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        aria-label={alt}
      />
    );
  }
  return (
    <Image src={foto.url} alt={alt} fill priority={priority} sizes={sizes} className={`object-cover ${className}`} />
  );
}

/** Galería de fotos/video del detalle (T2.3/T4.13, spec §4.2): foto
 * principal grande + tira de miniaturas clickeables. Sin fotos cargadas
 * todavía, cae al mismo gradiente de marca que el resto del sitio (ver
 * placeholder-gradient.ts) en vez de dejar un espacio roto — "el
 * placeholder ya puesto" al que se refería el pedido de subir fotos/video
 * (T4.13): es este mismo componente, no uno nuevo. */
export function Gallery({ fotos, nombre, placeholderSeed }: GalleryProps) {
  const [selected, setSelected] = useState(0);
  // Pantalla completa (2026-08-17, pedido del cliente) — capa aparte por
  // encima de todo, ver photo-lightbox.tsx.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (fotos.length === 0) {
    return (
      <div
        role="img"
        aria-label={nombre}
        className="photo-placeholder relative aspect-[16/10] w-full rounded-md"
        style={{ "--scene-gradient": placeholderGradient(placeholderSeed) } as CSSProperties}
      />
    );
  }

  const activa = fotos[selected] ?? fotos[0];

  return (
    <div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-sand-dim">
        <Media
          foto={activa}
          alt={`${nombre} — ${activa.tipo === "video" ? "video" : "foto"} ${selected + 1} de ${fotos.length}`}
          priority={activa.tipo === "foto"}
          sizes="(min-width: 1024px) 66vw, 100vw"
          className=""
        />
        {/* Pantalla completa (2026-08-17, pedido del cliente: "a veces no
            se aprecia muy bien" + valor de accesibilidad) — UN solo botón
            por tipo, no dos con el mismo aria-label (bug real: tener el
            ícono como un botón aparte SUPERPUESTO al botón de "toda el
            área" duplicaba el control, dos tab-stops con el mismo nombre
            accesible apuntando a la misma acción). Foto: toda el área es
            el botón, con el ícono de expandir adentro como badge visual
            en la esquina. Video: SOLO el ícono, ahí no se puede cubrir
            toda el área — abajo están los controles nativos del video
            (play/pause/seek/fullscreen propio del navegador) y un botón
            de pantalla completa entero encima se los comería. */}
        {activa.tipo === "foto" ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Ver foto en pantalla completa"
            className="absolute inset-0 flex h-full w-full cursor-zoom-in items-start justify-end p-3"
          >
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-sand backdrop-blur-sm"
            >
              <Expand size={18} strokeWidth={1.75} />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Ver video en pantalla completa"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-sand backdrop-blur-sm transition-colors hover:bg-ink/80"
          >
            <Expand size={18} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          fotos={fotos}
          nombre={nombre}
          initialIndex={selected}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {fotos.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {fotos.map((foto, i) => (
            <button
              key={foto.id}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Ver ${foto.tipo === "video" ? "video" : "foto"} ${i + 1} de ${fotos.length}`}
              aria-current={i === selected}
              className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md ring-2 transition-opacity ${
                i === selected
                  ? "opacity-100 ring-coral"
                  : "opacity-70 ring-transparent hover:opacity-100"
              }`}
            >
              {foto.tipo === "video" ? (
                <div className="flex h-full w-full items-center justify-center bg-ink text-sand">
                  <span aria-hidden className="text-lg">▶</span>
                </div>
              ) : (
                <Image src={foto.url} alt="" fill sizes="96px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
