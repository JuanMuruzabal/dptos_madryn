import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiteHeader } from "./site-header";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

beforeEach(() => {
  setScrollY(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SiteHeader", () => {
  it("fuera de la home, arranca sólido aunque no se haya scrolleado", () => {
    usePathname.mockReturnValue("/alojamiento");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("en la home sin scrollear, arranca transparente", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("banner").className).toContain("bg-transparent");
  });

  it("en la home, scrollear pasa el header a sólido", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    setScrollY(100);
    fireEvent.scroll(window);
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("renderiza los links de navegación principales", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("link", { name: "Experiencias" })).toHaveAttribute("href", "/experiencias");
    expect(screen.getByRole("link", { name: "Traslados" })).toHaveAttribute("href", "/traslados");
  });

  it("abre y cierra el menú mobile", () => {
    usePathname.mockReturnValue("/");
    const { container } = render(
      <SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />,
    );
    const toggle = screen.getByRole("button", { name: "Abrir menú" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
    expect(container.querySelector("#mobile-nav")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
    expect(container.querySelector("#mobile-nav")).not.toBeInTheDocument();
  });

  it("el menú mobile abierto fuerza el estado sólido", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("clickear un link del menú mobile lo cierra", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const mobileLinks = screen.getAllByRole("link", { name: "Experiencias" });
    fireEvent.click(mobileLinks[mobileLinks.length - 1]);
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("clickear el logo cierra el menú mobile", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("link", { name: "ALOJAMIENTOS MADRYN" }));
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("renderiza accountSlot y notificationsSlot recibidos", () => {
    usePathname.mockReturnValue("/");
    render(
      <SiteHeader
        accountSlot={<span>cuenta</span>}
        bannerSlot={<span>banner</span>}
        notificationsSlot={<span>notif</span>}
      />,
    );
    expect(screen.getAllByText("cuenta").length).toBeGreaterThan(0);
    expect(screen.getByText("notif")).toBeInTheDocument();
  });

  it("con el menú cerrado, muestra el bannerSlot; abierto, lo oculta", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} bannerSlot={<span>banner</span>} notificationsSlot={null} />);
    expect(screen.getByText("banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.queryByText("banner")).not.toBeInTheDocument();
  });
});
