"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import type { RangoOcupado, ReservaEstado } from "@turismo-marcuzzi/shared-types";
import { crearReservaAction, marcarContactadoAction } from "@/app/actions/reservas";
import { authInputClass, authLabelClass } from "@/components/auth/auth-shell";
import { Countdown } from "@/components/countdown";
import { Modal } from "@/components/modal";
import { formatARS } from "@/lib/currency";
import { CONTACTO_TELEFONO_LEGIBLE, mailtoUrl, telUrl, whatsappUrl } from "@/lib/contacto";

interface MiReservaAqui {
  fechaInicio: string;
  fechaFin: string;
  estado: ReservaEstado;
}

interface ContactoPrefill {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
}

interface AvailabilityCalendarProps {
  alojamientoId: string;
  alojamientoNombre: string;
  ocupado: RangoOcupado[];
  /** Mis propias reservas de ESTE alojamiento (cualquier estado no
   * cancelado) — para pintarlas distinto del resto de lo ocupado (T3.5). */
  misReservasAqui: MiReservaAqui[];
  /** true si tengo una reserva `pendiente` (sin confirmar) para ESTE
   * alojamiento (T3.7) — mientras tanto el calendario queda bloqueado:
   * solo se puede volver a elegir fechas (p. ej. para extender la
   * estadía) una vez que esa reserva se confirme. */
  tieneReservaPendiente: boolean;
  precioNoche: number;
  /** Spec §4.5: solo usuarios registrados pueden reservar (alojamiento no
   * tiene la restricción de FR-11 — cualquier cuenta alcanza). Sin
   * sesión, el calendario sigue siendo navegable pero el botón se
   * reemplaza por un link a /ingresar. */
  estaLogueado: boolean;
  contactoPrefill?: ContactoPrefill;
  /** Pedido del cliente, 2026-08-13: una cuenta administradora navega el
   * sitio para verificar cambios aplicados desde el panel, pero no debe
   * poder interactuar como si fuera un huésped — el calendario queda de
   * solo lectura (mismo look, sin selección posible) y el botón de
   * reservar se reemplaza por una aclaración. El backend rechaza el POST
   * igual (defensa en profundidad, ver reservas.go), esto es solo UX. */
  esAdmin?: boolean;
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Expande cada rango (inclusive) a un set de fechas ISO — más simple de
 * consultar celda por celda que recalcular solapamiento cada vez. */
function expandRangos(rangos: { inicio: string; fin: string }[]): Set<string> {
  const set = new Set<string>();
  for (const rango of rangos) {
    let cursor = new Date(`${rango.inicio}T00:00:00`);
    const fin = new Date(`${rango.fin}T00:00:00`);
    while (cursor <= fin) {
      set.add(toISO(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  return set;
}

function rangeCrossesOccupied(start: Date, end: Date, occupied: Set<string>): boolean {
  let cursor = addDays(start, 1);
  while (cursor < end) {
    if (occupied.has(toISO(cursor))) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}

/**
 * Calendario de disponibilidad (T2.5) + reserva real con formulario de
 * contacto en un modal (T3.1/T3.2/T3.5/T3.6/T3.7, spec §4.2). Bloquea
 * fechas ocupadas (propias o ajenas, cualquier reserva activa — TR-005),
 * fechas pasadas y hoy mismo (al menos un día de anticipación). Mis
 * propias fechas se pintan distinto: ámbar pendiente, verde confirmada.
 * Con una reserva pendiente propia en este alojamiento, el calendario
 * entero queda bloqueado hasta que se confirme (T3.7) — evita abrir una
 * segunda reserva paralela sobre el mismo lugar mientras la primera
 * todavía se está coordinando.
 */
export function AvailabilityCalendar({
  alojamientoId,
  alojamientoNombre,
  ocupado,
  misReservasAqui,
  tieneReservaPendiente,
  precioNoche,
  estaLogueado,
  contactoPrefill,
  esAdmin = false,
}: AvailabilityCalendarProps) {
  const router = useRouter();
  const occupied = useMemo(() => expandRangos(ocupado), [ocupado]);
  const minePending = useMemo(
    () =>
      expandRangos(
        misReservasAqui
          .filter((r) => r.estado === "pendiente")
          .map((r) => ({ inicio: r.fechaInicio, fin: r.fechaFin })),
      ),
    [misReservasAqui],
  );
  const mineConfirmed = useMemo(
    () =>
      expandRangos(
        misReservasAqui
          .filter((r) => r.estado === "confirmada")
          .map((r) => ({ inicio: r.fechaInicio, fin: r.fechaFin })),
      ),
    [misReservasAqui],
  );
  const today = useMemo(() => startOfDay(new Date()), []);
  // Al menos un día de anticipación: hoy mismo ya no se puede seleccionar.
  const minSeleccionable = useMemo(() => addDays(today, 1), [today]);

  const [monthOffset, setMonthOffset] = useState(0);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [contactoHecho, setContactoHecho] = useState(false);
  const [state, formAction, isPending] = useActionState(crearReservaAction, {});

  function handleClick(day: Date) {
    if (esAdmin || tieneReservaPendiente) return;
    if (day < minSeleccionable || occupied.has(toISO(day))) return;

    if (!start || (start && end)) {
      setStart(day);
      setEnd(null);
      return;
    }
    if (day <= start || rangeCrossesOccupied(start, day, occupied)) {
      setStart(day);
      setEnd(null);
      return;
    }
    setEnd(day);
  }

  async function handleContacto() {
    if (contactoHecho || !state.reservaId) return;
    setContactoHecho(true);
    await marcarContactadoAction(state.reservaId);
    router.refresh();
  }

  function cerrarModal() {
    setModalAbierto(false);
    if (state.success) {
      // Reserva ya creada: al cerrar, refrescá para que el calendario
      // (misReservasAqui/tieneReservaPendiente) refleje el bloqueo nuevo
      // sin esperar a una navegación aparte.
      router.refresh();
    }
  }

  const noches = start && end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) : 0;

  function renderMonth(offset: number) {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero

    const cells: (Date | null)[] = [
      ...Array<null>(leadingBlanks).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];

    return (
      <div key={offset}>
        <p className="tracked-caps mb-3 text-center text-xs font-semibold text-ink-soft">
          {MESES[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {DIAS.map((d) => (
            <span key={d} className="py-1 font-semibold text-ink-soft">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const iso = toISO(day);
            const isMineConfirmed = mineConfirmed.has(iso);
            const isMinePending = !isMineConfirmed && minePending.has(iso);
            // No disponible de verdad (pasado u ocupado) vs. "no podés
            // tocar el calendario ahora mismo porque tenés una reserva
            // pendiente acá" son dos cosas distintas — la primera sí se
            // tacha (es info real: ese día no está libre), la segunda NO
            // (pedido del cliente, 2026-08-13: no quiere el calendario
            // entero tachado solo porque está bloqueado por su propia
            // reserva pendiente; alcanza con que no se pueda interactuar).
            const noDisponible = day < minSeleccionable || occupied.has(iso);
            const isDisabled = esAdmin || tieneReservaPendiente || noDisponible;
            const isStart = start ? toISO(start) === iso : false;
            const isEnd = end ? toISO(end) === iso : false;
            const isInRange = Boolean(start && end && day > start && day < end);

            let cls = "text-ink hover:bg-sand-dim";
            if (isMineConfirmed) cls = "bg-steppe text-sand";
            else if (isMinePending) cls = "bg-dune text-sand";
            else if (noDisponible) cls = "cursor-not-allowed text-ink-soft/30 line-through";
            else if (tieneReservaPendiente) cls = "cursor-not-allowed text-ink-soft";
            else if (isStart || isEnd) cls = "bg-coral text-sand";
            else if (isInRange) cls = "bg-coral/15 text-ink";

            return (
              <button
                key={iso}
                type="button"
                disabled={isDisabled}
                onClick={() => handleClick(day)}
                aria-pressed={isStart || isEnd}
                title={
                  isMineConfirmed
                    ? "Tu reserva (confirmada)"
                    : isMinePending
                      ? "Tu reserva (pendiente)"
                      : undefined
                }
                className={`aspect-square rounded-full text-sm transition-colors ${cls}`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const mensajeContacto = start && end
    ? `Hola! Quiero coordinar el pago de mi reserva de ${alojamientoNombre}, del ${toISO(start)} al ${toISO(end)}.`
    : `Hola! Quiero coordinar el pago de mi reserva de ${alojamientoNombre}.`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="tracked-caps text-xs font-semibold text-ink-soft">Disponibilidad</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => Math.max(m - 1, 0))}
            disabled={monthOffset === 0}
            aria-label="Mes anterior"
            className="rounded-full border border-ink/15 px-3 py-1 text-sm disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label="Mes siguiente"
            className="rounded-full border border-ink/15 px-3 py-1 text-sm"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {renderMonth(monthOffset)}
        {renderMonth(monthOffset + 1)}
      </div>

      {(minePending.size > 0 || mineConfirmed.size > 0) && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-soft">
          {minePending.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-dune" /> Tu reserva pendiente
            </span>
          )}
          {mineConfirmed.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-steppe" /> Tu reserva confirmada
            </span>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-ink/10 pt-6">
        {esAdmin ? (
          <p className="text-sm text-ink-soft">
            Estás viendo esto como administrador — no podés reservar desde esta cuenta. Para
            probar el flujo de reserva, hacelo con una cuenta de cliente.
          </p>
        ) : tieneReservaPendiente ? (
          <p className="text-sm text-ink-soft">
            Tenés una reserva pendiente de confirmar para este alojamiento — vas a poder elegir
            más fechas (por ejemplo, para extender la estadía) una vez que se confirme. Mirá el
            estado en{" "}
            <Link href="/perfil" className="font-medium text-tide hover:underline">
              tu perfil
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {start && end
                ? `${noches} ${noches === 1 ? "noche" : "noches"} · ${formatARS(noches * precioNoche)}`
                : start
                  ? "Elegí la fecha de check-out"
                  : "Elegí check-in y check-out"}
            </p>

            {estaLogueado ? (
              <button
                type="button"
                disabled={!start || !end}
                onClick={() => setModalAbierto(true)}
                className="rounded-full bg-coral px-6 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reservar
              </button>
            ) : (
              <Link
                href="/ingresar"
                className="rounded-full bg-coral px-6 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark"
              >
                Iniciá sesión para reservar
              </Link>
            )}
          </div>
        )}
      </div>

      {modalAbierto && (
        <Modal onClose={cerrarModal} labelledBy="reserva-modal-titulo">
          {state.success ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 id="reserva-modal-titulo" className="font-display text-2xl">
                  ¡Reserva recibida!
                </h2>
                <button
                  type="button"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                  className="text-2xl leading-none text-ink-soft hover:text-ink"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {contactoHecho ? (
                  <p role="status" className="text-sm text-ink">
                    ¡Gracias! Revisá <strong>notificaciones</strong> (🔔, arriba de la página) para
                    el estado de tu reserva. Si tarda mucho la confirmación, llamanos al{" "}
                    <a href={telUrl()} className="font-medium text-tide hover:underline">
                      {CONTACTO_TELEFONO_LEGIBLE}
                    </a>
                    .
                  </p>
                ) : (
                  <>
                    <p role="status" className="text-sm text-ink">
                      Tu reserva quedó <strong>pendiente</strong>. Contactanos en los próximos{" "}
                      {state.expiraEn ? (
                        <Countdown
                          deadline={state.expiraEn}
                          onExpire={() => router.refresh()}
                          className="font-semibold tabular-nums text-coral-dark"
                        />
                      ) : (
                        "unos minutos"
                      )}{" "}
                      para no perderla — si no llega a confirmarse, se libera sola.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={whatsappUrl(mensajeContacto)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleContacto}
                        className="rounded-full bg-steppe px-5 py-2.5 text-sm font-semibold text-sand transition-colors hover:opacity-90"
                      >
                        WhatsApp
                      </a>
                      <a
                        href={mailtoUrl("Coordinar pago de mi reserva", mensajeContacto)}
                        onClick={handleContacto}
                        className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-sand"
                      >
                        Mail
                      </a>
                    </div>
                  </>
                )}
                <Link href="/perfil" className="inline-block text-sm text-tide hover:underline">
                  Ver en tu perfil →
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 id="reserva-modal-titulo" className="font-display text-2xl">
                  Confirmá tu reserva
                </h2>
                <button
                  type="button"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                  className="text-2xl leading-none text-ink-soft hover:text-ink"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{alojamientoNombre}</p>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {renderMonth(monthOffset)}
                {renderMonth(monthOffset + 1)}
              </div>

              <form action={formAction} className="mt-6 space-y-4 border-t border-ink/10 pt-6">
                <input type="hidden" name="alojamientoId" value={alojamientoId} />
                <input type="hidden" name="fechaInicio" value={start ? toISO(start) : ""} />
                <input type="hidden" name="fechaFin" value={end ? toISO(end) : ""} />

                <p className="text-sm font-medium text-ink">
                  {start && end
                    ? `${toISO(start)} → ${toISO(end)} · ${noches} ${noches === 1 ? "noche" : "noches"} · ${formatARS(noches * precioNoche)}`
                    : "Elegí check-in y check-out arriba"}
                </p>

                {/* grid-cols-1 en mobile (bug real 2026-08-17): el modal
                    (max-w-lg) en un teléfono común deja ~140px por columna
                    con 2 columnas fijas — apretado para un input de texto
                    con su label. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contactoNombre" className={authLabelClass}>
                      Nombre
                    </label>
                    <input
                      id="contactoNombre"
                      name="contactoNombre"
                      required
                      defaultValue={contactoPrefill?.nombre}
                      className={authInputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="contactoApellido" className={authLabelClass}>
                      Apellido
                    </label>
                    <input
                      id="contactoApellido"
                      name="contactoApellido"
                      required
                      defaultValue={contactoPrefill?.apellido}
                      className={authInputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contactoDni" className={authLabelClass}>
                    DNI
                  </label>
                  <input
                    id="contactoDni"
                    name="contactoDni"
                    inputMode="numeric"
                    required
                    pattern="\d{6,9}"
                    title="Entre 6 y 9 dígitos, sin puntos"
                    className={authInputClass}
                  />
                </div>

                <div>
                  <label htmlFor="contactoEmail" className={authLabelClass}>
                    Email
                  </label>
                  <input
                    id="contactoEmail"
                    name="contactoEmail"
                    type="email"
                    required
                    defaultValue={contactoPrefill?.email}
                    className={authInputClass}
                  />
                </div>

                <div>
                  <label htmlFor="contactoTelefono" className={authLabelClass}>
                    Teléfono
                  </label>
                  <input
                    id="contactoTelefono"
                    name="contactoTelefono"
                    type="tel"
                    required
                    defaultValue={contactoPrefill?.telefono}
                    className={authInputClass}
                  />
                </div>

                {state.error && (
                  <p role="alert" className="text-sm text-coral-dark">
                    {state.error}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!start || !end || isPending}
                    className="rounded-full bg-coral px-6 py-3 text-sm font-semibold text-sand transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPending ? "Confirmando…" : "Confirmar reserva"}
                  </button>
                  <button type="button" onClick={cerrarModal} className="text-sm text-ink-soft hover:text-ink">
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
