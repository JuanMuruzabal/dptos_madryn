"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderarResenaAction } from "@/app/actions/admin";
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/ui";

/** Ocultar/mostrar una reseña (T4.5) — soft delete, nunca borra la fila. */
export function ResenaRowActions({ id, oculta }: { id: string; oculta: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function accionar() {
    startTransition(async () => {
      await moderarResenaAction(id, !oculta);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={accionar}
      className={`${oculta ? secondaryButtonClass : dangerButtonClass} px-4 py-2 text-xs`}
    >
      {pending ? "…" : oculta ? "Mostrar" : "Ocultar"}
    </button>
  );
}
