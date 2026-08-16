import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({ getSessionToken }));

const api = {
  activarAlojamiento: vi.fn(),
  actualizarAlojamiento: vi.fn(),
  actualizarDatosReserva: vi.fn(),
  actualizarEstadoReserva: vi.fn(),
  borrarImagenSitio: vi.fn(),
  crearAlojamiento: vi.fn(),
  crearBloqueo: vi.fn(),
  darDeBajaAlojamiento: vi.fn(),
  borrarFoto: vi.fn(),
  eliminarBloqueo: vi.fn(),
  moderarResena: vi.fn(),
  reordenarFotos: vi.fn(),
  subirFoto: vi.fn(),
  subirFotoPortada: vi.fn(),
  subirImagenSitio: vi.fn(),
};
vi.mock("@/lib/api", () => api);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function archivoFalso(size = 100): File {
  return new File([new Uint8Array(size)], "archivo.jpg", { type: "image/jpeg" });
}

describe("crearAlojamientoBorradorAction", () => {
  it("redirige a /ingresar sin token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { crearAlojamientoBorradorAction } = await import("./admin");
    await expect(crearAlojamientoBorradorAction()).rejects.toThrow("REDIRECT:/ingresar");
  });

  it("crea el borrador con datos de relleno y redirige al modo editor", async () => {
    getSessionToken.mockResolvedValue("token");
    api.crearAlojamiento.mockResolvedValue({ ok: true, data: { id: "a-nuevo" } });
    const { crearAlojamientoBorradorAction } = await import("./admin");

    await expect(crearAlojamientoBorradorAction()).rejects.toThrow("REDIRECT:/alojamiento/a-nuevo?modo=editor");

    expect(api.crearAlojamiento).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ nombre: "Nuevo alojamiento", borrador: true, capacidad: 1, precioNoche: 1 }),
    );
  });

  it("vuelve al panel si crearAlojamiento falla", async () => {
    getSessionToken.mockResolvedValue("token");
    api.crearAlojamiento.mockResolvedValue({ ok: false, status: 500, error: "error" });
    const { crearAlojamientoBorradorAction } = await import("./admin");

    await expect(crearAlojamientoBorradorAction()).rejects.toThrow("REDIRECT:/admin/alojamientos");
  });
});

describe("actualizarAlojamientoAction", () => {
  it("pide iniciar sesión sin token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { actualizarAlojamientoAction } = await import("./admin");
    const resultado = await actualizarAlojamientoAction("a-1", {}, formData({}));
    expect(resultado.error).toMatch(/iniciá sesión/i);
  });

  it("arma el input desde el FormData y llama a actualizarAlojamiento", async () => {
    getSessionToken.mockResolvedValue("token");
    api.actualizarAlojamiento.mockResolvedValue({ ok: true, data: {} });
    const { actualizarAlojamientoAction } = await import("./admin");

    await actualizarAlojamientoAction(
      "a-1",
      {},
      formData({
        nombre: "  Depto  ", descripcion: "Desc", lat: "-42.7", lng: "-65.0",
        direccion: "Calle 123", precioNoche: "50000", capacidad: "4",
      }),
    );

    expect(api.actualizarAlojamiento).toHaveBeenCalledWith("token", "a-1", {
      nombre: "Depto", descripcion: "Desc", lat: -42.7, lng: -65.0,
      direccion: "Calle 123", precioNoche: 50000, capacidad: 4,
    });
  });

  it("propaga el error del backend", async () => {
    getSessionToken.mockResolvedValue("token");
    api.actualizarAlojamiento.mockResolvedValue({ ok: false, status: 400, error: "capacidad debe ser al menos 1" });
    const { actualizarAlojamientoAction } = await import("./admin");
    const resultado = await actualizarAlojamientoAction("a-1", {}, formData({ capacidad: "0" }));
    expect(resultado.error).toBe("capacidad debe ser al menos 1");
  });

  it("éxito devuelve success:true", async () => {
    getSessionToken.mockResolvedValue("token");
    api.actualizarAlojamiento.mockResolvedValue({ ok: true, data: {} });
    const { actualizarAlojamientoAction } = await import("./admin");
    expect(await actualizarAlojamientoAction("a-1", {}, formData({}))).toEqual({ success: true });
  });
});

