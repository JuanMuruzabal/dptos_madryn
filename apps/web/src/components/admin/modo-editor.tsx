"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { actualizarAlojamientoAction, activarAlojamientoAction } from "@/app/actions/admin";
import { AlojamientoForm } from "@/components/admin/alojamiento-form";
import { FotosManager } from "@/components/admin/fotos-manager";
import { Modal } from "@/components/modal";
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/admin/ui";

/**
 * Modo editor (T4.14/T4.15) — reemplaza la galería/info normales cuando un
 * admin llega acá con `?modo=editor`. Client Component entero (2026-08-17,
 * antes vivía como función suelta dentro de page.tsx) para trackear
 * cambios sin guardar del formulario de datos y avisar antes de salir sin
 * guardar (pedido del cliente).
 *
 * Las fotos/video de FotosManager NO entran en este tracking — se guardan
 * solas al instante, no hay nada que "perder" ahí (ver nota de texto en
 * la sección de fotos). El riesgo real ahí es otro (borrar sin querer),
 * cubierto aparte con una confirmación en el propio FotosManager.
 */
export function ModoEditor({ id, alojamiento }: { id: string; alojamiento: Alojamiento }) {
  const [dirty, setDirty] = useState(false);
  // Adónde navegar apenas se confirme "Guardar y salir" o "Salir sin
  // guardar" — null significa que no hay ningún aviso abierto.
  const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // Los handlers de abajo (beforeunload, click global) se registran una
  // sola vez — leer dirty a través de un ref evita que se queden con el
  // valor de la primera vez que montaron. Sincronizar el ref en un efecto
  // propio, NO directo en el cuerpo del render — escribir ref.current
  // durante el render viola react-hooks/refs (mismo motivo documentado en
  // location-picker.tsx/site-header.tsx).
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  const actualizar = actualizarAlojamientoAction.bind(null, id);
  const publicar = activarAlojamientoAction.bind(null, id);

  // Tab/ventana cerrada, recargada, o URL escrita a mano — a diferencia de
  // clicks en links (interceptados abajo), esto es navegación que React no
  // puede frenar con JS puro: el único gancho posible es beforeunload. Los
  // navegadores ya no dejan poner un texto custom en el diálogo (por
  // seguridad); igual hace falta el preventDefault para que aparezca el
  // aviso nativo.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Bug real (2026-08-17, reportado por el cliente): el aviso solo salía
  // al tocar "Ver página"/"Volver al panel" de acá abajo — cualquier OTRO
  // link de la página (el logo, el nav del header, "Alojamiento" en la
  // barra, lo que sea) navegaba directo sin avisar nada, porque esos son
  // <Link> de Next.js sin ningún onClick propio pensado para esto. En vez
  // de cablear cada link de la página a mano, se intercepta CUALQUIER
  // click en un <a href> real (fase de captura, antes de que Next.js
  // procese la navegación) mientras haya cambios sin guardar — cubre toda
  // la página, no solo los 2 botones de acá.
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented) return;
      // Click con modificador (abrir en pestaña nueva, etc.) o que no sea
      // el botón principal del mouse: dejarlo pasar tal cual, el
      // navegador ya sabe qué hacer con esos.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Solo rutas propias — un link externo no tiene por qué pasar por
      // este flujo pensado para navegar DENTRO del sitio.
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      e.stopPropagation();
      setDestinoPendiente(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  function salirSinGuardar() {
    if (!destinoPendiente) return;
    const destino = destinoPendiente;
    setDestinoPendiente(null);
    setDirty(false);
    router.push(destino);
  }

  function guardarYSalir() {
    setGuardando(true);
    formRef.current?.requestSubmit();
  }

  // Se llama después de CUALQUIER intento de guardado (éxito o error) —
  // ver alojamiento-form.tsx. Si el guardado vino del botón "Guardar y
  // salir" del aviso, recién ahí se completa la navegación pendiente; si
  // falló, el aviso se cierra igual y el error queda visible en el propio
  // formulario (ya no tapado), con dirty sin resetear.
  function onSubmitResult(success: boolean) {
    setGuardando(false);
    if (success && destinoPendiente) {
      const destino = destinoPendiente;
      setDestinoPendiente(null);
      router.push(destino);
    } else if (!success) {
      setDestinoPendiente(null);
    }
  }

  function cerrarAviso() {
    // Bug real (2026-08-17): mientras "Guardando…" está en curso, cerrar
    // el aviso (Escape/click afuera) dejaba las otras opciones disponibles
    // igual — se podía tocar "Salir sin guardar" a mitad de un guardado en
    // curso y pisarlo. Con guardando en true, el aviso queda bloqueado
    // hasta que el guardado termine (éxito o error).
    if (guardando) return;
    setDestinoPendiente(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dune/30 bg-dune/10 px-4 py-2.5">
        <p className="tracked-caps text-xs font-semibold text-[#8a6a2e]">Modo editor</p>
        <div className="flex gap-2">
          <Link href={`/alojamiento/${id}`} className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}>
            Ver página
          </Link>
          <Link href="/admin/alojamientos" className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}>
            Volver al panel
          </Link>
        </div>
      </div>

      {!alojamiento.activo && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-coral/30 bg-coral/10 px-4 py-2.5">
          <div>
            <p className="tracked-caps text-xs font-semibold text-coral-dark">Todavía no publicado</p>
            <p className="mt-1 text-xs text-ink-soft">
              No aparece en el listado de alojamientos hasta que lo publiques.
            </p>
          </div>
          <form action={publicar}>
            <button type="submit" className={`${primaryButtonClass} px-4 py-1.5 text-xs`}>
              Publicar
            </button>
          </form>
        </div>
      )}

      <section className="rounded-md border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">
          Fotos y video de la página del alojamiento
        </h2>
        <div className="mt-4">
          <FotosManager alojamientoId={id} fotos={alojamiento.fotos} />
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Los cambios de fotos y video se guardan solos, al instante — no hace falta tocar
          &quot;Guardar cambios&quot; para ellos, ese botón es solo para los datos de abajo.
        </p>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Datos, precio y ubicación</h2>
        <div className="mt-4">
          <AlojamientoForm
            alojamiento={alojamiento}
            action={actualizar}
            ref={formRef}
            onDirtyChange={setDirty}
            onSubmitResult={onSubmitResult}
          />
        </div>
      </section>

      {destinoPendiente && (
        <Modal onClose={cerrarAviso} labelledBy="advertencia-titulo">
          <h2 id="advertencia-titulo" className="font-display text-xl sm:text-2xl">
            Hay cambios sin guardar — ¿seguro que querés salir?
          </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={guardando}
              onClick={guardarYSalir}
              className={primaryButtonClass}
            >
              {guardando ? "Guardando…" : "Guardar y salir"}
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={salirSinGuardar}
              className={dangerButtonClass}
            >
              Salir sin guardar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={cerrarAviso}
              className="text-sm text-ink-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Seguir editando
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
