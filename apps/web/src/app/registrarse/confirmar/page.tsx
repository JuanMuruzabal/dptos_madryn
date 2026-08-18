import type { Metadata } from "next";
import { fetchImagenesSitioMap } from "@/lib/api";
import { AUTH_FONDO_LOGIN_CLAVE } from "@/lib/auth-fondo";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmCodeForm } from "@/components/auth/confirm-code-form";

// Ver comentario en app/ingresar/page.tsx sobre por qué instant = false.
export const instant = false;

export const metadata: Metadata = { title: "Confirmá tu cuenta — Turismo Marcuzzi" };

/**
 * Pantalla de confirmación de código (2026-08-17, Prompt 1 — "dejá
 * preparada visualmente... sin conectar todavía el envío ni la validación
 * real, eso va en el Prompt 2"). Hoy no hay forma real de llegar acá desde
 * el flujo de alta (RegisterForm sigue creando la cuenta directo, sin
 * gating de email todavía) — existe como ruta propia para poder revisar
 * el diseño, no como parte del flujo real hasta que el Prompt 2 conecte
 * la lógica.
 */
export default async function ConfirmarCuentaPage() {
  const imagenes = await fetchImagenesSitioMap();

  return (
    <AuthShell
      title="Confirmá tu cuenta"
      backgroundUrl={imagenes.get(AUTH_FONDO_LOGIN_CLAVE)}
      footer={<>Revisá también la carpeta de spam si no lo ves.</>}
    >
      <ConfirmCodeForm />
    </AuthShell>
  );
}
