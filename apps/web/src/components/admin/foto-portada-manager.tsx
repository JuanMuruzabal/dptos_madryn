"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef } from "react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { subirFotoPortadaAction, type AdminFormState } from "@/app/actions/admin";
import { primaryButtonClass } from "@/components/admin/ui";

const initialState: AdminFormState = {};

/**
 * Foto de portada (T4.14/T4.15) — la miniatura de la tarjeta del listado
 * de Alojamiento, separada de la galería de fotos/video del detalle
 * (FotosManager, en el modo editor). Solo imagen. Vive directamente en el
 * listado (foto-portada-card-editor.tsx la usa dentro de un toggle en
 * cada tarjeta) — pedido del cliente, 2026-08-13: antes vivía en el modo
 * editor del alojamiento puntual.
 */
export function FotoPortadaManager({ alojamientoId, portada }: { alojamientoId: string; portada?: Foto }) {
  const subir = subirFotoPortadaAction.bind(null, alojamientoId);
  const [state, formAction, pending] = useActionState(subir, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <div>
      {portada && (
        <div className="relative aspect-[4/3] w-32 overflow-hidden rounded-md bg-sand-dim">
          <Image src={portada.url} alt="" fill sizes="150px" className="object-cover" />
        </div>
      )}

      <form ref={formRef} action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="portada"
          accept="image/jpeg,image/png,image/webp"
          required
          className="w-full text-xs text-ink-soft file:mr-2 file:rounded-full file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-ink/10"
        />
        <button type="submit" disabled={pending} className={`${primaryButtonClass} px-3 py-1.5 text-xs`}>
          {pending ? "Subiendo…" : portada ? "Reemplazar" : "Subir"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs text-coral-dark">{state.error}</p>}
    </div>
  );
}
