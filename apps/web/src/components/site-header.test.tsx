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
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("en la home sin scrollear, arranca transparente", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("banner").className).toContain("bg-transparent");
  });

  it("en la home, scrollear pasa el header a sólido", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    setScrollY(100);
    fireEvent.scroll(window);
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("renderiza los links de navegación principales", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    expect(screen.getByRole("link", { name: "Experiencias" })).toHaveAttribute("href", "/experiencias");
    expect(screen.getByRole("link", { name: "Traslados" })).toHaveAttribute("href", "/traslados");
  });

  it("abre y cierra el menú mobile", () => {
    usePathname.mockReturnValue("/");
    const { container } = render(
      <SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />,
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
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("banner").className).toContain("bg-ink");
  });

  it("clickear un link del menú mobile lo cierra", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const mobileLinks = screen.getAllByRole("link", { name: "Experiencias" });
    fireEvent.click(mobileLinks[mobileLinks.length - 1]);
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("clickear el logo cierra el menú mobile", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("link", { name: "ALOJAMIENTOS MADRYN" }));
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
  });

  it("renderiza accountSlot (desktop) y notificationsSlot recibidos", () => {
    usePathname.mockReturnValue("/");
    render(
      <SiteHeader
        accountSlot={<span>cuenta</span>}
        accountSlotMobile={<span>cuenta-mobile</span>}
        bannerSlot={<span>banner</span>}
        notificationsSlot={<span>notif</span>}
      />,
    );
    expect(screen.getByText("cuenta")).toBeInTheDocument();
    expect(screen.getByText("notif")).toBeInTheDocument();
  });

  it("el menú mobile usa accountSlotMobile, no accountSlot", () => {
    usePathname.mockReturnValue("/");
    render(
      <SiteHeader
        accountSlot={<span>cuenta-desktop</span>}
        accountSlotMobile={<span>cuenta-mobile</span>}
        bannerSlot={null}
        notificationsSlot={null}
      />,
    );
    expect(screen.queryByText("cuenta-mobile")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByText("cuenta-mobile")).toBeInTheDocument();
  });

  it("el menú mobile usa capitalización de oración, distinta del nav de escritorio", () => {
    usePathname.mockReturnValue("/");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    // Desktop: "Servicio Turístico" (tracked-caps la muestra en mayúsculas
    // igual, pero el texto de origen no cambia).
    expect(screen.getByRole("link", { name: "Servicio Turístico" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    // Mobile: "Servicio turístico" (mobileLabel, 2026-08-17).
    expect(screen.getByRole("link", { name: "Servicio turístico" })).toBeInTheDocument();
  });

  it("marca con la barra coral el link del menú mobile que coincide con la ruta actual", () => {
    usePathname.mockReturnValue("/experiencias");
    render(<SiteHeader accountSlot={null} accountSlotMobile={null} bannerSlot={null} notificationsSlot={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    // El nav de escritorio (hidden md:flex) sigue en el DOM en jsdom, así
    // que hay 2 links con el mismo nombre — el último es el del drawer
    // mobile (mismo criterio que "clickear un link del menú mobile...").
    const activoLinks = screen.getAllByRole("link", { name: "Experiencias" });
    const activo = activoLinks[activoLinks.length - 1];
    expect(activo.className).toContain("border-[#e07a5f]");
    expect(activo.className).toContain("bg-[rgba(224,122,95,0.16)]");

    const inactivoLinks = screen.getAllByRole("link", { name: "Traslados" });
    const inactivo = inactivoLinks[inactivoLinks.length - 1];
    expect(inactivo.className).toContain("border-transparent");
    expect(inactivo.className).not.toContain("border-[#e07a5f]");
  });

  it("con el menú cerrado, muestra el bannerSlot; abierto, lo oculta", () => {
    usePathname.mockReturnValue("/");
    render(
      <SiteHeader
        accountSlot={null}
        accountSlotMobile={null}
        bannerSlot={<span>banner</span>}
        notificationsSlot={null}
      />,
    );
    expect(screen.getByText("banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.queryByText("banner")).not.toBeInTheDocument();
  });
});
