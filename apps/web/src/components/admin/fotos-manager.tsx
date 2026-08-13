"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { borrarFotoAction, subirFotoAction, type AdminFormState } from "@/app/actions/admin";
import { primaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/** Carga/borrado de fotos y video (T2.1/T4.2/T4.13) — el mismo mecanismo
 * de storage (LocalStorage en dev, TR-013) que ya usaba el seed de datos
 * de prueba, ahora disponible desde el panel en vez de solo por script.
 * Se usa tanto en /admin/alojamientos/{id} como directamente en la página
 * pública del alojamiento cuando la ve un admin (T4.13, "abrir la página
 * del alojamiento... más dinámica"). */
export function FotosManager({ alojamientoId, fotos }: { alojamientoId: string; fotos: Foto[] }) {
  const subir = subirFotoAction.bind(null, alojamientoId);
  const [state, formAction, pending] = useActionState(subir, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [borrando, startBorrar] = useTransition();
  const router = useRouter();

  // Limpia el input de archivo después de una subida exitosa, para poder
  // encadenar otra sin tener que reabrir el selector a mano — reacciona al
  // cambio de estado en vez de resetear "a ciegas" en el submit (eso
  // interferiría con el tracking de pending de useActionState). Depende de
  // `state` entero, no de `state.success`: useActionState devuelve un
  // objeto nuevo en cada submit aunque el valor de `success` no cambie
  // (dos subidas exitosas seguidas), así que solo `state.success` como dep
  // no dispararía el reset la segunda vez.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  function borrar(fotoId: string) {
    startBorrar(async () => {
      await borrarFotoAction(alojamientoId, fotoId);
      router.refresh();
    });
  }

  return (
    <div>
      {fotos.length > 0 && (
        <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fotos.map((foto) => (
            <li key={foto.id} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-sand-dim">
              {foto.tipo === "video" ? (
                <div className="flex h-full w-full items-center justify-center bg-ink text-sand">
                  <span aria-hidden className="text-2xl">▶</span>
                </div>
              ) : (
                <Image src={foto.url} alt="" fill sizes="200px" className="object-cover" />
              )}
              <button
                type="button"
                disabled={borrando}
                onClick={() => borrar(foto.id)}
                aria-label="Borrar foto"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-sm text-sand opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="foto"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          required
          className="text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-ink/5 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-ink/10"
        />
        <button type="submit" disabled={pending} className={`${primaryButtonClass} px-4 py-2 text-xs`}>
          {pending ? "Subiendo…" : "Subir foto o video"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-coral-dark">{state.error}</p>}
    </div>
  );
}
