import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilityCalendar } from "./availability-calendar";

const { crearReservaAction, marcarContactadoAction, refresh } = vi.hoisted(() => ({
  crearReservaAction: vi.fn(async () => ({})),
  marcarContactadoAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/reservas", () => ({ crearReservaAction, marcarContactadoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// Fecha "hoy" congelada — hace que las dos consultas de días sean
// predecibles (agosto 2026 tiene 31 días, septiembre 30 — usar el 31
// como fecha inequívoca, solo aparece en el primer mes renderizado).
const HOY = new Date(2026, 7, 15); // 15 de agosto de 2026

function mesContainer(nombreMes: string): HTMLElement {
  return screen.getByText(nombreMes).closest("div") as HTMLElement;
}

function diaBoton(nombreMes: string, dia: number): HTMLElement {
  return within(mesContainer(nombreMes)).getByRole("button", { name: String(dia) });
}

const propsBase = {
  alojamientoId: "a-1",
  alojamientoNombre: "Depto Test",
  ocupado: [],
  misReservasAqui: [],
  tieneReservaPendiente: false,
  precioNoche: 1000,
  estaLogueado: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  // setSystemTime por sí solo (sin useFakeTimers) congela Date sin tocar
  // setTimeout/setInterval — evita que findBy/waitFor de Testing Library
  // (que usan timers reales) se cuelguen esperando un timer falso.
  vi.setSystemTime(HOY);
  crearReservaAction.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AvailabilityCalendar — selección de fechas", () => {
  it("renderiza el mes actual y el siguiente", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
  });

  it("hoy y los días pasados están deshabilitados (al menos 1 día de anticipación)", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    expect(diaBoton("Agosto 2026", 15)).toBeDisabled(); // hoy
    expect(diaBoton("Agosto 2026", 10)).toBeDisabled(); // pasado
    expect(diaBoton("Agosto 2026", 16)).toBeEnabled(); // mañana, primer día seleccionable
  });

  it("clickear un día futuro lo marca como check-in", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    expect(diaBoton("Agosto 2026", 20)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Elegí la fecha de check-out")).toBeInTheDocument();
  });

  it("clickear un segundo día posterior completa el rango y calcula noches/precio", () => {
    render(<AvailabilityCalendar {...propsBase} precioNoche={1000} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    // 3 noches x 1000 = 3000 — \s en la regex matchea tanto un
    // espacio normal como el NBSP que Intl.NumberFormat mete junto al "$".
    expect(screen.getByText(/3 noches · \$\s*3\.000/)).toBeInTheDocument();
  });

  it("clickear un día anterior al check-in reinicia la selección desde ahí", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(diaBoton("Agosto 2026", 25));
    fireEvent.click(diaBoton("Agosto 2026", 20)); // anterior al 25
    expect(diaBoton("Agosto 2026", 20)).toHaveAttribute("aria-pressed", "true");
    expect(diaBoton("Agosto 2026", 25)).toHaveAttribute("aria-pressed", "false");
  });

  it("un día ocupado está deshabilitado", () => {
    render(<AvailabilityCalendar {...propsBase} ocupado={[{ inicio: "2026-08-20", fin: "2026-08-22" }]} />);
    expect(diaBoton("Agosto 2026", 21)).toBeDisabled();
  });

  it("seleccionar un rango que atraviesa una fecha ocupada reinicia la selección", () => {
    render(<AvailabilityCalendar {...propsBase} ocupado={[{ inicio: "2026-08-20", fin: "2026-08-20" }]} />);
    fireEvent.click(diaBoton("Agosto 2026", 18));
    fireEvent.click(diaBoton("Agosto 2026", 25)); // el 20 (ocupado) queda en el medio

    // No se completó el rango — el 25 pasa a ser el nuevo check-in.
    expect(diaBoton("Agosto 2026", 25)).toHaveAttribute("aria-pressed", "true");
    expect(diaBoton("Agosto 2026", 18)).toHaveAttribute("aria-pressed", "false");
  });

  it("elegir el mismo día como check-out no hace nada (día siguiente clickeado reinicia)", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 20)); // mismo día
    // day <= start -> reinicia como nuevo start, sigue pidiendo checkout
    expect(screen.getByText("Elegí la fecha de check-out")).toBeInTheDocument();
  });
});

describe("AvailabilityCalendar — mis reservas propias", () => {
  it("pinta mi reserva confirmada con el título correcto", () => {
    render(
      <AvailabilityCalendar
        {...propsBase}
        misReservasAqui={[{ fechaInicio: "2026-08-20", fechaFin: "2026-08-22", estado: "confirmada" }]}
      />,
    );
    expect(diaBoton("Agosto 2026", 21)).toHaveAttribute("title", "Tu reserva (confirmada)");
    expect(screen.getByText("Tu reserva confirmada")).toBeInTheDocument();
  });

  it("pinta mi reserva pendiente con el título correcto", () => {
    render(
      <AvailabilityCalendar
        {...propsBase}
        misReservasAqui={[{ fechaInicio: "2026-08-20", fechaFin: "2026-08-22", estado: "pendiente" }]}
      />,
    );
    expect(diaBoton("Agosto 2026", 21)).toHaveAttribute("title", "Tu reserva (pendiente)");
  });
});

