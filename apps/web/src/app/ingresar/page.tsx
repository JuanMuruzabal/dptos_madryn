import Link from "next/link";
import type { Metadata } from "next";
import { fetchImagenesSitioMap } from "@/lib/api";
import { AUTH_FONDO_LOGIN_CLAVE } from "@/lib/auth-fondo";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

// fetchImagenesSitioMap usa cache:"no-store" (T4.13) — sin esto, Cache
// Components tira error de prerender por leer un fetch dinámico sin
// Suspense (mismo motivo que app/alojamiento/[id]/page.tsx). Sin Suspense
// acá a propósito: es una sola foto de fondo, partir la página en shell
// estático + isla dinámica no vale la complejidad para este caso.
export const instant = false;

export const metadata: Metadata = { title: "Iniciar sesión — Turismo Marcuzzi" };

export default async function IngresarPage() {
  const imagenes = await fetchImagenesSitioMap();

  return (
    <AuthShell
      title="Iniciar sesión"
      backgroundUrl={imagenes.get(AUTH_FONDO_LOGIN_CLAVE)}
      footer={
        <>
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registrarse" className="font-medium text-tide hover:underline">
            Creá una acá
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
