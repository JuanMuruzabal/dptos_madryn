import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta un server.js standalone con solo los node_modules que
  // realmente se usan en runtime (traza las dependencias reales) — la
  // imagen Docker de producción (apps/web/Dockerfile) copia esta carpeta
  // en vez de todo node_modules del monorepo.
  output: "standalone",
  // Habilita Partial Prerendering vía Cache Components (por defecto en
  // Next.js 16 con este flag): el layout raíz lee cookies() para saber si
  // hay sesión (T1.2), y sin esto esa sola lectura vuelve dinámica TODA
  // la app — landing incluida, que spec §7/FR-10 pide poder servir
  // estática por SEO. Con el flag, solo el fragmento envuelto en
  // <Suspense> (components/account-status.tsx) es dinámico; el resto de
  // cada página vuelve a prerenderizarse.
  // Ver node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
  cacheComponents: true,
  // Server Actions tienen su propio límite de body, independiente del
  // límite de subida del backend Go (T4.17, apps/api maxVideoUploadBytes
  // = 300MB) — por defecto son 1MB, así que subir/reemplazar foto o
  // portada (subirFotoAction/subirFotoPortadaAction, Server Actions con
  // <form action={...}>, el archivo pasa por el server de Next antes de
  // reenviarse al backend) chocaba con ese límite mucho antes de llegar a
  // apps/api. 310MB deja margen sobre los 300MB del backend para el
  // overhead de multipart (boundaries, headers de cada parte).
  experimental: {
    serverActions: {
      bodySizeLimit: "310mb",
    },
  },
  images: {
    // Bug real (2026-08-13): `remotePatterns` (probado en las dos formas
    // documentadas — objeto y `new URL(...)`) rechazaba SIEMPRE las fotos
    // de apps/api con "url" parameter is not allowed, incluso recién
    // reiniciado el server, con el patrón verificado byte a byte contra
    // la URL real (`/_next/image?url=...` devolvía 400 igual). No se
    // llegó a la causa exacta (huele a un bug de esta versión de
    // Next/Turbopack con remotePatterns en dev) — como las fotos de
    // alojamiento vienen de LocalStorage sin comprimir (TR-013, no apto
    // para producción tal cual) y en producción van a servirse desde
    // R2/S3 con su propia optimización/CDN, no hay nada que ganar
    // corriendo el pipeline de optimización de Next sobre disco local:
    // `unoptimized: true` saca a next/image del medio (sirve la URL
    // original tal cual, sin pasar por /_next/image) en vez de perseguir
    // el bug de remotePatterns para un caso que no lo necesita.
    unoptimized: true,
  },
};

export default nextConfig;
