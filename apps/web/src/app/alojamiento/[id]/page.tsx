import Link from "next/link";
import type { Metadata } from "next";
import type { Usuario } from "@turismo-marcuzzi/shared-types";
import { notFound } from "next/navigation";
import { fetchAlojamiento, fetchDisponibilidad, fetchMe, fetchMisReservas, fetchResenas } from "@/lib/api";
import { formatARS } from "@/lib/currency";
import { getSessionToken } from "@/lib/session";
import { Gallery } from "@/components/alojamiento/gallery";
import { AvailabilityCalendar } from "@/components/alojamiento/availability-calendar";
import { LocationMapLoader } from "@/components/alojamiento/location-map-loader";
import { StarRating } from "@/components/alojamiento/star-rating";
import { ResenasList } from "@/components/alojamiento/resenas-list";
import { ResenaForm } from "@/components/alojamiento/resena-form";
import { AlojamientoForm } from "@/components/admin/alojamiento-form";
import { FotosManager } from "@/components/admin/fotos-manager";
import { actualizarAlojamientoAction, activarAlojamientoAction } from "@/app/actions/admin";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";

// Sin shell estático real acá (todo depende del `id`) y con notFound()
// necesitando un status HTTP correcto (ver comentario más abajo), esta
// ruta se saca a propósito de la validación "instant" de Cache Components
// — si no, Next tira error de prerender por leer fetch sin Suspense.
export const instant = false;

export async function generateMetadata(
  props: PageProps<"/alojamiento/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const alojamiento = await fetchAlojamiento(id);

  if (!alojamiento) {
    return { title: "Alojamiento no encontrado — Turismo Marcuzzi" };
  }

  return {
    title: `${alojamiento.nombre} — Turismo Marcuzzi`,
    description:
      alojamiento.descripcion ||
      `Alojamiento en Puerto Madryn para hasta ${alojamiento.capacidad} huéspedes.`,
  };
}

