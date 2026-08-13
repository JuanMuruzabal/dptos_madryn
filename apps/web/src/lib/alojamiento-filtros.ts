import type { AlojamientoFiltros } from "@/lib/api";

type SearchParams = { [key: string]: string | string[] | undefined };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isValidRange(inicio: string, fin: string): boolean {
  // Comparación lexicográfica de YYYY-MM-DD equivale a comparación
  // cronológica — no hace falta parsear a Date acá.
  return DATE_RE.test(inicio) && DATE_RE.test(fin) && fin > inicio;
}

/**
 * Traduce los searchParams crudos de /alojamiento (T2.2) a filtros
 * tipados. Cualquier valor mal formado se ignora en silencio en vez de
 * mandarle un filtro roto a `fetchAlojamientos` — la URL la puede escribir
 * a mano cualquiera, no solo el formulario de filtros.
 */
export function parseAlojamientoFiltros(sp: SearchParams): AlojamientoFiltros {
  const filtros: AlojamientoFiltros = {};

  const fechaInicio = first(sp.fecha_inicio);
  const fechaFin = first(sp.fecha_fin);
  if (fechaInicio && fechaFin && isValidRange(fechaInicio, fechaFin)) {
    filtros.fechaInicio = fechaInicio;
    filtros.fechaFin = fechaFin;
  }

  const huespedes = Number(first(sp.huespedes));
  if (Number.isInteger(huespedes) && huespedes > 0) {
    filtros.huespedes = huespedes;
  }

  const precioMin = Number(first(sp.precio_min));
  if (Number.isFinite(precioMin) && precioMin >= 0 && first(sp.precio_min)) {
    filtros.precioMin = precioMin;
  }

  const precioMax = Number(first(sp.precio_max));
  if (Number.isFinite(precioMax) && precioMax >= 0 && first(sp.precio_max)) {
    filtros.precioMax = precioMax;
  }

  return filtros;
}
