import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alojamiento, Usuario } from "@turismo-marcuzzi/shared-types";
import {
  actualizarAlojamiento,
  actualizarContenidoSitio,
  actualizarDatosReserva,
  actualizarEstadoReserva,
  activarAlojamiento,
  apiUrl,
  borrarFoto,
  borrarImagenSitio,
  crearAlojamiento,
  crearBloqueo,
  crearReserva,
  crearResena,
  darDeBajaAlojamiento,
  eliminarBloqueo,
  fetchAlojamiento,
  fetchAlojamientoVigente,
  fetchAlojamientos,
  fetchAlojamientosAdmin,
  fetchBloqueos,
  fetchContenidoSitio,
  fetchDisponibilidad,
  fetchImagenesSitio,
  fetchImagenesSitioMap,
  fetchMe,
  fetchMisReservas,
  fetchResenas,
  fetchResenasAdmin,
  fetchReservasAdmin,
  marcarContactado,
  moderarResena,
  reordenarFotos,
  subirFoto,
  subirFotoPortada,
  subirImagenSitio,
} from "./api";

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const res = {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
  vi.mocked(fetch).mockResolvedValueOnce(res);
  return res;
}

function mockFetchNoContent() {
  const res = { ok: true, status: 204, json: vi.fn() } as unknown as Response;
  vi.mocked(fetch).mockResolvedValueOnce(res);
  return res;
}

function ultimaLlamada() {
  const calls = vi.mocked(fetch).mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiUrl", () => {
  it("antepone la base de API_URL al path", () => {
    expect(apiUrl("/alojamientos")).toBe("http://localhost:8080/alojamientos");
  });

  it("agrega la barra inicial si falta", () => {
    expect(apiUrl("alojamientos")).toBe("http://localhost:8080/alojamientos");
  });
});

describe("fetchMe", () => {
  it("devuelve el usuario con un token válido", async () => {
    const usuario: Usuario = { id: "u-1", nombre: "Ana", email: "ana@example.com", rol: "cliente" };
    mockFetchOnce(200, usuario);

    const resultado = await fetchMe("token-valido");
    expect(resultado).toEqual(usuario);
    expect(ultimaLlamada()[1]?.headers).toMatchObject({ Authorization: "Bearer token-valido" });
  });

  it("devuelve null si el token no es válido", async () => {
    mockFetchOnce(401, { error: "token inválido" });
    expect(await fetchMe("token-invalido")).toBeNull();
  });
});

describe("fetchAlojamientos", () => {
  it("sin filtros no agrega query string", async () => {
    mockFetchOnce(200, []);
    await fetchAlojamientos({});
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/alojamientos");
  });

  it("arma el query string traduciendo camelCase a snake_case", async () => {
    mockFetchOnce(200, []);
    await fetchAlojamientos({ fechaInicio: "2026-09-01", fechaFin: "2026-09-05", huespedes: 4, precioMin: 1000, precioMax: 5000 });

    const url = ultimaLlamada()[0] as string;
    expect(url).toContain("fecha_inicio=2026-09-01");
    expect(url).toContain("fecha_fin=2026-09-05");
    expect(url).toContain("huespedes=4");
    expect(url).toContain("precio_min=1000");
    expect(url).toContain("precio_max=5000");
  });

  it("devuelve un array vacío ante un error del backend", async () => {
    mockFetchOnce(500, { error: "error interno" });
    expect(await fetchAlojamientos({})).toEqual([]);
  });
});

describe("fetchAlojamiento", () => {
  it("devuelve el alojamiento si existe", async () => {
    const alojamiento = { id: "a-1", nombre: "Depto" } as Alojamiento;
    mockFetchOnce(200, alojamiento);
    expect(await fetchAlojamiento("a-1")).toEqual(alojamiento);
  });

  it("devuelve null si no existe (404)", async () => {
    mockFetchOnce(404, { error: "no encontrado" });
    expect(await fetchAlojamiento("no-existe")).toBeNull();
  });
});

