import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagenSitioSlot } from "./imagen-sitio-slot";

const { subirImagenSitioAction, borrarImagenSitioAction, refresh } = vi.hoisted(() => ({
  subirImagenSitioAction: vi.fn(async () => ({})),
  borrarImagenSitioAction: vi.fn(async () => {}),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ subirImagenSitioAction, borrarImagenSitioAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
  subirImagenSitioAction.mockResolvedValue({});
});

describe("ImagenSitioSlot", () => {
  it("sin url, cae al placeholder de gradiente y no muestra 'Quitar'", () => {
    render(<ImagenSitioSlot clave="home_hero_golfo_nuevo" label="Hero — Golfo Nuevo" gradient="g1" />);
    expect(screen.getByText("Hero — Golfo Nuevo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("con url, muestra la imagen y el botón 'Quitar'", () => {
    render(<ImagenSitioSlot clave="home_hero_golfo_nuevo" label="Hero" gradient="g1" url="/foto.jpg" />);
    expect(screen.getByRole("img", { name: "Hero" })).toHaveAttribute("src", expect.stringContaining("foto.jpg"));
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });

  it("clickear Quitar elimina el override y refresca", async () => {
    render(<ImagenSitioSlot clave="home_hero_golfo_nuevo" label="Hero" gradient="g1" url="/foto.jpg" />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(borrarImagenSitioAction).toHaveBeenCalledWith("home_hero_golfo_nuevo"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("muestra el error del backend al subir", async () => {
    subirImagenSitioAction.mockResolvedValue({ error: "La imagen no puede superar los 15MB." });
    const user = userEvent.setup();
    const { container } = render(<ImagenSitioSlot clave="home_hero_golfo_nuevo" label="Hero" gradient="g1" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["x"], "foto.jpg", { type: "image/jpeg" }));
    // Ver comentario equivalente en foto-portada-manager.test.tsx: un click
    // sintético sobre el submit de un <form ref={...}> no llega a
    // interceptarse acá, se dispara el submit directo.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent("no puede superar los 15MB");
  });
});
