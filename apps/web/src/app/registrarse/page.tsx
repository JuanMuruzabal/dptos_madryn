import Link from "next/link";
import type { Metadata } from "next";
import { fetchImagenesSitioMap } from "@/lib/api";
import { AUTH_FONDO_LOGIN_CLAVE } from "@/lib/auth-fondo";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

// Ver comentario en app/ingresar/page.tsx sobre por qué instant = false.
export const instant = false;

export const metadata: Metadata = { title: "Crear cuenta — Turismo Marcuzzi" };

export default async function RegistrarsePage() {
  const imagenes = await fetchImagenesSitioMap();

  return (
    <AuthShell
      title="Crear cuenta"
      backgroundUrl={imagenes.get(AUTH_FONDO_LOGIN_CLAVE)}
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/ingresar" className="font-medium text-tide hover:underline">
            Ingresá acá
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
