"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { placeholderGradient } from "@/lib/placeholder-gradient";

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
      </div>

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