describe("darDeBajaAlojamientoAction / activarAlojamientoAction", () => {
  it("no hacen nada sin token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { darDeBajaAlojamientoAction, activarAlojamientoAction } = await import("./admin");
    await darDeBajaAlojamientoAction("a-1");
    await activarAlojamientoAction("a-1");
    expect(api.darDeBajaAlojamiento).not.toHaveBeenCalled();
    expect(api.activarAlojamiento).not.toHaveBeenCalled();
  });

  it("llaman a la API correspondiente con el token", async () => {
    getSessionToken.mockResolvedValue("token");
    const { darDeBajaAlojamientoAction, activarAlojamientoAction } = await import("./admin");
    await darDeBajaAlojamientoAction("a-1");
    await activarAlojamientoAction("a-1");
    expect(api.darDeBajaAlojamiento).toHaveBeenCalledWith("token", "a-1");
    expect(api.activarAlojamiento).toHaveBeenCalledWith("token", "a-1");
  });
});

describe("subirFotoAction", () => {
  it("pide un archivo si no se eligió ninguno", async () => {
    getSessionToken.mockResolvedValue("token");
    const { subirFotoAction } = await import("./admin");
    const resultado = await subirFotoAction("a-1", {}, formData({}));
    expect(resultado.error).toMatch(/elegí un archivo/i);
  });

  it("rechaza un archivo vacío (size 0)", async () => {
    getSessionToken.mockResolvedValue("token");
    const { subirFotoAction } = await import("./admin");
    const fd = new FormData();
    fd.set("foto", new File([], "vacio.jpg"));
    const resultado = await subirFotoAction("a-1", {}, fd);
    expect(resultado.error).toMatch(/elegí un archivo/i);
  });

  it("sube el archivo con éxito", async () => {
    getSessionToken.mockResolvedValue("token");
    api.subirFoto.mockResolvedValue({ ok: true, data: {} });
    const { subirFotoAction } = await import("./admin");
    const fd = new FormData();
    fd.set("foto", archivoFalso());

    expect(await subirFotoAction("a-1", {}, fd)).toEqual({ success: true });
    expect(api.subirFoto).toHaveBeenCalledWith("token", "a-1", expect.any(File));
  });
});

describe("subirFotoPortadaAction", () => {
  it("pide un archivo si no se eligió ninguno", async () => {
    getSessionToken.mockResolvedValue("token");
    const { subirFotoPortadaAction } = await import("./admin");
    const resultado = await subirFotoPortadaAction("a-1", {}, formData({}));
    expect(resultado.error).toMatch(/elegí un archivo/i);
  });

  it("sube la portada con éxito", async () => {
    getSessionToken.mockResolvedValue("token");
    api.subirFotoPortada.mockResolvedValue({ ok: true, data: {} });
    const { subirFotoPortadaAction } = await import("./admin");
    const fd = new FormData();
    fd.set("portada", archivoFalso());
    expect(await subirFotoPortadaAction("a-1", {}, fd)).toEqual({ success: true });
  });
});

