"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, LeafletMouseEvent } from "leaflet";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/admin/ui";

// Centro de Puerto Madryn (42°46′S 65°02′O, mismas coordenadas del motivo
// recurrente del hero/footer — TR-012) — punto de partida cuando todavía
// no hay una dirección geocodificada ni coordenadas cargadas.
const DEFAULT_LAT = -42.7667;
const DEFAULT_LNG = -65.0333;

interface LocationPickerProps {
  direccionInicial?: string;
  latInicial?: number;
  lngInicial?: number;
}

function coordsIniciales(lat?: number, lng?: number) {
  return { lat: lat ?? DEFAULT_LAT, lng: lng ?? DEFAULT_LNG };
}

/**
 * Reemplaza los inputs numéricos de lat/lng del formulario de alojamiento
 * (pedido del cliente, 2026-08-13: pedir coordenadas a mano es demasiado
 * complejo para el admin) por un flujo de dirección + mapa: se escribe la
 * calle, "Buscar en el mapa" geocodifica contra Nominatim (OSM, TR-003 ya
 * usa OpenStreetMap) y ubica el pin ahí; el pin queda arrastrable/clickeable
 * para ajustar a mano si el geocoding no da justo en el punto. Los valores
 * reales que viajan al backend siguen siendo lat/lng — este componente solo
 * cambia CÓMO se completan, no el contrato con `alojamientoRequest`
 * (apps/api/internal/http/alojamientos.go), así que no hace falta tocar el
 * backend.
 *
 * Geocoding client-side a propósito (fetch desde el navegador, nunca desde
 * el Server Action): la política de uso de Nominatim pide un User-Agent
 * real y no permite pegarle en volumen — un fetch de navegador ya manda
 * User-Agent/Referer válidos solos, y el límite práctico (1 click de admin
 * por vez) cumple el límite de 1 req/seg sin tener que armar un proxy en
 * apps/api con headers propios para un caso de uso tan chico.
 */
export function LocationPicker({ direccionInicial, latInicial, lngInicial }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  // Snapshot del valor inicial: el mapa se crea una sola vez al montar, así
  // que cambios posteriores de coords (drag/búsqueda) no deben recrearlo.
  // Se lee recién dentro del efecto de montaje (nunca durante el render:
  // pasarle `ref.current` directo a `useState` dispara react-hooks/refs).
  const initialCoordsRef = useRef(coordsIniciales(latInicial, lngInicial));

  const [direccion, setDireccion] = useState(direccionInicial ?? "");
  const [coords, setCoords] = useState(() => coordsIniciales(latInicial, lngInicial));
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const { lat, lng } = initialCoordsRef.current;
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Mismo pin que la vista pública (location-map.tsx), con cursor de
      // arrastre para que se note que se puede mover.
      const icon = L.divIcon({
        className: "",
        html:
          '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
          'cursor:grab;background:#e2725b;border:2px solid #f7f4ef;box-shadow:0 1px 4px rgba(18,51,59,.45)"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
      });

      // Click en cualquier punto del mapa también reubica el pin — misma
      // idea que arrastrarlo, para quien prefiera clickear directo.
      map.on("click", (e: LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  function moverA(lat: number, lng: number) {
    setCoords({ lat, lng });
    markerRef.current?.setLatLng([lat, lng]);
    mapRef.current?.setView([lat, lng], 16);
  }

  async function buscarDireccion() {
    if (!direccion.trim()) {
      setError("Escribí una dirección primero.");
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      // Todos los alojamientos son en Puerto Madryn (alcance del
      // proyecto) — se completa la ciudad/provincia/país acá para que el
      // admin no tenga que escribirlo cada vez.
      const query = `${direccion.trim()}, Puerto Madryn, Chubut, Argentina`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data: Array<{ lat: string; lon: string }> = await res.json();
      if (!data.length) {
        setError("No encontramos esa dirección. Arrastrá el pin en el mapa para marcarla a mano.");
        return;
      }
      moverA(Number(data[0].lat), Number(data[0].lon));
    } catch {
      setError("No se pudo buscar la dirección ahora. Arrastrá el pin en el mapa para marcarla a mano.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <label htmlFor="direccion" className={labelClass}>Dirección</label>
      <div className="flex flex-wrap gap-2">
        <input
          id="direccion"
          name="direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Ej: Blvd. Brown 1234"
          className={`${inputClass} flex-1 min-w-0`}
        />
        <button
          type="button"
          onClick={() => void buscarDireccion()}
          disabled={buscando}
          className={`${secondaryButtonClass} whitespace-nowrap px-4 py-2.5 text-xs`}
        >
          {buscando ? "Buscando…" : "Buscar en el mapa"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">Puerto Madryn, Chubut — no hace falta escribir la ciudad.</p>
      {error && <p role="alert" className="mt-1.5 text-xs text-coral-dark">{error}</p>}

      <div className="isolate mt-3 h-64 overflow-hidden rounded-md border border-ink/10">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        Arrastrá el pin o hacé click en el mapa para ajustar la ubicación exacta.{" "}
        Coordenadas: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </p>

      <input type="hidden" name="lat" value={coords.lat} />
      <input type="hidden" name="lng" value={coords.lng} />
    </div>
  );
}
