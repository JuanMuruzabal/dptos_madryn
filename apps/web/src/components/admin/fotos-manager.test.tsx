import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { FotosManager } from "./fotos-manager";

const { borrarFotoAction, reordenarFotosAction, subirFotoAction, refresh } = vi.hoisted(() => ({
  borrarFotoAction: vi.fn(),
  reordenarFotosAction: vi.fn(),
  subirFotoAction: vi.fn(async () => ({})),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/admin", () => ({ borrarFotoAction, reordenarFotosAction, subirFotoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function foto(overrides: Partial<Foto> = {}): Foto {
  return { id: "f-1", url: "http://x/f.jpg", orden: 0, tipo: "foto", esPortada: false, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  subirFotoAction.mockResolvedValue({});
});

describe("FotosManager", () => {
  it("sin fotos, muestra 10 casilleros vacíos y ninguna preview grande", () => {
    render(<FotosManager alojamientoId="a-1" fotos={[]} />);
    expect(screen.getAllByRole("button", { name: "Agregar foto o video" })).toHaveLength(10);
  });

  it("con fotos, la primera se ve en la preview grande", () => {
    const fotos = [foto({ id: "f-1", url: "http://x/1.jpg" })];
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);
    const preview = document.querySelector('img[alt=""]');
    expect(preview).toHaveAttribute("src", expect.stringContaining("1.jpg"));
  });

  it("un video en la preview usa <video>, no <img>", () => {
    const fotos = [foto({ id: "f-1", tipo: "video", url: "http://x/v.mp4" })];
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);
    expect(document.querySelector("video")).toHaveAttribute("src", "http://x/v.mp4");
  });

  it("clickear una miniatura la muestra en la preview grande", () => {
    const fotos = [
      foto({ id: "f-1", url: "http://x/1.jpg" }),
      foto({ id: "f-2", url: "http://x/2.jpg", orden: 1 }),
    ];
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver foto 2" }));

    const preview = document.querySelector('img[alt=""]');
    expect(preview).toHaveAttribute("src", expect.stringContaining("2.jpg"));
  });

  it("con 10 fotos, no queda ningún casillero vacío y el input queda deshabilitado", () => {
    const fotos = Array.from({ length: 10 }, (_, i) => foto({ id: `f-${i}`, orden: i }));
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);

    expect(screen.queryByRole("button", { name: "Agregar foto o video" })).not.toBeInTheDocument();
    expect(screen.getByText(/llegaste al máximo de 10/i)).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it("con menos de 10, el mensaje invita a tocar un espacio vacío", () => {
    render(<FotosManager alojamientoId="a-1" fotos={[foto()]} />);
    expect(screen.getByText(/tocá un espacio vacío/i)).toBeInTheDocument();
  });

  it("clickear un espacio vacío abre el selector de archivo", async () => {
    render(<FotosManager alojamientoId="a-1" fotos={[]} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(screen.getAllByRole("button", { name: "Agregar foto o video" })[0]);

    expect(clickSpy).toHaveBeenCalled();
  });

  it("elegir un archivo auto-envía el form y sube la foto", async () => {
    const user = userEvent.setup();
    render(<FotosManager alojamientoId="a-1" fotos={[]} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const archivo = new File(["contenido"], "foto.jpg", { type: "image/jpeg" });

    await user.upload(input, archivo);

    await waitFor(() => expect(subirFotoAction).toHaveBeenCalled());
  });

  it("muestra el error de la acción de subida si falla", async () => {
    subirFotoAction.mockResolvedValue({ error: "las imágenes no pueden superar los 15MB" });
    const user = userEvent.setup();
    render(<FotosManager alojamientoId="a-1" fotos={[]} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["x"], "grande.jpg", { type: "image/jpeg" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("las imágenes no pueden superar los 15MB");
  });

  it("borrar una foto llama a borrarFotoAction y refresca", async () => {
    render(<FotosManager alojamientoId="a-1" fotos={[foto({ id: "f-1" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));

    await waitFor(() => expect(borrarFotoAction).toHaveBeenCalledWith("a-1", "f-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("el botón de borrar arranca visible (touch) y solo se oculta con mouse (pointer-fine)", () => {
    render(<FotosManager alojamientoId="a-1" fotos={[foto({ id: "f-1" })]} />);
    const borrar = screen.getByRole("button", { name: "Borrar foto" });
    expect(borrar.className).toContain("opacity-100");
    expect(borrar.className).toContain("pointer-fine:opacity-0");
  });

  it("la agarradera de arrastre existe, con touch-none para no pelear con el scroll nativo", () => {
    render(<FotosManager alojamientoId="a-1" fotos={[foto({ id: "f-1" })]} />);
    const agarradera = screen.getByRole("button", { name: "Mantené presionado y arrastrá para reordenar" });
    expect(agarradera.className).toContain("touch-none");
  });

  it("arrastrar una foto sobre otra (Pointer Events, agarradera) reordena y persiste el nuevo orden", async () => {
    const fotos = [
      foto({ id: "f-1", orden: 0 }),
      foto({ id: "f-2", orden: 1 }),
      foto({ id: "f-3", orden: 2 }),
    ];
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);

    const items = screen
      .getAllByRole("button", { name: /^Ver foto/ })
      .map((btn) => btn.closest("li") as HTMLElement);
    const agarraderas = screen.getAllByRole("button", {
      name: "Mantené presionado y arrastrá para reordenar",
    });

    // jsdom no hace layout real: document.elementFromPoint siempre da
    // null. Se mockea para simular que el dedo/cursor está sobre el
    // tercer casillero (f-3) en el momento del pointermove.
    vi.spyOn(document, "elementFromPoint").mockReturnValue(items[2]);

    fireEvent.pointerDown(agarraderas[0], { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(agarraderas[0], { pointerId: 1, clientX: 200, clientY: 0 });
    fireEvent.pointerUp(agarraderas[0], { pointerId: 1 });

    await waitFor(() =>
      expect(reordenarFotosAction).toHaveBeenCalledWith("a-1", ["f-2", "f-3", "f-1"]),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("soltar sobre el mismo espacio de origen no reordena nada", () => {
    const fotos = [foto({ id: "f-1", orden: 0 }), foto({ id: "f-2", orden: 1 })];
    render(<FotosManager alojamientoId="a-1" fotos={fotos} />);

    const items = screen
      .getAllByRole("button", { name: /^Ver foto/ })
      .map((btn) => btn.closest("li") as HTMLElement);
    const agarraderas = screen.getAllByRole("button", {
      name: "Mantené presionado y arrastrá para reordenar",
    });

    vi.spyOn(document, "elementFromPoint").mockReturnValue(items[0]);

    fireEvent.pointerDown(agarraderas[0], { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(agarraderas[0], { pointerId: 1, clientX: 5, clientY: 0 });
    fireEvent.pointerUp(agarraderas[0], { pointerId: 1 });

    expect(reordenarFotosAction).not.toHaveBeenCalled();
  });

  it("si cambia la prop fotos (subida/borrado confirmado), el orden local se resincroniza", () => {
    const primeraTanda = [foto({ id: "f-1" })];
    const { rerender } = render(<FotosManager alojamientoId="a-1" fotos={primeraTanda} />);
    expect(screen.getAllByRole("button", { name: /^Ver foto/ })).toHaveLength(1);

    const segundaTanda = [foto({ id: "f-1" }), foto({ id: "f-2", orden: 1 })];
    rerender(<FotosManager alojamientoId="a-1" fotos={segundaTanda} />);
    expect(screen.getAllByRole("button", { name: /^Ver foto/ })).toHaveLength(2);
  });
});