describe("crearBloqueoAction", () => {
  it("rechaza sin fechas", async () => {
    getSessionToken.mockResolvedValue("token");
    const { crearBloqueoAction } = await import("./admin");
    const resultado = await crearBloqueoAction("a-1", {}, formData({}));
    expect(resultado.error).toMatch(/fecha/i);
  });

  it("crea el bloqueo con motivo recortado", async () => {
    getSessionToken.mockResolvedValue("token");
    api.crearBloqueo.mockResolvedValue({ ok: true, data: {} });
    const { crearBloqueoAction } = await import("./admin");
    await crearBloqueoAction("a-1", {}, formData({ fechaInicio: "2026-09-01", fechaFin: "2026-09-05", motivo: "  Mantenimiento  " }));
    expect(api.crearBloqueo).toHaveBeenCalledWith("token", "a-1", "2026-09-01", "2026-09-05", "Mantenimiento");
  });

  it("propaga el error del backend (p. ej. solapado)", async () => {
    getSessionToken.mockResolvedValue("token");
    api.crearBloqueo.mockResolvedValue({ ok: false, status: 409, error: "se superponen" });
    const { crearBloqueoAction } = await import("./admin");
    const resultado = await crearBloqueoAction("a-1", {}, formData({ fechaInicio: "2026-09-01", fechaFin: "2026-09-05" }));
    expect(resultado.error).toBe("se superponen");
  });
});

describe("eliminarBloqueoAction", () => {
  it("llama a eliminarBloqueo con el token", async () => {
    getSessionToken.mockResolvedValue("token");
    const { eliminarBloqueoAction } = await import("./admin");
    await eliminarBloqueoAction("a-1", "b-1");
    expect(api.eliminarBloqueo).toHaveBeenCalledWith("token", "a-1", "b-1");
  });
});

describe("actualizarEstadoReservaAction / moderarResenaAction", () => {
  it("actualizarEstadoReservaAction llama a la API con el estado", async () => {
    getSessionToken.mockResolvedValue("token");
    const { actualizarEstadoReservaAction } = await import("./admin");
    await actualizarEstadoReservaAction("r-1", "confirmada");
    expect(api.actualizarEstadoReserva).toHaveBeenCalledWith("token", "r-1", "confirmada");
  });

  it("moderarResenaAction llama a la API con oculta", async () => {
    getSessionToken.mockResolvedValue("token");
    const { moderarResenaAction } = await import("./admin");
    await moderarResenaAction("res-1", true);
    expect(api.moderarResena).toHaveBeenCalledWith("token", "res-1", true);
  });
});

describe("actualizarDatosReservaAction", () => {
  it("rechaza sin fechas", async () => {
    getSessionToken.mockResolvedValue("token");
    const { actualizarDatosReservaAction } = await import("./admin");
    const resultado = await actualizarDatosReservaAction("r-1", {}, formData({}));
    expect(resultado.error).toMatch(/fecha/i);
  });

  it("éxito devuelve success:true", async () => {
    getSessionToken.mockResolvedValue("token");
    api.actualizarDatosReserva.mockResolvedValue({ ok: true, data: {} });
    const { actualizarDatosReservaAction } = await import("./admin");
    const resultado = await actualizarDatosReservaAction(
      "r-1", {}, formData({ fechaInicio: "2026-09-01", fechaFin: "2026-09-05" }),
    );
    expect(resultado).toEqual({ success: true });
  });
});

describe("subirImagenSitioAction / borrarImagenSitioAction", () => {
  it("subirImagenSitioAction pide un archivo si no se eligió ninguno", async () => {
    getSessionToken.mockResolvedValue("token");
    const { subirImagenSitioAction } = await import("./admin");
    const resultado = await subirImagenSitioAction("home_hero", {}, formData({}));
    expect(resultado.error).toMatch(/elegí un archivo/i);
  });

  it("subirImagenSitioAction sube con éxito", async () => {
    getSessionToken.mockResolvedValue("token");
    api.subirImagenSitio.mockResolvedValue({ ok: true, data: {} });
    const { subirImagenSitioAction } = await import("./admin");
    const fd = new FormData();
    fd.set("imagen", archivoFalso());
    expect(await subirImagenSitioAction("home_hero", {}, fd)).toEqual({ success: true });
  });

  it("borrarImagenSitioAction llama a la API con la clave", async () => {
    getSessionToken.mockResolvedValue("token");
    const { borrarImagenSitioAction } = await import("./admin");
    await borrarImagenSitioAction("home_hero");
    expect(api.borrarImagenSitio).toHaveBeenCalledWith("token", "home_hero");
  });
});
