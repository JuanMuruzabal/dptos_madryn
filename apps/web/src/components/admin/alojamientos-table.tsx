"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { formatARS } from "@/lib/currency";
import { AlojamientoBajaButton } from "@/components/admin/alojamiento-baja-button";
import { secondaryButtonClass } from "@/components/admin/ui";

type Filtro = "todos" | "activos" | "baja";

const TABS: { valor: Filtro; label: string }[] = [
  { valor: "activos", label: "Activos" },
  { valor: "baja", label: "De baja" },
  { valor: "todos", label: "Todos" },
];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Tabla de alojamientos del panel (T4.11) — misma lógica que
 * reservas-table.tsx (T4.9/T4.10): tarjeta blanca única, tabs+búsqueda
 * client-side, filas de una línea que se expanden al click con el detalle
 * y las acciones al final. Reemplaza el listado de tarjetas apiladas.
 */
export function AlojamientosTable({ alojamientos }: { alojamientos: Alojamiento[] }) {
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [busqueda, setBusqueda] = useState("");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return alojamientos.filter((a) => {
      if (filtro === "activos" && !a.activo) return false;
      if (filtro === "baja" && a.activo) return false;
      if (termino && !normalizar(`${a.nombre} ${a.direccion}`).includes(termino)) return false;
      return true;
    });
  }, [alojamientos, filtro, busqueda]);

  return (
    <div className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 border-b border-ink/10 px-4 py-3">
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
          placeholder="Buscar por nombre o dirección…"
          aria-label="Buscar alojamientos"
          className="w-full rounded-md border border-ink/15 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide sm:ml-auto sm:w-64"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-soft">
          {alojamientos.length === 0
            ? "Todavía no cargaste ningún alojamiento."
            : busqueda.trim()
              ? "Ningún alojamiento coincide con la búsqueda."
              : "No hay alojamientos en este estado."}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink/10 text-left text-xs font-medium text-ink-soft">
                <th className="w-8 py-3 pl-4" aria-hidden />
                <th className="py-3 pr-4">Nombre</th>
                <th className="py-3 pr-4">Precio / noche</th>
                <th className="py-3 pr-4">Capacidad</th>
                <th className="py-3 pr-4 text-right">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const abierto = expandidoId === a.id;
                return (
                  <FilaAlojamiento
                    key={a.id}
                    alojamiento={a}
                    abierto={abierto}
                    onToggle={() => setExpandidoId(abierto ? null : a.id)}
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

function FilaAlojamiento({
  alojamiento,
  abierto,
  onToggle,
}: {
  alojamiento: Alojamiento;
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={abierto}
        className={`cursor-pointer border-b border-ink/10 transition-colors hover:bg-ink/[0.03] ${abierto ? "bg-ink/[0.03]" : ""}`}
      >
        <td className="py-3 pl-4">
          <span
            role="img"
            aria-label={alojamiento.activo ? "Activo" : "De baja"}
            title={alojamiento.activo ? "Activo" : "De baja"}
            className={`inline-block h-2.5 w-2.5 rounded-full ${alojamiento.activo ? "bg-steppe" : "bg-coral-dark"}`}
          />
        </td>
        <td className="py-3 pr-4 font-medium text-ink">{alojamiento.nombre}</td>
        <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">
          {formatARS(alojamiento.precioNoche)}
        </td>
        <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">
          {alojamiento.capacidad} {alojamiento.capacidad === 1 ? "huésped" : "huéspedes"}
        </td>
        <td className="py-3 pr-4 text-right whitespace-nowrap text-ink-soft">
          {alojamiento.fotos.length}
        </td>
      </tr>

      {abierto && (
        <tr className="border-b border-ink/10 bg-ink/[0.03]">
          <td colSpan={5} className="px-4 py-4">
            <p className="text-xs text-ink-soft">
              {alojamiento.direccion || "Sin dirección cargada."}
            </p>
            {alojamiento.descripcion && (
              <p className="mt-2 max-w-2xl text-sm text-ink">{alojamiento.descripcion}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/alojamiento/${alojamiento.id}?modo=editor`}
                onClick={(e) => e.stopPropagation()}
                className={`${secondaryButtonClass} px-4 py-2 text-xs`}
              >
                Editar
              </Link>
              <Link
                href={`/admin/alojamientos/${alojamiento.id}`}
                onClick={(e) => e.stopPropagation()}
                className={`${secondaryButtonClass} px-4 py-2 text-xs`}
              >
                Disponibilidad
              </Link>
              <span onClick={(e) => e.stopPropagation()}>
                <AlojamientoBajaButton alojamiento={alojamiento} />
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
