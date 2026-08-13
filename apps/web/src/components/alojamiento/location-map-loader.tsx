"use client";

import dynamic from "next/dynamic";

// `ssr: false` solo se puede usar desde un Client Component (Next.js
// tira error si se llama desde un Server Component) — este archivo existe
// nada más para poder importar <LocationMap> directo desde la página de
// detalle (Server Component) sin que intente prerenderizarlo.
const LocationMap = dynamic(
  () => import("@/components/alojamiento/location-map").then((m) => m.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="h-full w-full animate-pulse bg-sand-dim" />
    ),
  },
);

export { LocationMap as LocationMapLoader };
