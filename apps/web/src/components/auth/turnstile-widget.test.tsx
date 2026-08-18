import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TurnstileWidget } from "./turnstile-widget";

// next/script no dispara su ciclo real de carga fuera del runtime de
// Next.js — se mockea para llamar a onReady apenas se monta, simulando
// "el script ya cargó" (mismo momento en que el componente real
// dispararía window.turnstile.render()).
vi.mock("next/script", () => ({
  // Nombrada (no una arrow anónima) a propósito: asignada a la key
  // "default" (lowercase), eslint-plugin-react-hooks infiere el nombre
  // del componente de esa key y rechaza el useEffect de adentro por no
  // empezar con mayúscula si se deja anónima.
  default: function MockScript({ onReady }: { onReady?: () => void }) {
    useEffect(() => {
      onReady?.();
    }, [onReady]);
    return null;
  },
}));

const render_ = vi.fn(() => "widget-1");
const remove = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.turnstile = { render: render_, remove };
});

afterEach(() => {
  delete window.turnstile;
});

describe("TurnstileWidget", () => {
  it("llama a window.turnstile.render con la site key, apuntando al contenedor real", async () => {
    render(<TurnstileWidget siteKey="mi-site-key" onToken={vi.fn()} />);

    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));
    const [container, options] = render_.mock.calls[0];
    expect(container).toBeInstanceOf(HTMLElement);
    expect(options.sitekey).toBe("mi-site-key");
  });

  it("resolver el widget (callback) llama a onToken con el token", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="s" onToken={onToken} />);
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));

    const options = render_.mock.calls[0][1];
    options.callback("token-resuelto");

    expect(onToken).toHaveBeenCalledWith("token-resuelto");
  });

  it("expirar el widget llama a onToken con string vacío", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="s" onToken={onToken} />);
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));

    const options = render_.mock.calls[0][1];
    options["expired-callback"]();

    expect(onToken).toHaveBeenCalledWith("");
  });

  it("un error del widget llama a onToken con string vacío", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="s" onToken={onToken} />);
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));

    const options = render_.mock.calls[0][1];
    options["error-callback"]();

    expect(onToken).toHaveBeenCalledWith("");
  });

  it("al desmontar, remueve el widget", async () => {
    const { unmount } = render(<TurnstileWidget siteKey="s" onToken={vi.fn()} />);
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));

    unmount();

    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