describe("fetchDisponibilidad", () => {
  it("devuelve los rangos ocupados", async () => {
    mockFetchOnce(200, { ocupado: [{ inicio: "2026-09-01", fin: "2026-09-05" }] });
    const resultado = await fetchDisponibilidad("a-1");
    expect(resultado.ocupado).toHaveLength(1);
  });

  it("degrada a sin ocupación conocida ante un error", async () => {
    mockFetchOnce(500, { error: "error" });
    expect(await fetchDisponibilidad("a-1")).toEqual({ ocupado: [] });
  });
});

// requestAuthed (interno) se ejercita a través de sus callers — cubre las
// 4 ramas reales: éxito con body, éxito 204 sin body, error con JSON
// parseable, y falla de red (fetch tira excepción).
describe("requestAuthed (a través de crearAlojamiento/darDeBajaAlojamiento/etc.)", () => {
  it("éxito con body JSON", async () => {
    const alojamiento = { id: "a-1", nombre: "Nuevo" } as Alojamiento;
    mockFetchOnce(201, alojamiento);

    const resultado = await crearAlojamiento("token", {
      nombre: "Nuevo", descripcion: "", lat: 0, lng: 0, direccion: "", precioNoche: 1000, capacidad: 2,
    });

    expect(resultado).toEqual({ ok: true, data: alojamiento });
  });

  it("éxito 204 sin body", async () => {
    mockFetchNoContent();
    const resultado = await darDeBajaAlojamiento("token", "a-1");
    expect(resultado).toEqual({ ok: true, data: undefined });
  });

  it("error con mensaje del backend", async () => {
    mockFetchOnce(400, { error: "nombre es requerido" });
    const resultado = await crearAlojamiento("token", {
      nombre: "", descripcion: "", lat: 0, lng: 0, direccion: "", precioNoche: 1000, capacidad: 2,
    });
    expect(resultado).toEqual({ ok: false, status: 400, error: "nombre es requerido" });
  });

  it("error sin body JSON parseable cae a un mensaje genérico", async () => {
    const res = {
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("no es json")),
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValueOnce(res);

    const resultado = await darDeBajaAlojamiento("token", "a-1");
    expect(resultado).toEqual({ ok: false, status: 500, error: "Ocurrió un error inesperado." });
  });

  it("fetch tirando una excepción (sin conexión) da status 0", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    const resultado = await darDeBajaAlojamiento("token", "a-1");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.status).toBe(0);
    }
  });

  it("manda el método y el body correctos", async () => {
    mockFetchOnce(200, {});
    await actualizarEstadoReserva("token", "r-1", "confirmada");

    const [, init] = ultimaLlamada();
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ estado: "confirmada" });
  });
});

describe("marcarContactado", () => {
  it("devuelve true si el backend responde ok", async () => {
    mockFetchOnce(204, undefined);
    expect(await marcarContactado("token", "r-1")).toBe(true);
  });

  it("devuelve false si el backend responde error", async () => {
    mockFetchOnce(404, { error: "no encontrada" });
    expect(await marcarContactado("token", "r-1")).toBe(false);
  });

  it("devuelve false ante un error de red", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    expect(await marcarContactado("token", "r-1")).toBe(false);
  });
});

describe("fetchAlojamientoVigente", () => {
  it("devuelve el valor de vigente del backend", async () => {
    mockFetchOnce(200, { vigente: true });
    expect(await fetchAlojamientoVigente("token")).toBe(true);
  });

  it("devuelve false ante un error del backend", async () => {
    mockFetchOnce(500, { error: "error" });
    expect(await fetchAlojamientoVigente("token")).toBe(false);
  });

  it("devuelve false ante un error de red (postura conservadora)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    expect(await fetchAlojamientoVigente("token")).toBe(false);
  });
});

