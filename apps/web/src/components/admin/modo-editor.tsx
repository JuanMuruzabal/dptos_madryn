"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { actualizarAlojamientoAction, activarAlojamientoAction } from "@/app/actions/admin";
import { AlojamientoForm } from "@/components/admin/alojamiento-form";
import { FotosManager } from "@/components/admin/fotos-manager";
import { Modal } from "@/components/modal";
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/admin/ui";

const FORM_ID = "alojamiento-editor-form";

/**
 * Modo editor (T4.14/T4.15) — reemplaza la galería/info normales cuando un
 * admin llega acá con `?modo=editor`. Pasó a ser Client Component entero
 * (2026-08-17, antes vivía como función suelta dentro de page.tsx, ni
 * "use client" ni con estado propio) para poder trackear cambios sin
 * guardar del formulario de datos y avisar antes de salir sin guardar
 * (pedido del cliente: "cuando quiero ir a otro apartado y tengo cambios
 * pendiente mostrar una adevertencia").
 *
 * Las fotos/video de FotosManager NO entran en este tracking — se guardan
 * solas al instante (cada subida/borrado/reordenado ya persiste en el acto,
 * ver fotos-manager.tsx), no hay nada que "perder" ahí si el admin se va
 * sin tocar "Guardar cambios". Ese botón es solo para nombre/descripción/
 * precio/capacidad/ubicación — el aviso de "cambios sin guardar" es
 * específicamente sobre esos campos.
 */
export function ModoEditor({ id, alojamiento }: { id: string; alojamiento: Alojamiento }) {
  const [dirty, setDirty] = useState(false);
  // Adónde navegar apenas se confirme "Guardar y salir" o "Salir sin
  // guardar" — null significa que no hay ningún aviso abierto.
  const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  const actualizar = actualizarAlojamientoAction.bind(null, id);
  const publicar = activarAlojamientoAction.bind(null, id);

  // Tab/ventana cerrada, recargada, o URL escrita a mano — a diferencia de
  // los links de "Ver página"/"Volver al panel" de acá abajo (interceptados
  // a mano, con el modal propio), esto es navegación que React Router no
  // puede interceptar con JS: el único gancho posible es beforeunload. Los
  // navegadores ya no dejan poner un texto custom en el diálogo (por
  // seguridad, desde hace años) — igual hace falta el preventDefault para
  // que aparezca el aviso nativo del navegador.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function irA(destino: string) {
    if (dirty) setDestinoPendiente(destino);
    else router.push(destino);
  }

  function salirSinGuardar() {
    if (!destinoPendiente) return;
    const destino = destinoPendiente;
    setDestinoPendiente(null);
    setDirty(false);
    router.push(destino);
  }

  // Se llama después de CUALQUIER intento de guardado (éxito o error) —
  // ver alojamiento-form.tsx. Si el guardado vino del botón "Guardar y
  // salir" del modal, recién ahí se completa la navegación pendiente; si
  // falló, el modal se cierra igual y el error queda visible en el propio
  // formulario (ya no tapado por el modal), con dirty sin resetear.
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dune/30 bg-dune/10 px-4 py-2.5">
        <p className="tracked-caps text-xs font-semibold text-[#8a6a2e]">Modo editor</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => irA(`/alojamiento/${id}`)}
            className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}
          >
            Ver página
          </button>
          <button
            type="button"
            onClick={() => irA("/admin/alojamientos")}
            className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}
          >
            Volver al panel
          </button>
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
        {/* Aclaración (2026-08-17, pedido del cliente — "si elimino o
            agrego una foto, esto es independiente del botón de guardar
            cambios") — en vez de mezclar el guardado instantáneo de fotos
            con el guardado explícito del formulario de abajo (que sería
            más confuso, no menos: alguien podría pensar que hace falta
            tocar "Guardar cambios" para que la foto quede, cuando ya
            quedó), se deja explícito que son dos mecanismos distintos a
            propósito. */}
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
            formId={FORM_ID}
            onDirtyChange={setDirty}
            onSubmitResult={onSubmitResult}
          />
        </div>
      </section>

      {destinoPendiente && (
        <Modal onClose={() => setDestinoPendiente(null)} labelledBy="advertencia-titulo">
          <h2 id="advertencia-titulo" className="font-display text-2xl">
            Tenés cambios sin guardar
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            El nombre, la descripción, el precio, la capacidad o la ubicación tienen cambios que
            todavía no se guardaron. Si salís sin guardar, se pierden — las fotos y el video no,
            esos ya quedaron guardados solos.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              form={FORM_ID}
              disabled={guardando}
              onClick={() => setGuardando(true)}
              className={primaryButtonClass}
            >
              {guardando ? "Guardando…" : "Guardar y salir"}
            </button>
            <button type="button" onClick={salirSinGuardar} className={dangerButtonClass}>
              Salir sin guardar
            </button>
            <button
              type="button"
              onClick={() => setDestinoPendiente(null)}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Seguir editando
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
