"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { AuthField, authSubmitClass } from "@/components/auth/auth-shell";

/**
 * Solo visual por ahora (2026-08-17, Prompt 1) — "dejá preparada
 * visualmente... pero sin conectar todavía el envío ni la validación
 * real (eso va en el Prompt 2)". No hay Server Action detrás todavía: el
 * submit no manda nada a ningún lado, y el "Reenviar código" tampoco.
 * Cuando el Prompt 2 (rama feature/) conecte la lógica real, este
 * componente pasa a un form de verdad (useActionState + una Server Action
 * que valide el código contra el que se generó al registrarse).
 */
export function ConfirmCodeForm() {
  const [codigo, setCodigo] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No-op a propósito — ver comentario de arriba.
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <AuthField
        id="codigo"
        name="codigo"
        label="Código de confirmación"
        icon={<KeyRound size={16} />}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Escribí el código que te mandamos"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        required
      />

      <button type="submit" className={`${authSubmitClass} uppercase`}>
        Confirmar cuenta
      </button>

      <p className="text-center text-sm text-ink-soft">
        ¿No te llegó nada?{" "}
        <button type="button" className="font-medium text-tide hover:underline">
          Reenviar código
        </button>
      </p>
    </form>
  );
}
