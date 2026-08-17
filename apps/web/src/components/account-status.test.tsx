import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountStatus, AccountStatusFallback } from "./account-status";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession }));

const { AccountMenu } = vi.hoisted(() => ({
  AccountMenu: vi.fn(({ esAdmin }: { esAdmin: boolean }) => (
    <div data-testid="account-menu">{esAdmin ? "admin" : "cliente"}</div>
  )),
}));
vi.mock("@/components/account-menu", () => ({ AccountMenu }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountStatus", () => {
  it("sin sesión, muestra el link de Ingresar (variant dropdown por defecto)", async () => {
    getSession.mockResolvedValue(null);
    render((await AccountStatus()) as React.ReactElement);
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
  });

  it("sin sesión, variant inline muestra Ingresar como píldora rellena coral, ancho automático", async () => {
    getSession.mockResolvedValue(null);
    render((await AccountStatus({ variant: "inline" })) as React.ReactElement);
    const link = screen.getByRole("link", { name: "Ingresar" });
    expect(link).toHaveAttribute("href", "/ingresar");
    // Píldora rellena (2026-08-17), no el recuadro delineado de la ronda
    // anterior: ancho automático (inline-flex, no w-full), fondo coral
    // sólido, texto/ícono en tono oscuro.
    expect(link.className).toContain("inline-flex");
    expect(link.className).not.toContain("w-full");
    expect(link.className).toContain("rounded-full");
    expect(link.className).toContain("bg-[#e07a5f]");
    expect(link.className).toContain("text-[#3a140c]");
    // Alineado a la izquierda, no centrado.
    expect(link.parentElement?.className).toContain("justify-start");
  });

  it("con sesión de cliente, renderiza AccountMenu sin admin, variant dropdown por defecto", async () => {
    getSession.mockResolvedValue({ rol: "cliente" });
    render((await AccountStatus()) as React.ReactElement);
    expect(AccountMenu).toHaveBeenCalledWith({ esAdmin: false, variant: "dropdown" }, undefined);
    expect(screen.getByText("cliente")).toBeInTheDocument();
  });

  it("con sesión de administrador, pasa esAdmin=true a AccountMenu", async () => {
    getSession.mockResolvedValue({ rol: "administrador" });
    render((await AccountStatus()) as React.ReactElement);
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("con sesión, variant inline se propaga a AccountMenu", async () => {
    getSession.mockResolvedValue({ rol: "cliente" });
    render((await AccountStatus({ variant: "inline" })) as React.ReactElement);
    expect(AccountMenu).toHaveBeenCalledWith({ esAdmin: false, variant: "inline" }, undefined);
  });
});

describe("AccountStatusFallback", () => {
  it("renderiza un placeholder", () => {
    const { container } = render(<AccountStatusFallback />);
    expect(container.querySelector("[aria-hidden]")).toBeInTheDocument();
  });
});