// Detalle (T2.3/T2.4/T2.5, T3.1/T3.2/T3.4) — a propósito SIN Suspense acá,
// a diferencia de /alojamiento: esta página no tiene contenido estático
// real que valga la pena preservar (todo depende del `id`), y si se
// envuelve `notFound()` en un Suspense, el shell ya mandó el header 200
// antes de que se resuelva el fetch — el 404 se ve bien en pantalla pero
// el status HTTP queda en 200 (mal para SEO/FR-10). Sin Suspense, la
// respuesta se bufferea entera y el status sale correcto.
export default async function AlojamientoDetailPage(props: PageProps<"/alojamiento/[id]">) {
  const { id } = await props.params;
  const alojamiento = await fetchAlojamiento(id);
  if (!alojamiento) notFound();

  const token = await getSessionToken();
  const [disponibilidad, resenas, misReservas, usuario, searchParams] = await Promise.all([
    fetchDisponibilidad(id),
    fetchResenas(id),
    token ? fetchMisReservas(token) : Promise.resolve([]),
    token ? fetchMe(token) : Promise.resolve(null),
    props.searchParams,
  ]);

  // Una cuenta admin no interactúa como cliente (pedido del cliente,
  // 2026-08-13) — solo navega para verificar cambios aplicados desde el
  // panel. El backend ya rechaza el POST de reserva/reseña para este rol
  // (defensa en profundidad, ver reservas.go/resenas.go); esto es la UX.
  const esAdmin = usuario?.rol === "administrador";

  // Modo editor (T4.14, pedido del cliente 2026-08-13): a diferencia de
  // T4.13, ya NO aparece automáticamente para cualquier admin que navegue
  // hasta acá — solo cuando llega desde el botón "Editar" del panel
  // (/admin/alojamientos, alojamientos-table.tsx), que agrega
  // ?modo=editor. Navegando la página como cualquier visitante, un admin
  // ve exactamente lo mismo que un cliente (salvo que no puede reservar,
  // eso sigue siendo independiente — ver AvailabilityCalendar esAdmin).
  const modoEditor = esAdmin && searchParams.modo === "editor";

  // T3.4: solo puede reseñar quien tiene una reserva `confirmada` real de
  // ESTE alojamiento — el backend vuelve a exigirlo en el POST, esto es
  // nada más para no mostrar un formulario que sabemos que va a rechazar.
  const puedeResenar =
    !esAdmin &&
    misReservas.some((r) => r.alojamiento?.id === id && r.estado === "confirmada");

  // T3.5: mis propias reservas de este alojamiento (para pintarlas
  // naranja/verde en el calendario, distinto de lo ocupado por otros).
  const misReservasDeEsteAlojamiento = misReservas.filter((r) => r.alojamiento?.id === id);
  const misReservasAqui = misReservasDeEsteAlojamiento.map((r) => ({
    fechaInicio: r.fechaInicio,
    fechaFin: r.fechaFin,
    estado: r.estado,
  }));

  // T3.7: con una reserva pendiente propia acá, el calendario se bloquea
  // hasta que se confirme — evita abrir una segunda reserva paralela
  // sobre el mismo alojamiento mientras la primera se coordina.
  const tieneReservaPendiente = misReservasDeEsteAlojamiento.some(
    (r) => r.estado === "pendiente",
  );

  return (
    <main className="flex-1 bg-sand pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-(--container-max) px-6 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {modoEditor ? (
              <ModoEditor id={id} alojamiento={alojamiento} />
            ) : (
              <>
                {/* T4.18 (pedido del cliente, 2026-08-13): "Modo editor"
                    tiene que ser lo primero que ve un admin al entrar a la
                    página (no un link chico entre medio del contenido) —
                    mismo estilo de banner que tenía "Vista de
                    administrador" antes de sacarse (TR-027). */}
                {esAdmin && (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dune/30 bg-dune/10 px-5 py-4">
                    <div>
                      <p className="tracked-caps text-xs font-semibold text-[#8a6a2e]">
                        Vista de administrador
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">
                        Editá los datos, la galería y el video de este alojamiento.
                      </p>
                    </div>
                    <Link href={`/alojamiento/${id}?modo=editor`} className={primaryButtonClass}>
                      Modo editor
                    </Link>
                  </div>
                )}

                <Gallery
                  fotos={alojamiento.fotos}
                  nombre={alojamiento.nombre}
                  placeholderSeed={alojamiento.id}
                />
                <div className="mt-8">
                  <InfoAlojamiento alojamiento={alojamiento} />
                </div>
              </>
            )}

            <div className="horizon-rule my-10" />

            <section>
              <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Reseñas</h2>
              <ResenasList resenas={resenas} />
              {puedeResenar && <ResenaForm alojamientoId={id} />}
            </section>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-md border border-ink/10 bg-white/60 p-6 lg:sticky lg:top-28">
              <p className="text-xl font-medium text-ink">
                {formatARS(alojamiento.precioNoche)}
                <span className="text-sm text-ink-soft"> /noche</span>
              </p>
              <div className="mt-6">
                <AvailabilityCalendar
                  alojamientoId={id}
                  alojamientoNombre={alojamiento.nombre}
                  ocupado={disponibilidad.ocupado}
                  misReservasAqui={misReservasAqui}
                  tieneReservaPendiente={tieneReservaPendiente}
                  precioNoche={alojamiento.precioNoche}
                  estaLogueado={Boolean(token)}
                  contactoPrefill={usuario ? contactoPrefillDesdeUsuario(usuario) : undefined}
                  esAdmin={esAdmin}
                />
              </div>
            </div>
          </aside>
        </div>

        {/* T4.21 (pedido del cliente, 2026-08-14): en modo editor este
            mapa de solo lectura queda oculto — el LocationPicker de
            AlojamientoForm (al final de "Datos, precio y ubicación") ya
            muestra y edita la ubicación ahí mismo; mostrar los dos a la
            vez era confuso ("ver el mapa 2 veces"). Solo se ve acá en la
            página normal, la que ve un visitante real. */}
        {!modoEditor && (
          <div className="mt-16">
            <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Ubicación</h2>
            {/* `isolate` (CSS isolation: isolate) a propósito — bug real,
                2026-08-13: Leaflet le pone z-index propio a sus panes/
                controles (hasta ~1000) y su contenedor no arma un contexto
                de apilamiento propio, así que esos valores competían
                directo contra el z-50 del header en el contexto raíz — al
                scrollear el mapa hasta pasar por debajo del header fijo, el
                mapa ganaba. `isolate` contiene el desorden de z-index de
                Leaflet adentro de este div, sin que se escape hacia arriba
                (mismo principio que el portal del modal, pero al revés: ahí
                había que escapar un contexto, acá hay que crear uno). */}
            <div className="isolate mt-4 h-[400px] overflow-hidden rounded-md">
              <LocationMapLoader
                lat={alojamiento.lat}
                lng={alojamiento.lng}
                nombre={alojamiento.nombre}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Modo editor (T4.14/T4.15) — reemplaza la galería/info normales cuando
 * un admin llega acá con `?modo=editor` (desde "Editar" en el panel, desde
 * "Modo editor" en la propia tarjeta del listado, o directo al crear un
 * alojamiento nuevo, T4.19). La foto de portada YA NO se edita acá — se
 * trasladó a la tarjeta del listado (foto-portada-card-editor.tsx, pedido
 * del cliente 2026-08-13): acá solo quedan los datos/precio y la galería
 * de fotos/video del detalle.
 */
function ModoEditor({
  id,
  alojamiento,
}: {
  id: string;
  alojamiento: NonNullable<Awaited<ReturnType<typeof fetchAlojamiento>>>;
}) {
  const actualizar = actualizarAlojamientoAction.bind(null, id);
  const publicar = activarAlojamientoAction.bind(null, id);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dune/30 bg-dune/10 px-4 py-2.5">
        <p className="tracked-caps text-xs font-semibold text-[#8a6a2e]">Modo editor</p>
        <div className="flex gap-2">
          <Link href={`/alojamiento/${id}`} className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}>
            Ver página
          </Link>
          <Link href="/admin/alojamientos" className={`${secondaryButtonClass} px-4 py-1.5 text-xs`}>
            Volver al panel
          </Link>
        </div>
      </div>

      {/* T4.19: un alojamiento recién creado (o dado de baja) queda oculto
          del listado público hasta que se publica a propósito — evita que
          un borrador a medio completar (sin fotos, con datos de relleno)
          aparezca ahí mientras el admin todavía lo está armando. */}
      {!alojamiento.activo && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-coral/30 bg-coral/10 px-4 py-2.5">
          <div>
            <p className="tracked-caps text-xs font-semibold text-coral-dark">Todavía no publicado</p>
            <p className="mt-1 text-xs text-ink-soft">
              No aparece en el listado de alojamientos hasta que lo publiques.
            </p>
          </div>
          <form action={publicar}>
            <button type="submit" className={`${primaryButtonClass} px-4 py-1.5 text-xs`}>
              Publicar
            </button>
          </form>
        </div>
      )}

      {/* T4.21 (pedido del cliente, 2026-08-14): orden fotos → datos y
          precio → ubicación — antes era datos primero. La ubicación
          (LocationPicker) vive DENTRO de AlojamientoForm, al final del
          form (ver alojamiento-form.tsx), así que queda última sin
          necesitar una tercera sección separada acá. */}
      <section className="rounded-md border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">
          Fotos y video de la página del alojamiento
        </h2>
        <div className="mt-4">
          <FotosManager alojamientoId={id} fotos={alojamiento.fotos} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="tracked-caps text-xs font-semibold text-ink-soft">Datos, precio y ubicación</h2>
        <div className="mt-4">
          <AlojamientoForm alojamiento={alojamiento} action={actualizar} />
        </div>
      </section>
    </div>
  );
}

