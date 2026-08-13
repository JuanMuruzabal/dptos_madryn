"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

interface LocationMapProps {
  lat: number;
  lng: number;
  nombre: string;
}

/**
 * Mapa de ubicación (T2.4, spec §4.2) — Leaflet + OpenStreetMap (TR-003).
 *
 * Leaflet imperativo (sin react-leaflet) a propósito: react-leaflet crashea
 * con "Cannot read properties of undefined (reading 'appendChild')" al
 * navegar con el botón "atrás" del navegador dentro del App Router — el
 * efecto de limpieza de <MapContainer> corre después de que React ya sacó
 * el nodo del DOM. Manejando `L.map()`/`map.remove()` a mano en un único
 * efecto con su propio cleanup, el orden queda bajo nuestro control.
 */
export function LocationMap({ lat, lng, nombre }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

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

      // Pin propio en vez del ícono azul por defecto de Leaflet: además de
      // quedar en la paleta de marca, evita el bug clásico de bundlers con
      // las rutas de imagen del ícono default (busca los PNG en una URL
      // relativa que Webpack/Turbopack no resuelve sola).
      const icon = L.divIcon({
        className: "",
        html:
          '<span style="display:block;width:16px;height:16px;border-radius:9999px;' +
          'background:#e2725b;border:2px solid #f7f4ef;box-shadow:0 1px 4px rgba(18,51,59,.45)"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([lat, lng], { icon, alt: nombre }).addTo(map);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, nombre]);

  return <div ref={containerRef} className="h-full w-full" />;
}
