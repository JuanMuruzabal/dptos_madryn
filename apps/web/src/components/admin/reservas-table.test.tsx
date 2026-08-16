import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { ReservasTable } from "./reservas-table";

const { actualizarEstadoReservaAction, actualizarDatosReservaAction, refresh } = vi.hoisted(() => ({
  actualizarEstadoReservaAction: vi.fn(),
  actualizarDatosReservaAction: vi.fn(async () => ({})),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ actualizarEstadoReservaAction, actualizarDatosReservaAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function reserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r-1",
    tipo: "alojamiento",
    estado: "pendiente",
    fechaInicio: "2026-09-01",
    fechaFin: "2026-09-05",
    total: 40000,
    contactoNombre: "Ana",
    contactoApellido: "Gómez",
    contactoDni: "12345678",
    contactoEmail: "ana@example.com",
    contactoTelefono: "1122334455",
    contactadoEn: undefined,
    alojamiento: { id: "a-1", nombre: "Depto Península" },
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReservasTable — filtros y búsqueda", () => {
  it("sin reservas, muestra el mensaje de vacío general", () => {
    render(<ReservasTable reservas={[]} />);
    expect(screen.getByText("Todavía no hay ninguna reserva.")).toBeInTheDocument();
  });

  it("por defecto solo muestra las pendientes", () => {
    render(
      <ReservasTable
        reservas={[reserva({ id: "p1", estado: "pendiente" }), reserva({ id: "c1", estado: "confirmada" })]}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1 fila
  });

  it("cambiar a la pestaña Confirmadas filtra por ese estado", () => {
    render(
      <ReservasTable
        reservas={[reserva({ id: "p1", estado: "pendiente" }), reserva({ id: "c1", estado: "confirmada" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmadas" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
  });

  it("con un filtro sin resultados, el mensaje menciona el estado", () => {
    render(<ReservasTable reservas={[reserva({ estado: "pendiente" })]} filtroInicial="cancelada" />);
    expect(screen.getByText("No hay reservas canceladas en este momento.")).toBeInTheDocument();
  });

  it("busca por DNI ignorando mayúsculas y con match parcial", () => {
    render(<ReservasTable reservas={[reserva({ contactoDni: "30111222" })]} />);
    fireEvent.change(screen.getByLabelText("Buscar reservas"), { target: { value: "30111" } });
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
  });

  it("busca sin tener en cuenta tildes (Península encontrado con 'peninsula')", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    fireEvent.change(screen.getByLabelText("Buscar reservas"), { target: { value: "peninsula" } });
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
  });

  it("una búsqueda sin coincidencias muestra el mensaje de 'ninguna coincide'", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    fireEvent.change(screen.getByLabelText("Buscar reservas"), { target: { value: "zzzzz" } });
    expect(screen.getByText("Ninguna reserva coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("busca también por nombre y email de la cuenta asociada", () => {
    render(
      <ReservasTable
        reservas={[reserva({ usuario: { id: "u-1", nombre: "Carlos Ruiz", email: "carlos@example.com" } })]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Buscar reservas"), { target: { value: "carlos@example.com" } });
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
  });
});

describe("ReservasTable — fila expandible", () => {
  it("clickear una fila la expande y muestra el detalle de contacto", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("1122334455")).toBeInTheDocument();
  });

  it("clickear de nuevo la colapsa", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    const fila = screen.getByText("Depto Península").closest("tr") as HTMLElement;
    fireEvent.click(fila);
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    fireEvent.click(fila);
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
  });

  it("muestra el bloque 'Cuenta' solo si la reserva tiene un usuario asociado", () => {
    render(<ReservasTable reservas={[reserva({ usuario: { id: "u-1", nombre: "Carlos Ruiz", email: "carlos@example.com" } })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByText("Carlos Ruiz (carlos@example.com)")).toBeInTheDocument();
  });

  it("una reserva pendiente muestra el botón Editar", () => {
    render(<ReservasTable reservas={[reserva({ estado: "pendiente" })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("una reserva cancelada no muestra el botón Editar", () => {
    render(<ReservasTable reservas={[reserva({ estado: "cancelada" })]} filtroInicial="cancelada" />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("clickear Editar abre el formulario de edición sin cerrar la fila", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("cancelar la edición vuelve al detalle de solo lectura", () => {
    render(<ReservasTable reservas={[reserva()]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });

  it("un DNI vacío se muestra como guion", () => {
    render(<ReservasTable reservas={[reserva({ contactoDni: "" })]} />);
    const fila = screen.getByText("Depto Península").closest("tr") as HTMLElement;
    expect(within(fila).getByText("—")).toBeInTheDocument();
  });

  it("sin alojamiento asociado, muestra el nombre genérico 'Alojamiento'", () => {
    render(<ReservasTable reservas={[reserva({ alojamiento: undefined })]} />);
    expect(screen.getByRole("cell", { name: "Alojamiento" })).toBeInTheDocument();
  });
});
