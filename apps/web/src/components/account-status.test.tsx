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

  it("sin sesión, variant inline muestra Ingresar como recuadro delineado naranja", async () => {
    getSession.mockResolvedValue(null);
    render((await AccountStatus({ variant: "inline" })) as React.ReactElement);
    const link = screen.getByRole("link", { name: "Ingresar" });
    expect(link).toHaveAttribute("href", "/ingresar");
    // Mismo recuadro que "Cerrar sesión" logueado (2026-08-17), en naranja.
    expect(link.className).toContain("rounded-[12px]");
    expect(link.className).toContain("border-[rgba(230,126,34,0.45)]");
    expect(link.className).toContain("text-[#e67e22]");
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