/** Bloque de texto informativo del alojamiento — solo la vista normal
 * (T4.14: la de admin ya no comparte este bloque, ModoEditor tiene su
 * propio layout arriba). */
function InfoAlojamiento({ alojamiento }: { alojamiento: NonNullable<Awaited<ReturnType<typeof fetchAlojamiento>>> }) {
  return (
    <>
      <p className="tracked-caps text-xs font-semibold text-ink-soft">Alojamiento</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl md:text-4xl">{alojamiento.nombre}</h1>
        {alojamiento.ratingPromedio !== undefined && (
          <span className="flex items-center gap-1.5 text-sm text-ink-soft">
            <StarRating rating={alojamiento.ratingPromedio} />
            {alojamiento.ratingPromedio.toFixed(1)} ({alojamiento.totalResenas})
          </span>
        )}
      </div>
      {alojamiento.direccion && <p className="mt-2 text-ink-soft">{alojamiento.direccion}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="tracked-caps rounded-full border border-ink/15 px-3 py-1 text-[0.65rem] font-semibold text-ink-soft">
          Hasta {alojamiento.capacidad} {alojamiento.capacidad === 1 ? "huésped" : "huéspedes"}
        </span>
      </div>

      {alojamiento.descripcion && (
        <p className="mt-6 max-w-2xl whitespace-pre-line text-ink-soft">{alojamiento.descripcion}</p>
      )}
    </>
  );
}

/** Usuario.nombre es un solo campo (nombre completo) — el formulario de
 * contacto de la reserva (T3.5) quiere nombre/apellido separados. Split
 * ingenuo por el primer espacio: es solo un precargado editable, no hace
 * falta que sea perfecto. */
function contactoPrefillDesdeUsuario(usuario: Usuario) {
  const partes = usuario.nombre.trim().split(/\s+/);
  return {
    nombre: partes[0] ?? "",
    apellido: partes.slice(1).join(" "),
    email: usuario.email,
    telefono: usuario.telefono ?? "",
  };
}
