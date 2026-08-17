"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Scene } from "@/components/scene";
import type { Scene as SceneData } from "@/lib/scenes";

const SCENE_DURATION_MS = 6500;

/**
 * Hero cinematográfico (brief §2): fondo a sangre completa que va
 * cambiando de escena por crossfade, como el hero de Bungie — pero acá
 * cada escena es un lugar real de la zona, con su propio caption que
 * cambia en sincro con la foto. Es el elemento "firma" de la landing:
 * no decora, ubica ("esto es Península Valdés, temporada de ballenas"),
 * lo que refuerza el conocimiento local que es el diferenciador del
 * producto (spec §1).
 *
 * `scenes` llega como prop (T4.13) en vez de importar `heroScenes`
 * directo: app/page.tsx (Server Component) mezcla los overrides del
 * "editor de página" (ImagenSitio) antes de pasarlas — Hero es cliente
 * (necesita el timer del crossfade) y no puede hacer ese fetch solo.
 */
export function Hero({ scenes }: { scenes: SceneData[] }) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % scenes.length);
    }, SCENE_DURATION_MS);
    return () => clearInterval(id);
  }, [reduceMotion, scenes.length]);

  const scene = scenes[index];

  return (
    <section className="relative flex h-[80vh] min-h-[560px] w-full items-end overflow-hidden bg-ink">
      <AnimatePresence mode="sync">
        <motion.div
          key={scene.place}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 1.4, ease: "easeInOut" }}
        >
          <Scene scene={scene} alt={`${scene.place} — ${scene.caption}`} priority={index === 0} />
        </motion.div>
      </AnimatePresence>

      <div
        className="absolute inset-0"
        style={{ background: "var(--overlay-photo)" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-(--container-max) px-6 pb-16 md:px-10 md:pb-20">
        <p className="tracked-caps mb-4 text-xs font-semibold text-sand/80">
          Puerto Madryn, Chubut — 42°46′S 65°02′O
        </p>
        {/* text-4xl en mobile, no text-5xl (bug real 2026-08-17, "las letras
            no entran"): en mayúsculas + tracking-wide, "ALOJAMIENTOS" solo
            ya se acercaba al ancho disponible en un teléfono angosto
            (~327px) a text-5xl — a text-4xl entra con margen. */}
        <h1 className="font-display max-w-3xl text-4xl uppercase tracking-wide text-sand sm:text-6xl md:text-7xl">
          Alojamientos Madryn
        </h1>
        <p className="mt-6 max-w-xl text-base text-sand/90 md:text-lg">
          Te conseguimos el departamento justo para tu familia, armamos tu
          cronograma de actividades y te resolvemos la movilidad desde que
          bajás del avión. Trato directo, no una plataforma más.
        </p>

        <div className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/alojamiento"
            className="rounded-full bg-coral px-7 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark"
          >
            Ver alojamientos
          </Link>
          <Link
            href="#categorias"
            className="rounded-full border border-sand/60 px-7 py-3 text-sm font-semibold text-sand transition-colors hover:bg-sand hover:text-ink"
          >
            Conocer más
          </Link>
        </div>

        {/* Leyenda + indicadores de escena: en mobile, en flujo normal
            (centrado) debajo de los botones — antes `absolute bottom-8
            right-6` en TODOS los anchos (bug real 2026-08-17, "muy pegada a
            los botones, no centrada"): en una pantalla angosta esa esquina
            queda cerca de donde terminan los botones si estos wrappean a
            dos líneas. Desde md, vuelve al posicionamiento absoluto
            (esquina inferior derecha del bloque de texto — este div ya es
            `relative`) con margen real (`md:right-6 md:bottom-6`, no
            `right-0 bottom-0`; bug real 2026-08-17 #2: quedaba pegada al
            borde exacto la primera vez que se anidó acá adentro). */}
        <div className="mt-8 flex items-center justify-center gap-3 md:absolute md:right-6 md:bottom-6 md:mt-0 md:justify-end">
          <AnimatePresence mode="wait">
            <motion.span
              key={scene.place}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="tracked-caps text-center text-[0.65rem] text-sand/70 md:text-right"
            >
              {scene.place} — {scene.caption}
            </motion.span>
          </AnimatePresence>
          <div className="flex gap-1.5" role="presentation">
            {scenes.map((s, i) => (
              <span
                key={s.place}
                className={`h-1 w-5 rounded-full transition-colors duration-300 ${
                  i === index ? "bg-sand" : "bg-sand/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
