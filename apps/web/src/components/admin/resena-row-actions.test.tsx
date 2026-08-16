import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResenaRowActions } from "./resena-row-actions";

const { moderarResenaAction, refresh } = vi.hoisted(() => ({
  moderarResenaAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ moderarResenaAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResenaRowActions", () => {
  it("muestra 'Ocultar' para una reseña visible", () => {
    render(<ResenaRowActions id="r-1" oculta={false} />);
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
  });

  it("muestra 'Mostrar' para una reseña oculta", () => {
    render(<ResenaRowActions id="r-1" oculta={true} />);
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
  });

  it("clickear 'Ocultar' llama a moderarResenaAction con oculta:true", async () => {
    render(<ResenaRowActions id="r-9" oculta={false} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(moderarResenaAction).toHaveBeenCalledWith("r-9", true));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("clickear 'Mostrar' llama a moderarResenaAction con oculta:false", async () => {
    render(<ResenaRowActions id="r-9" oculta={true} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(moderarResenaAction).toHaveBeenCalledWith("r-9", false));
  });
});
