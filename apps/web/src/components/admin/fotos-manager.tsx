"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, X } from "lucide-react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { borrarFotoAction, reordenarFotosAction, subirFotoAction, type AdminFormState } from "@/app/actions/admin";

const initialState: AdminFormState = {};

// T4.20, pedido del cliente 2026-08-13: "10 espacios para imágenes y
// video" — un pool compartido entre foto y video, no 10 de cada uno.
// Reforzado también en el backend (maxFotosPorAlojamiento,
// apps/api/internal/http/alojamientos.go) para que no se pueda saltear
// pegándole directo a la API.
const TOTAL_ESPACIOS = 10;

/** Carga/borrado/reordenado de fotos y video (T2.1/T4.2/T4.13/T4.20) — el
 * mismo mecanismo de storage (LocalStorage en dev, TR-013) que ya usaba
 * el seed de datos de prueba. Se usa tanto en /admin/alojamientos/{id}
 * como directamente en la página pública del alojamiento cuando la ve un
 * admin (T4.13).
 *
 * T4.20 (pedido del cliente): antes era una grilla de subida + lista de
 * miniaturas con borrar, sin relación visual con cómo se ve la galería
 * real (components/alojamiento/gallery.tsx). Ahora arriba hay una
 * preview grande igual a la vista pública, y abajo una grilla fija de
 * TOTAL_ESPACIOS casilleros: los llenos son la foto/video (arrastrable
 * para reordenar, con botón de borrar), los vacíos son un "+" que abre
 * el selector de archivo — "ir rellenando los espacios disponibles".
 */
