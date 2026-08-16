import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResenaForm } from "./resena-form";

const { crearResenaAction } = vi.hoisted(() => ({ crearResenaAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/resenas", () => ({ crearResenaAction }));

beforeEach(() => {
  vi.clearAllMocks();
  crearResenaAction.mockResolvedValue({});
});

describe("ResenaForm", () => {
  it("arranca con 5 estrellas seleccionadas", () => {
    render(<ResenaForm alojamientoId="a-1" />);
    expect(screen.getByRole("radio", { name: "5 estrellas" })).toHaveAttribute("aria-checked", "true");
  });

  it("clickear una estrella cambia la calificación", () => {
    render(<ResenaForm alojamientoId="a-1" />);
    fireEvent.click(screen.getByRole("radio", { name: "1 estrella" }));
    expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "5 estrellas" })).toHaveAttribute("aria-checked", "false");
  });

  it("muestra el error del backend", async () => {
    crearResenaAction.mockResolvedValue({ error: "Ya dejaste una reseña para este alojamiento." });
    const user = userEvent.setup();
    render(<ResenaForm alojamientoId="a-1" />);
    await user.type(screen.getByLabelText("Tu reseña"), "Excelente lugar");
    await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya dejaste una reseña");
  });

  it("al confirmarse, reemplaza el formulario por el mensaje de agradecimiento", async () => {
    crearResenaAction.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ResenaForm alojamientoId="a-1" />);
    await user.type(screen.getByLabelText("Tu reseña"), "Excelente lugar");
    await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(await screen.findByText("¡Gracias por tu reseña!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar reseña" })).not.toBeInTheDocument();
  });

  it("envía el alojamientoId y el rating como campos ocultos", async () => {
    const { container } = render(<ResenaForm alojamientoId="a-42" />);
    fireEvent.click(screen.getByRole("radio", { name: "3 estrellas" }));
    const alojamientoInput = container.querySelector('input[name="alojamientoId"]') as HTMLInputElement;
    const ratingInput = container.querySelector('input[name="rating"]') as HTMLInputElement;
    expect(alojamientoInput.value).toBe("a-42");
    await waitFor(() => expect(ratingInput.value).toBe("3"));
  });
});
