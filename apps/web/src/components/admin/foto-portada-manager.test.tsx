import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { FotoPortadaManager } from "./foto-portada-manager";

const { subirFotoPortadaAction } = vi.hoisted(() => ({ subirFotoPortadaAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/admin", () => ({ subirFotoPortadaAction }));

function foto(overrides: Partial<Foto> = {}): Foto {
  return { id: "f-1", url: "http://x/portada.jpg", orden: 0, tipo: "foto", esPortada: true, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  subirFotoPortadaAction.mockResolvedValue({});
});

describe("FotoPortadaManager", () => {
  it("sin portada, no muestra la preview y el botón dice 'Subir'", () => {
    render(<FotoPortadaManager alojamientoId="a-1" />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir" })).toBeInTheDocument();
  });

  it("con portada, muestra la preview y el botón dice 'Reemplazar'", () => {
    render(<FotoPortadaManager alojamientoId="a-1" portada={foto()} />);
    expect(screen.getByRole("button", { name: "Reemplazar" })).toBeInTheDocument();
  });

  it("muestra el error del backend", async () => {
    subirFotoPortadaAction.mockResolvedValue({ error: "Formato de imagen no soportado." });
    const user = userEvent.setup();
    const { container } = render(<FotoPortadaManager alojamientoId="a-1" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["x"], "foto.jpg", { type: "image/jpeg" }));
    // fireEvent.submit en vez de clickear el botón: React 19 no llega a
    // interceptar un click sintético de jsdom sobre <button type="submit">
    // dentro de un <form ref={...} action={formAction}> (cae al fallback
    // nativo, "A React form was unexpectedly submitted") — disparar el
    // evento submit directo sí lo intercepta.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent("Formato de imagen no soportado.");
  });
});
