"use client";

import Image from "next/image";
import { type CSSProperties, useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarImagenSitioAction, subirImagenSitioAction, type AdminFormState } from "@/app/actions/admin";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/**
 * Un slot del "editor de página" (T4.13) — una clave fija (ver
 * lib/scenes.ts/categories.ts), con la foto actual (o el gradiente de
 * marca por defecto si no hay override) y controles para reemplazarla o
 * sacarla.
 */
export function ImagenSitioSlot({
  clave,
  label,
  gradient,
  url,
}: {
  clave: string;
  label: string;
  gradient: string;
  url?: string;
}) {
  const subir = subirImagenSitioAction.bind(null, clave);
  const [state, formAction, pending] = useActionState(subir, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [borrando, startBorrar] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  function borrar() {
    startBorrar(async () => {
      await borrarImagenSitioAction(clave);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-sand-dim">
        {url ? (
          <Image src={url} alt={label} fill sizes="320px" className="object-cover" />
        ) : (
          <div
            className="photo-placeholder absolute inset-0"
            style={{ "--scene-gradient": gradient } as CSSProperties}
          />
        )}
      </div>

      <p className="mt-3 text-sm font-medium text-ink">{label}</p>

      <form ref={formRef} action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="imagen"
          accept="image/jpeg,image/png,image/webp"
          required
          className="w-full text-xs text-ink-soft file:mr-2 file:rounded-full file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-ink/10"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={`${primaryButtonClass} px-3 py-1.5 text-xs`}>
            {pending ? "Subiendo…" : "Reemplazar"}
          </button>
          {url && (
            <button
              type="button"
              disabled={borrando}
              onClick={borrar}
              className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
            >
              Quitar
            </button>
          )}
        </div>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs text-coral-dark">{state.error}</p>}
    </div>
  );
}
