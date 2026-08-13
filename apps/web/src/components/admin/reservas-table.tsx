"use client";

import { useMemo, useState } from "react";
import type { Reserva, ReservaEstado } from "@turismo-marcuzzi/shared-types";
import { formatARS } from "@/lib/currency";
import { EstadoDot } from "@/components/admin/estado-dot";
import { ReservaRowActions } from "@/components/admin/reserva-row-actions";
import { ReservaEditForm } from "@/components/admin/reserva-edit-form";
import { secondaryButtonClass } from "@/components/admin/ui";

type Filtro = "todas" | ReservaEstado;

const TABS: { valor: Filtro; label: string }[] = [
  { valor: "pendiente", label: "Pendientes" },
  { valor: "confirmada", label: "Confirmadas" },
  { valor: "cancelada", label: "Canceladas" },
  { valor: "todas", label: "Todas" },
];

/** Sin tildes/mayúsculas — para que buscar "peninsula" encuentre
 * "Península" y "GOMEZ" encuentre "Gómez". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function textoBuscable(r: Reserva): string {
  return normalizar(
    [
      r.contactoNombre,
      r.contactoApellido,
      r.contactoDni,
      r.contactoEmail,
      r.contactoTelefono,
      r.alojamiento?.nombre,
      r.usuario?.nombre,
      r.usuario?.email,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Tabla de reservas del panel (T4.9/T4.10) — reemplaza el listado de
 * tarjetas apiladas: una fila por reserva, compacta, con scroll propio (no
 * la página entera) para que cargar más reservas no la vuelva interminable.
 * Los tabs de estado y la búsqueda filtran del lado del cliente sobre el
 * array completo que ya se trajo del servidor — no hay ida y vuelta al
 * backend por cada filtro, así que es instantáneo.
 *
 * T4.10 (pedido del cliente, 2026-08-13): todo el bloque (tabs + buscador +
 * tabla) vive dentro de UNA sola tarjeta blanca — antes eran dos piezas
 * sueltas (una barra de herramientas flotando arriba de una tabla aparte)
 * que además se camuflaban contra el fondo `bg-sand` de la página. Blanco
 * y tonos de gris muy suaves (`ink/5`, `ink/10`) en vez de los tonos
 * "arena" (`sand-dim`) que se usan en el resto del sitio — pauta a
 * mantener en el resto de las herramientas nuevas del panel admin, no algo
 * exclusivo de esta tabla.
 */
export function ReservasTable({
  reservas,
  filtroInicial = "pendiente",
}: {
  reservas: Reserva[];
  filtroInicial?: Filtro;
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [busqueda, setBusqueda] = useState("");
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return reservas.filter((r) => {
      if (filtro !== "todas" && r.estado !== filtro) return false;
      if (termino && !textoBuscable(r).includes(termino)) return false;
      return true;
    });
  }, [reservas, filtro, busqueda]);

  return (
    <div className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 border-b border-ink/10 px-4 py-3">
        {/* Segmented control: mismo tipo de letra que el cuerpo de la
            tabla (sans, oración normal) en vez de tracked-caps (mono,
            mayúsculas, más pensado para eyebrows que para controles de
            filtro) — pedido del cliente, 2026-08-13. */}
        <div className="inline-flex items-center gap-0.5 rounded-full bg-ink/5 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.valor}
              type="button"
              onClick={() => setFiltro(tab.valor)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === tab.valor
                  ? "bg-white text-coral-dark shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, DNI, email…"
          aria-label="Buscar reservas"
          className="w-full rounded-md border border-ink/15 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide sm:ml-auto sm:w-64"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-soft">
          {reservas.length === 0
            ? "Todavía no hay ninguna reserva."
            : busqueda.trim()
              ? "Ninguna reserva coincide con la búsqueda."
              : `No hay reservas ${filtro === "todas" ? "" : TABS.find((t) => t.valor === filtro)?.label.toLowerCase() + " "}en este momento.`}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink/10 text-left text-xs font-medium text-ink-soft">
                <th className="w-8 py-3 pl-4" aria-hidden />
                <th className="py-3 pr-4">Alojamiento</th>
                <th className="py-3 pr-4">Fechas</th>
                <th className="py-3 pr-4">Contacto</th>
                <th className="py-3 pr-4">DNI</th>
                <th className="py-3 pr-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((reserva) => {
                const abierta = expandidaId === reserva.id;
                return (
                  <FilaReserva
                    key={reserva.id}
                    reserva={reserva}
                    abierta={abierta}
                    onToggle={() => setExpandidaId(abierta ? null : reserva.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaReserva({
  reserva,
  abierta,
  onToggle,
}: {
  reserva: Reserva;
  abierta: boolean;
  onToggle: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const puedeEditar = reserva.estado === "pendiente" || reserva.estado === "confirmada";

  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={abierta}
        className={`cursor-pointer border-b border-ink/10 transition-colors hover:bg-ink/[0.03] ${abierta ? "bg-ink/[0.03]" : ""}`}
      >
        <td className="py-3 pl-4">
          <EstadoDot estado={reserva.estado} />
        </td>
        <td className="py-3 pr-4 font-medium text-ink">
          {reserva.alojamiento?.nombre ?? "Alojamiento"}
        </td>
        <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">
          {reserva.fechaInicio} → {reserva.fechaFin}
        </td>
        <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">
          {reserva.contactoNombre} {reserva.contactoApellido}
        </td>
        {/* DNI como dato principal (T4.10, pedido del cliente): es lo que
            el admin coteja contra el pago que le llega — más peso visual
            que el resto de los datos secundarios de la fila. */}
        <td className="py-3 pr-4 font-semibold whitespace-nowrap text-ink tabular-nums">
          {reserva.contactoDni || "—"}
        </td>
        <td className="py-3 pr-4 text-right whitespace-nowrap text-ink-soft">
          {formatARS(reserva.total)}
        </td>
      </tr>

      {abierta && (
        <tr className="border-b border-ink/10 bg-ink/[0.03]">
          <td colSpan={6} className="px-4 py-4">
            {editando ? (
              <ReservaEditForm reserva={reserva} onCancel={() => setEditando(false)} />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-ink-soft sm:grid-cols-3">
                  <div>
                    <dt className="tracked-caps font-semibold">Email</dt>
                    <dd className="mt-0.5 text-ink">{reserva.contactoEmail}</dd>
                  </div>
                  <div>
                    <dt className="tracked-caps font-semibold">Teléfono</dt>
                    <dd className="mt-0.5 text-ink">{reserva.contactoTelefono}</dd>
                  </div>
                  {reserva.usuario && (
                    <div>
                      <dt className="tracked-caps font-semibold">Cuenta</dt>
                      <dd className="mt-0.5 text-ink">
                        {reserva.usuario.nombre} ({reserva.usuario.email})
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ReservaRowActions id={reserva.id} estado={reserva.estado} />
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditando(true);
                      }}
                      className={`${secondaryButtonClass} px-4 py-2 text-xs`}
                    >
                      Editar
                    </button>
                  )}
                </div>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