export function FotosManager({ alojamientoId, fotos }: { alojamientoId: string; fotos: Foto[] }) {
  const subir = subirFotoAction.bind(null, alojamientoId);
  const [state, formAction, pending] = useActionState(subir, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mutando, startMutar] = useTransition();
  const router = useRouter();

  // Orden local optimista: durante un arrastre se actualiza acá al
  // instante (se siente inmediato), y se resincroniza con `fotos` cuando
  // el servidor confirma (subida, borrado, o el propio reordenar
  // persistido) — evita que la UI dependa de esperar un round-trip para
  // mostrar el resultado del drag. Resincronizar "ajustando estado
  // durante el render" (comparando contra la última prop vista) en vez
  // de un useEffect con setState adentro — mismo patrón que evita el
  // round-trip extra de renders que dispara react-hooks/set-state-in-effect
  // (ver notas de notificaciones-cerradas.ts/modal.tsx en TR-018).
  const [orden, setOrden] = useState(fotos);
  const [fotosVistas, setFotosVistas] = useState(fotos);
  if (fotos !== fotosVistas) {
    setFotosVistas(fotos);
    setOrden(fotos);
  }

  const [seleccionada, setSeleccionada] = useState(0);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  // Sobre qué casillero está el dedo/cursor mientras se arrastra — solo
  // para el resalte visual del destino, `soltarEn` reordena leyendo esto.
  const [sobreIndice, setSobreIndice] = useState<number | null>(null);
  // Qué pointerId está arrastrando ahora — con setPointerCapture, el
  // pointermove/pointerup del gesto siguen llegando al mismo <button> del
  // handle pase lo que pase por debajo del dedo, pero igual conviene
  // filtrar por id (más de un dedo a la vez es un caso raro pero posible).
  const arrastreRef = useRef<number | null>(null);

  // Limpia el input de archivo después de una subida exitosa, para poder
  // encadenar otra sin tener que reabrir el selector a mano.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  function borrar(fotoId: string) {
    startMutar(async () => {
      await borrarFotoAction(alojamientoId, fotoId);
      router.refresh();
    });
  }

  function soltarEn(destino: number) {
    if (arrastrando === null || arrastrando === destino) {
      setArrastrando(null);
      return;
    }
    const nuevo = [...orden];
    const [movida] = nuevo.splice(arrastrando, 1);
    nuevo.splice(destino, 0, movida);
    setOrden(nuevo);
    setArrastrando(null);
    startMutar(async () => {
      await reordenarFotosAction(
        alojamientoId,
        nuevo.map((f) => f.id),
      );
      router.refresh();
    });
  }

  // Reordenar con Pointer Events en vez del HTML5 Drag and Drop nativo
  // (bug real 2026-08-17, reportado en mobile: "no funciona la funcion de
  // arrastrar la imagen para cambiar el orden... arrastrarla con el dedo
  // en vez del cursor") — la API nativa de drag-and-drop (draggable,
  // onDragStart/onDragOver/onDrop) es de escritorio pura, los navegadores
  // mobile no la disparan con gestos táctiles. Pointer Events sí unifica
  // mouse/touch/lápiz en un solo set de eventos, así que un handle chico
  // dedicado (agarradera ⠿, con touch-none para que el navegador no le
  // gane la mano al gesto con su propio scroll nativo) reemplaza al
  // casillero entero siendo arrastrable: funciona igual con mouse y con
  // el dedo, sin dos caminos de código distintos.
  function iniciarArrastre(e: React.PointerEvent<HTMLButtonElement>, i: number) {
    e.preventDefault();
    arrastreRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(i);
  }

  function moverArrastre(e: React.PointerEvent<HTMLButtonElement>) {
    if (arrastreRef.current !== e.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const casillero = el?.closest<HTMLElement>("[data-foto-index]");
    setSobreIndice(casillero ? Number(casillero.dataset.fotoIndex) : null);
  }

  function soltarArrastre(e: React.PointerEvent<HTMLButtonElement>) {
    if (arrastreRef.current !== e.pointerId) return;
    arrastreRef.current = null;
    if (sobreIndice !== null) soltarEn(sobreIndice);
    else setArrastrando(null);
    setSobreIndice(null);
  }

  const activa = orden[seleccionada] ?? orden[0];
  const lleno = orden.length >= TOTAL_ESPACIOS;

  return (
    <div>
      {activa && (
        <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-md bg-sand-dim">
          {activa.tipo === "video" ? (
            <video
              key={activa.id}
              src={activa.url}
              controls
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              key={activa.id}
              src={activa.url}
              alt=""
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover"
            />
          )}
        </div>
      )}

      {/* grid-cols-3 en mobile, no grid-cols-5 fijo (bug real 2026-08-17):
          con 10 casilleros en 5 columnas fijas, cada uno quedaba en ~55px
          de ancho en un teléfono común — el botón de borrar (24px,
          esquina superior derecha) ocupaba casi la mitad del casillero,
          tapando la miniatura. */}
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {Array.from({ length: TOTAL_ESPACIOS }, (_, i) => {
          const foto = orden[i];

          if (!foto) {
            return (
              <li key={`vacio-${i}`}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Agregar foto o video"
                  className="flex aspect-square w-full items-center justify-center rounded-md border-2 border-dashed border-ink/15 text-ink-soft/60 transition-colors hover:border-ink/30 hover:text-ink-soft"
                >
                  <span aria-hidden className="text-2xl">+</span>
                </button>
              </li>
            );
          }

          return (
            <li
              key={foto.id}
              data-foto-index={i}
              className={`group relative aspect-square overflow-hidden rounded-md bg-sand-dim ring-2 transition-opacity ${
                i === seleccionada ? "ring-coral" : sobreIndice === i && arrastrando !== null && arrastrando !== i ? "ring-tide" : "ring-transparent"
              } ${arrastrando === i ? "opacity-30" : ""}`}
            >
              <button
                type="button"
                onClick={() => setSeleccionada(i)}
                aria-label={`Ver ${foto.tipo === "video" ? "video" : "foto"} ${i + 1}`}
                className="absolute inset-0 h-full w-full"
              >
                {foto.tipo === "video" ? (
                  <div className="flex h-full w-full items-center justify-center bg-ink text-sand">
                    <span aria-hidden className="text-xl">▶</span>
                  </div>
                ) : (
                  <Image src={foto.url} alt="" fill sizes="120px" className="pointer-events-none object-cover" />
                )}
              </button>

              {/* Borrar: opacity-100 por defecto (bug real 2026-08-17,
                  "no se observa bien el icono a presionar para quitar la
                  foto") — group-hover:opacity-100 solo funcionaba con
                  mouse, un dispositivo táctil no tiene estado :hover
                  persistente, así que el ícono quedaba invisible salvo un
                  toque previo ambiguo. pointer-fine (mouse/trackpad) es el
                  único caso que ahora arranca en 0 y aparece al hover;
                  touch (pointer-coarse, el default sin ese prefijo) lo
                  deja siempre visible. */}
              <button
                type="button"
                disabled={mutando}
                onClick={() => borrar(foto.id)}
                aria-label="Borrar foto"
                className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-sand opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
              >
                <X size={14} strokeWidth={2.25} aria-hidden />
              </button>

              {/* Agarradera de arrastre — reemplaza al casillero entero
                  siendo draggable (ver iniciarArrastre arriba). touch-none
                  evita que el navegador arranque su propio scroll con el
                  primer movimiento del dedo acá, que es lo que rompía el
                  reordenado táctil. Misma visibilidad condicional que
                  borrar: siempre visible en touch, hover-only con mouse. */}
              <button
                type="button"
                onPointerDown={(e) => iniciarArrastre(e, i)}
                onPointerMove={moverArrastre}
                onPointerUp={soltarArrastre}
                onPointerCancel={soltarArrastre}
                aria-label="Mantené presionado y arrastrá para reordenar"
                className="absolute left-1 top-1 z-10 flex h-7 w-7 touch-none items-center justify-center rounded-full bg-ink/80 text-sand opacity-100 transition-opacity pointer-fine:cursor-grab pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:active:cursor-grabbing"
              >
                <GripVertical size={14} strokeWidth={2.25} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <form ref={formRef} action={formAction} className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          name="foto"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          disabled={lleno}
          onChange={() => formRef.current?.requestSubmit()}
          className="hidden"
        />
      </form>
      <p className="mt-2 text-xs text-ink-soft">
        {pending
          ? "Subiendo…"
          : lleno
            ? `Llegaste al máximo de ${TOTAL_ESPACIOS} fotos/videos — borrá alguno para subir otro.`
            : `Tocá un espacio vacío para agregar una foto o video. Arrastrá para cambiar el orden.`}
      </p>
      {state.error && <p role="alert" className="mt-1 text-sm text-coral-dark">{state.error}</p>}
    </div>
  );
}
