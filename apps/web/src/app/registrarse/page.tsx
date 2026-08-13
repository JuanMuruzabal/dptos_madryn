import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta — Turismo Marcuzzi" };

export default function RegistrarsePage() {
  return (
    <AuthShell
      eyebrow="Turismo Marcuzzi"
      title="Crear cuenta"
      subtitle="Registrate para reservar tu alojamiento y, una vez confirmado, acceder a experiencias, servicio turístico y traslados."
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
