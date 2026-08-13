import Link from "next/link";
import { getCurrentYear } from "@/lib/current-year";
import { CONTACTO_EMAIL } from "@/lib/contacto";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Servicios",
    links: [
      { label: "Alojamiento", href: "/alojamiento" },
      { label: "Experiencias", href: "/experiencias" },
      { label: "Servicio Turístico", href: "/servicio-turistico" },
      { label: "Traslados", href: "/traslados" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Ingresar", href: "/ingresar" },
      { label: "Crear cuenta", href: "/registrarse" },
    ],
  },
];

export async function SiteFooter() {
  const year = await getCurrentYear();

  return (
    <footer id="contacto" className="bg-sand-dim">
      <div className="mx-auto max-w-(--container-max) px-6 py-16 md:px-10 md:py-20">
        <p className="font-display text-center text-2xl">Turismo Marcuzzi</p>

        <div className="horizon-rule my-10" />

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="tracked-caps mb-4 text-xs font-semibold text-ink-soft">
                {col.title}
              </p>
              <ul className="space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-tide">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 sm:col-span-2">
            <p className="tracked-caps mb-4 text-xs font-semibold text-ink-soft">
              Contacto
            </p>
            {/* CONTACTO_EMAIL viene de lib/contacto.ts (T3.5) — mismo
                placeholder hasta tener el dato real del cliente, ahora en
                un solo lugar en vez de hardcodeado acá aparte. */}
            <ul className="space-y-2 text-sm text-ink-soft">
              <li>Puerto Madryn, Chubut, Argentina</li>
              <li>{CONTACTO_EMAIL}</li>
              <li className="font-mono text-xs tracking-wide text-ink-soft/70">
                42°46′S 65°02′O
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-14 text-center text-xs text-ink-soft">
          © {year} Turismo Marcuzzi. Puerto Madryn, Argentina.
        </p>
      </div>
    </footer>
  );
}
