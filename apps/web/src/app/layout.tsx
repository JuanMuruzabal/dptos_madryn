import type { Metadata } from "next";
import { Suspense } from "react";
import { Nunito_Sans, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountStatus, AccountStatusFallback } from "@/components/account-status";
import { PendingReservaBanner } from "@/components/pending-reserva-banner";
import { EsperandoConfirmacionBanner } from "@/components/esperando-confirmacion-banner";
import { AlojamientoConfirmadoBanner } from "@/components/alojamiento-confirmado-banner";
import { NotificationsBell } from "@/components/notifications-bell";

// Títulos: Nunito Sans (restructura tipográfica, 2026-08-13, pedido
// directo del cliente — reemplaza a Vidaloka, ver TR-023 en
// docs/tradeoffs.md, que supera a TR-012 sin borrarla del registro). Un
// solo peso, extra bold: como acá se usa `.variable` (no `.className`),
// next/font no aplica ningún font-weight por sí solo — cargar un único
// peso pesado es lo que hace que los títulos lean como títulos sin tener
// que agregar `font-bold` a cada `<h1>`/`<h2>` del sitio (el peso queda
// fijado también en `.font-display` en globals.css, por las dudas).
const nunitoSans = Nunito_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["800"],
});

// Cuerpo: Inter — sans neutra "de verdad" (a diferencia de IBM Plex Sans,
// elegida antes justamente por NO ser neutra, ver TR-012) para acompañar
// a Nunito Sans sin competirle carácter a los títulos.
const neutralSans = Inter({
  variable: "--font-body-face",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Utilitaria: toma todas las etiquetas/nav/eyebrows (clase .tracked-caps)
// — registro de "carta náutica"/bitácora en vez de agencia boutique. Ver
// TR-012.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Turismo Marcuzzi — Puerto Madryn",
  description:
    "Alojamiento, experiencias, servicio turístico y traslados en Puerto Madryn con atención personalizada: te conseguimos el departamento, armamos tu cronograma y te resolvemos la movilidad desde que bajás del avión.",
};

// No async, y no se lee cookies() acá: eso queda contenido en
// <AccountStatus>, detrás de Suspense, para que el resto del layout
// (header, footer, y por lo tanto cada página que lo usa) siga
// prerenderizable — ver next.config.ts (cacheComponents) y T5.1 en
// docs/implementation-plan.md.
export default function RootLayout({ children }: LayoutProps<"/">) {
  // Dos instancias, no una reutilizada en dos posiciones (2026-08-17,
  // pedido del cliente): el panel mobile necesita accountStatus en su
  // variante "inline" (opciones planas, sin ícono+dropdown — ver
  // account-status.tsx/account-menu.tsx), distinta de la variante
  // "dropdown" del pill de escritorio.
  const accountSlot = (
    <Suspense fallback={<AccountStatusFallback />}>
      <AccountStatus />
    </Suspense>
  );
  const accountSlotMobile = (
    <Suspense fallback={<AccountStatusFallback />}>
      <AccountStatus variant="inline" />
    </Suspense>
  );

  // T3.7: mismo patrón que accountSlot — sin fallback visible (null
  // mientras carga) para no mostrar un placeholder de banner en cada
  // página cuando la mayoría de las veces no hay nada que avisar.
  // T3.9/T4.7: el banner de 5 min (el único bloqueante/crítico) va arriba;
  // debajo, "alojamiento confirmado" (buena noticia, T4.7); al final se
  // apilan las franjas "esperando confirmación" (solo informativas, ya
  // contactado, esperando al admin) — una por cada reserva, cada una con
  // su propio Suspense/fetch (no bloquean entre sí).
  const bannerSlot = (
    <>
      <Suspense fallback={null}>
        <PendingReservaBanner />
      </Suspense>
      <Suspense fallback={null}>
        <AlojamientoConfirmadoBanner />
      </Suspense>
      <Suspense fallback={null}>
        <EsperandoConfirmacionBanner />
      </Suspense>
    </>
  );

  // T3.8: mismo patrón — sin fallback visible, la campanita solo aparece
  // una vez que se sabe que hay algo para notificar.
  const notificationsSlot = (
    <Suspense fallback={null}>
      <NotificationsBell />
    </Suspense>
  );

  return (
    <html
      lang="es"
      className={`${nunitoSans.variable} ${neutralSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sand text-ink">
        <SiteHeader
          accountSlot={accountSlot}
          accountSlotMobile={accountSlotMobile}
          bannerSlot={bannerSlot}
          notificationsSlot={notificationsSlot}
        />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
