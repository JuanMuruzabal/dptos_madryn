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
  it("sin sesión, muestra el link de Ingresar", async () => {
    getSession.mockResolvedValue(null);
    render((await AccountStatus()) as React.ReactElement);
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
  });

  it("con sesión de cliente, renderiza AccountMenu sin admin", async () => {
    getSession.mockResolvedValue({ rol: "cliente" });
    render((await AccountStatus()) as React.ReactElement);
    expect(AccountMenu).toHaveBeenCalledWith({ esAdmin: false }, undefined);
    expect(screen.getByText("cliente")).toBeInTheDocument();
  });

  it("con sesión de administrador, pasa esAdmin=true a AccountMenu", async () => {
    getSession.mockResolvedValue({ rol: "administrador" });
    render((await AccountStatus()) as React.ReactElement);
    expect(screen.getByText("admin")).toBeInTheDocument();
  });
});

describe("AccountStatusFallback", () => {
  it("renderiza un placeholder", () => {
    const { container } = render(<AccountStatusFallback />);
    expect(container.querySelector("[aria-hidden]")).toBeInTheDocument();
  });
});
