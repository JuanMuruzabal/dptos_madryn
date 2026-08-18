import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { fetchImagenesSitio } from "@/lib/api";
import { heroScenes } from "@/lib/scenes";
import { categories } from "@/lib/categories";
import { AUTH_FONDO_LOGIN_CLAVE, AUTH_FONDO_LOGIN_GRADIENT } from "@/lib/auth-fondo";
import { ImagenSitioSlot } from "@/components/admin/imagen-sitio-slot";

// Ver comentario en app/admin/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Editor de página — Panel admin" };

/**
 * Editor de página (T4.13, spec §4.8) — fotos de las páginas principales
 * que no son un alojamiento puntual: el hero de la home (4 escenas que
 * rotan) y las 4 tarjetas de categoría. Alcance de esta ronda: solo
 * fotos, solo home (decisión del cliente, 2026-08-13) — el listado de
 * Alojamiento se edita desde su propia página (T4.13,
 * alojamiento-listado-header.tsx), no desde acá.
 */
export default async function EditorPaginaPage() {
  const token = await getSessionToken();
  if (!token) redirect("/ingresar");

  const imagenes = await fetchImagenesSitio();
  const overrides = new Map(imagenes.map((img) => [img.clave, img.url]));

  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Editor de página</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        Fotos de la home — el hero (rota entre estas cuatro) y las tarjetas de categoría. Sin
        foto cargada, cada una muestra el gradiente de marca por defecto.
      </p>

      <section className="mt-8">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Hero de la home</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {heroScenes
            .filter((scene): scene is typeof scene & { clave: string } => Boolean(scene.clave))
            .map((scene) => (
              <ImagenSitioSlot
                key={scene.clave}
                clave={scene.clave}
                label={scene.place}
                gradient={scene.gradient}
                url={overrides.get(scene.clave)}
              />
            ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Tarjetas de categoría</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories
            .filter((c): c is typeof c & { scene: { clave: string } } => Boolean(c.scene.clave))
            .map((c) => (
              <ImagenSitioSlot
                key={c.scene.clave}
                clave={c.scene.clave}
                label={c.title}
                gradient={c.scene.gradient}
                url={overrides.get(c.scene.clave)}
              />
            ))}
        </div>
      </section>

      {/* Fondo de login/registro (2026-08-17, pedido del cliente, TR-048)
          — una sola foto compartida entre /ingresar y /registrarse. */}
      <section className="mt-10">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">
          Fondo de inicio de sesión / crear cuenta
        </h2>
        <p className="mt-1 max-w-lg text-sm text-ink-soft">
          Se ve desenfocada y oscurecida detrás de la tarjeta blanca, en las dos pantallas.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ImagenSitioSlot
            clave={AUTH_FONDO_LOGIN_CLAVE}
            label="Fondo de login y registro"
            gradient={AUTH_FONDO_LOGIN_GRADIENT}
            url={overrides.get(AUTH_FONDO_LOGIN_CLAVE)}
          />
        </div>
      </section>
    </div>
  );
}