describe("subirFoto / subirFotoPortada / subirImagenSitio (multipart)", () => {
  it("subirFoto manda un FormData con el campo 'foto', sin Content-Type manual", async () => {
    mockFetchOnce(201, { id: "f-1", url: "http://x/f.jpg" });
    const file = new File(["contenido"], "foto.jpg", { type: "image/jpeg" });

    await subirFoto("token", "a-1", file);

    const [url, init] = ultimaLlamada();
    expect(url).toBe("http://localhost:8080/alojamientos/a-1/fotos");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("foto")).toBe(file);
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("subirFotoPortada manda el campo 'portada'", async () => {
    mockFetchOnce(201, { id: "f-1", url: "http://x/p.jpg" });
    const file = new File(["contenido"], "portada.jpg", { type: "image/jpeg" });

    await subirFotoPortada("token", "a-1", file);

    const [, init] = ultimaLlamada();
    expect((init?.body as FormData).get("portada")).toBe(file);
  });

  it("subirImagenSitio manda el campo 'imagen' por PUT", async () => {
    mockFetchOnce(200, { clave: "home_hero", url: "http://x/h.jpg" });
    const file = new File(["contenido"], "hero.jpg", { type: "image/jpeg" });

    await subirImagenSitio("token", "home_hero", file);

    const [url, init] = ultimaLlamada();
    expect(url).toBe("http://localhost:8080/imagenes-sitio/home_hero");
    expect(init?.method).toBe("PUT");
    expect((init?.body as FormData).get("imagen")).toBe(file);
  });

  it("subirFoto propaga el error de red igual que requestAuthed", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    const resultado = await subirFoto("token", "a-1", new File(["x"], "x.jpg"));
    expect(resultado.ok).toBe(false);
  });
});

describe("fetchReservasAdmin", () => {
  it("sin estado no agrega query string", async () => {
    mockFetchOnce(200, []);
    await fetchReservasAdmin("token");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/reservas");
  });

  it("con estado agrega ?estado=", async () => {
    mockFetchOnce(200, []);
    await fetchReservasAdmin("token", "pendiente");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/reservas?estado=pendiente");
  });
});

describe("fetchImagenesSitioMap", () => {
  it("convierte el array de imágenes en un Map clave→url", async () => {
    mockFetchOnce(200, [
      { clave: "home_hero", url: "http://x/hero.jpg" },
      { clave: "home_categoria_alojamiento", url: "http://x/cat.jpg" },
    ]);

    const mapa = await fetchImagenesSitioMap();
    expect(mapa.get("home_hero")).toBe("http://x/hero.jpg");
    expect(mapa.get("home_categoria_alojamiento")).toBe("http://x/cat.jpg");
    expect(mapa.size).toBe(2);
  });

  it("devuelve un Map vacío si no hay imágenes cargadas", async () => {
    mockFetchOnce(200, []);
    expect((await fetchImagenesSitioMap()).size).toBe(0);
  });
});

describe("fetchContenidoSitio", () => {
  it("devuelve el contenido cargado", async () => {
    mockFetchOnce(200, { clave: "x", titulo: "T", descripcion: "D" });
    expect(await fetchContenidoSitio("x")).toEqual({ clave: "x", titulo: "T", descripcion: "D" });
  });

  it("sin fila cargada, cae a strings vacíos con la clave pedida", async () => {
    mockFetchOnce(500, { error: "error" });
    expect(await fetchContenidoSitio("no-existe")).toEqual({ clave: "no-existe", titulo: "", descripcion: "" });
  });
});