describe("AvailabilityCalendar — estados especiales", () => {
  it("con tieneReservaPendiente, el calendario queda bloqueado y muestra el aviso", () => {
    render(<AvailabilityCalendar {...propsBase} tieneReservaPendiente />);
    expect(diaBoton("Agosto 2026", 20)).toBeDisabled();
    expect(screen.getByText(/tenés una reserva pendiente de confirmar/i)).toBeInTheDocument();
  });

  it("con esAdmin, el calendario queda bloqueado y muestra la aclaración de admin", () => {
    render(<AvailabilityCalendar {...propsBase} esAdmin />);
    expect(diaBoton("Agosto 2026", 20)).toBeDisabled();
    expect(screen.getByText(/estás viendo esto como administrador/i)).toBeInTheDocument();
  });

  it("sin sesión, muestra un link para iniciar sesión en vez del botón Reservar", () => {
    render(<AvailabilityCalendar {...propsBase} estaLogueado={false} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    expect(screen.getByRole("link", { name: /iniciá sesión para reservar/i })).toHaveAttribute("href", "/ingresar");
    expect(screen.queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument();
  });

  it("el botón Reservar está deshabilitado hasta completar el rango", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    expect(screen.getByRole("button", { name: "Reservar" })).toBeDisabled();
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    expect(screen.getByRole("button", { name: "Reservar" })).toBeEnabled();
  });
});

describe("AvailabilityCalendar — navegación de meses", () => {
  it("el botón de mes anterior está deshabilitado en el offset inicial", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
  });

  it("avanzar un mes muestra septiembre/octubre", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
    expect(screen.getByText("Octubre 2026")).toBeInTheDocument();
  });

  it("avanzar y volver deja el botón de mes anterior deshabilitado de nuevo", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
  });
});

describe("AvailabilityCalendar — flujo de reserva completo", () => {
  it("abre el modal con el rango elegido y el precio total", async () => {
    render(<AvailabilityCalendar {...propsBase} precioNoche={500} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 24));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));

    expect(screen.getByText("Confirmá tu reserva")).toBeInTheDocument();
    expect(screen.getByText(/2026-08-20 → 2026-08-24/)).toBeInTheDocument();
  });

  it("precarga los datos de contacto si se pasan", async () => {
    render(
      <AvailabilityCalendar
        {...propsBase}
        contactoPrefill={{ nombre: "Ana", apellido: "Test", email: "ana@example.com", telefono: "1122334455" }}
      />,
    );
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("al confirmar, muestra la vista de éxito con las opciones de contacto", async () => {
    crearReservaAction.mockResolvedValue({
      success: true,
      reservaId: "r-1",
      expiraEn: new Date(HOY.getTime() + 5 * 60 * 1000).toISOString(),
    });
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...propsBase} />);

    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Test");
    await user.type(screen.getByLabelText("DNI"), "12345678");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Teléfono"), "1122334455");
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(await screen.findByText("¡Reserva recibida!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mail" })).toBeInTheDocument();
  });

  it("muestra el error del backend si la reserva falla", async () => {
    crearReservaAction.mockResolvedValue({ error: "esas fechas ya no están disponibles" });
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...propsBase} />);

    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Test");
    await user.type(screen.getByLabelText("DNI"), "12345678");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Teléfono"), "1122334455");
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("esas fechas ya no están disponibles");
  });

  it("tocar WhatsApp en la vista de éxito marca la reserva como contactada", async () => {
    crearReservaAction.mockResolvedValue({ success: true, reservaId: "r-1" });
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...propsBase} />);

    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Test");
    await user.type(screen.getByLabelText("DNI"), "12345678");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Teléfono"), "1122334455");
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    await screen.findByText("¡Reserva recibida!");
    fireEvent.click(screen.getByRole("link", { name: "WhatsApp" }));

    await waitFor(() => expect(marcarContactadoAction).toHaveBeenCalledWith("r-1"));
  });

  it("cerrar el modal cancela sin llamar a crearReservaAction", () => {
    render(<AvailabilityCalendar {...propsBase} />);
    fireEvent.click(diaBoton("Agosto 2026", 20));
    fireEvent.click(diaBoton("Agosto 2026", 23));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Confirmá tu reserva")).not.toBeInTheDocument();
    expect(crearReservaAction).not.toHaveBeenCalled();
  });
});
