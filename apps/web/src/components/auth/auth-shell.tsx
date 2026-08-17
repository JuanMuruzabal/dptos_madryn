import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Shell compartido por /ingresar y /registrarse — mismo lenguaje visual
 * que la landing (tipografía de título + acento coral, ver TR-023) pero
 * sin la maquinaria del hero: acá la prioridad es que el formulario sea
 * rápido de completar. */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-sand px-6 pt-[var(--header-height)] pb-20">
      <div className="w-full max-w-sm">
        <p className="tracked-caps mb-3 text-center text-xs font-semibold text-ink-soft">
          {eyebrow}
        </p>
        <h1 className="font-display text-center text-3xl">{title}</h1>
        <p className="mt-3 text-center text-sm text-ink-soft">{subtitle}</p>

        <div className="mt-8">{children}</div>

        <p className="mt-6 text-center text-sm text-ink-soft">{footer}</p>
      </div>
    </main>
  );
}

export const authInputClass =
  "w-full rounded-md border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide";

export const authLabelClass = "mb-1.5 block text-sm font-medium text-ink";

export const authSubmitClass =
  "w-full rounded-full bg-coral px-6 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60";
