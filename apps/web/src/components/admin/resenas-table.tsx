"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Resena } from "@turismo-marcuzzi/shared-types";
import { StarRating } from "@/components/alojamiento/star-rating";
import { ResenaRowActions } from "@/components/admin/resena-row-actions";

type Filtro = "todas" | "visibles" | "ocultas";

const TABS: { valor: Filtro; label: string }[] = [
  { valor: "visibles", label: "Visibles" },
  { valor: "ocultas", label: "Ocultas" },
  { valor: "todas", label: "Todas" },
];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Tabla de reseñas del panel (T4.12) — mismo patrón que
 * reservas-table.tsx/alojamientos-table.tsx (TR-021/TR-022/TR-024):
 * tarjeta blanca única, tabs+búsqueda client-side, filas de una línea que
 * se expanden mostrando el texto completo y la acción de moderar al
 * final. Reemplaza el listado de tarjetas apiladas.
 */
export function ResenasTable({ resenas }: { resenas: Resena[] }) {
  const [filtro, setFiltro] = useState<Filtro>("visibles");
  const [busqueda, setBusqueda] = useState("");
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return resenas.filter((r) => {
      if (filtro === "visibles" && r.oculta) return false;
      if (filtro === "ocultas" && !r.oculta) return false;
      if (
        termino &&
        !normalizar(`${r.usuarioNombre} ${r.alojamiento?.nombre ?? ""} ${r.texto}`).includes(termino)
      ) {
        return false;
      }
      return true;
    });
  }, [resenas, filtro, busqueda]);

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
          placeholder="Buscar por usuario, alojamiento o texto…"
          aria-label="Buscar reseñas"
          className="w-full rounded-md border border-ink/15 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide sm:ml-auto sm:w-64"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-soft">
          {resenas.length === 0
            ? "Todavía no hay reseñas."
            : busqueda.trim()
              ? "Ninguna reseña coincide con la búsqueda."
              : `No hay reseñas ${filtro === "todas" ? "" : TABS.find((t) => t.valor === filtro)?.label.toLowerCase() + " "}en este momento.`}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink/10 text-left text-xs font-medium text-ink-soft">
                <th className="w-8 py-3 pl-4" aria-hidden />
                <th className="py-3 pr-4">Usuario</th>
                <th className="py-3 pr-4">Alojamiento</th>
                <th className="py-3 pr-4">Rating</th>
                <th className="py-3 pr-4">Texto</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((resena) => {
                const abierta = expandidaId === resena.id;
                return (
                  <FilaResena
                    key={resena.id}
                    resena={resena}
                    abierta={abierta}
                    onToggle={() => setExpandidaId(abierta ? null : resena.id)}
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

function FilaResena({
  resena,
  abierta,
  onToggle,
}: {
  resena: Resena;
  abierta: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={abierta}
        className={`cursor-pointer border-b border-ink/10 transition-colors hover:bg-ink/[0.03] ${abierta ? "bg-ink/[0.03]" : ""}`}
      >
        <td className="py-3 pl-4">
          <span
            role="img"
            aria-label={resena.oculta ? "Oculta" : "Visible"}
            title={resena.oculta ? "Oculta" : "Visible"}
            className={`inline-block h-2.5 w-2.5 rounded-full ${resena.oculta ? "bg-coral-dark" : "bg-steppe"}`}
          />
        </td>
        <td className="py-3 pr-4 font-medium text-ink whitespace-nowrap">{resena.usuarioNombre}</td>
        <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">
          {resena.alojamiento?.nombre ?? "—"}
        </td>
        <td className="py-3 pr-4 whitespace-nowrap">
          <StarRating rating={resena.rating} size="sm" />
        </td>
        <td className="max-w-xs truncate py-3 pr-4 text-ink-soft">{resena.texto}</td>
      </tr>

      {abierta && (
        <tr className="border-b border-ink/10 bg-ink/[0.03]">
          <td colSpan={5} className="px-4 py-4">
            <p className="max-w-2xl text-sm text-ink">{resena.texto}</p>
            {resena.alojamiento && (
              <Link
                href={`/alojamiento/${resena.alojamiento.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-block text-xs text-tide hover:underline"
              >
                Ver alojamiento →
              </Link>
            )}

            <div className="mt-4" onClick={(e) => e.stopPropagation()}>
              <ResenaRowActions id={resena.id} oculta={resena.oculta} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
