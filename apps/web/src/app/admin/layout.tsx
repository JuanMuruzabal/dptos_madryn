import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";

// Todo /admin lee cookies() de punta a punta (sesión + rol) sin Suspense a
// propósito (no tiene sentido mantenerle un shell estático prerenderizable
// a una sección 100% autenticada) — mismo opt-out que /alojamiento/[id],
// pero acá hace falta en CADA page.tsx del árbol (layout.tsx no alcanza:
// Next valida "instant" por ruta hoja, no por layout).
export const instant = false;

/**
 * Layout del panel admin (T4.1) — chequeo "seguro" (DAL, misma idea que
 * /perfil): getSession() ya valida la firma del JWT (decodeJwtPayload +
 * expiración), acá solo se agrega el chequeo de rol. proxy.ts (optimista)
 * ya manda a /ingresar a quien no tiene cookie; esto cubre al que sí tiene
 * sesión pero es rol 'cliente' — nunca debe ver ni un parpadeo del panel.
 *
 * No hay Suspense acá a propósito, a diferencia de account-status.tsx:
 * todo /admin es una sección autenticada de punta a punta, no tiene
 * sentido mantenerle un shell estático prerenderizable (nadie anónimo
 * entra) — se vuelve dinámica entera, que es lo esperado.
 *
 * AdminNav (T4.8, pulido de usabilidad) reemplaza la lista de links plana
 * por una con ícono + color por categoría + subrayado de la sección
 * activa, para que sea obvio de un vistazo dónde estás parado.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.rol !== "administrador") redirect("/");

  return (
    <main className="bg-tapiz flex-1 px-6 pt-[var(--header-height)] pb-24 md:px-10">
      <div className="mx-auto max-w-(--container-max)">
        <p className="tracked-caps mb-3 text-xs font-semibold text-ink-soft">
          Panel de administración
        </p>

        <AdminNav />

        {children}
      </div>
    </main>
  );
}