// El resto de los wrappers admin son variaciones directas del mismo
// patrón ya cubierto arriba (fetch simple con token, o requestAuthed) —
// se testean livianamente para cerrar cobertura de cada función exportada
// sin repetir los mismos casos de error/éxito ya probados en detalle.
describe("wrappers admin restantes", () => {
  it("fetchAlojamientosAdmin pide incluirInactivos=true", async () => {
    mockFetchOnce(200, []);
    await fetchAlojamientosAdmin("token");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/alojamientos?incluirInactivos=true");
  });

  it("actualizarAlojamiento hace PUT", async () => {
    mockFetchOnce(200, {});
    await actualizarAlojamiento("token", "a-1", {
      nombre: "X", descripcion: "", lat: 0, lng: 0, direccion: "", precioNoche: 1, capacidad: 1,
    });
    expect(ultimaLlamada()[1]?.method).toBe("PUT");
  });

  it("activarAlojamiento hace POST a /activar", async () => {
    mockFetchNoContent();
    await activarAlojamiento("token", "a-1");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/alojamientos/a-1/activar");
  });

  it("borrarFoto hace DELETE", async () => {
    mockFetchNoContent();
    await borrarFoto("token", "a-1", "f-1");
    expect(ultimaLlamada()[1]?.method).toBe("DELETE");
  });

  it("reordenarFotos manda el array de orden", async () => {
    mockFetchNoContent();
    await reordenarFotos("token", "a-1", ["f-2", "f-1"]);
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual({ orden: ["f-2", "f-1"] });
  });

  it("fetchBloqueos devuelve [] ante error", async () => {
    mockFetchOnce(500, {});
    expect(await fetchBloqueos("token", "a-1")).toEqual([]);
  });

  it("crearBloqueo manda fechas y motivo", async () => {
    mockFetchOnce(201, {});
    await crearBloqueo("token", "a-1", "2026-09-01", "2026-09-05", "Mantenimiento");
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual({
      fechaInicio: "2026-09-01", fechaFin: "2026-09-05", motivo: "Mantenimiento",
    });
  });

  it("eliminarBloqueo hace DELETE al path correcto", async () => {
    mockFetchNoContent();
    await eliminarBloqueo("token", "a-1", "b-1");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/alojamientos/a-1/bloqueos/b-1");
  });

  it("fetchResenasAdmin devuelve [] ante error", async () => {
    mockFetchOnce(500, {});
    expect(await fetchResenasAdmin("token")).toEqual([]);
  });

  it("moderarResena manda oculta", async () => {
    mockFetchNoContent();
    await moderarResena("token", "r-1", true);
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual({ oculta: true });
  });

  it("actualizarDatosReserva hace PATCH con el input completo", async () => {
    mockFetchOnce(200, {});
    const input = {
      fechaInicio: "2026-09-01", fechaFin: "2026-09-05",
      contactoNombre: "Ana", contactoApellido: "Test", contactoDni: "12345678",
      contactoEmail: "ana@example.com", contactoTelefono: "1122334455",
    };
    await actualizarDatosReserva("token", "r-1", input);
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual(input);
  });

  it("actualizarContenidoSitio hace PUT con título y descripción", async () => {
    mockFetchOnce(200, {});
    await actualizarContenidoSitio("token", "home", "Título", "Descripción");
    const [, init] = ultimaLlamada();
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ titulo: "Título", descripcion: "Descripción" });
  });

  it("fetchImagenesSitio devuelve [] ante error", async () => {
    mockFetchOnce(500, {});
    expect(await fetchImagenesSitio()).toEqual([]);
  });

  it("borrarImagenSitio hace DELETE al path correcto", async () => {
    mockFetchNoContent();
    await borrarImagenSitio("token", "home_hero");
    expect(ultimaLlamada()[0]).toBe("http://localhost:8080/imagenes-sitio/home_hero");
  });

  it("fetchMisReservas devuelve [] ante error", async () => {
    mockFetchOnce(500, {});
    expect(await fetchMisReservas("token")).toEqual([]);
  });

  it("fetchResenas devuelve [] ante error", async () => {
    mockFetchOnce(500, {});
    expect(await fetchResenas("a-1")).toEqual([]);
  });

  it("crearReserva manda fechas y contacto combinados", async () => {
    mockFetchOnce(201, {});
    const contacto = {
      contactoNombre: "Ana", contactoApellido: "Test", contactoDni: "12345678",
      contactoEmail: "ana@example.com", contactoTelefono: "1122334455",
    };
    await crearReserva("token", "a-1", "2026-09-01", "2026-09-05", contacto);
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual({
      fechaInicio: "2026-09-01", fechaFin: "2026-09-05", ...contacto,
    });
  });

  it("crearResena manda rating y texto", async () => {
    mockFetchOnce(201, {});
    await crearResena("token", "a-1", 5, "Excelente");
    const [, init] = ultimaLlamada();
    expect(JSON.parse(init?.body as string)).toEqual({ rating: 5, texto: "Excelente" });
  });
});
