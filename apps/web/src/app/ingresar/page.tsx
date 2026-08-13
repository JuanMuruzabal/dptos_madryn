import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Ingresar — Turismo Marcuzzi" };

export default function IngresarPage() {
  return (
    <AuthShell
      eyebrow="Bienvenido de nuevo"
      title="Ingresar"
      subtitle="Accedé a tu cuenta para ver y gestionar tus reservas."
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
