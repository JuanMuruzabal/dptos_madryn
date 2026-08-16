import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Countdown } from "./countdown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Countdown", () => {
  it("muestra M:SS cuando falta menos de una hora", () => {
    const deadline = new Date(Date.now() + 90 * 1000).toISOString(); // 1:30
    render(<Countdown deadline={deadline} />);
    expect(screen.getByText(/^1:3\d$/)).toBeInTheDocument();
  });

  it("muestra Hh MMm cuando falta más de una hora", () => {
    const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h
    render(<Countdown deadline={deadline} />);
    expect(screen.getByText(/^2h 00m$/)).toBeInTheDocument();
  });

  it("muestra 0:00 con un deadline ya pasado", () => {
    const deadline = new Date(Date.now() - 1000).toISOString();
    render(<Countdown deadline={deadline} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("cuenta hacia atrás con cada tick de 1 segundo", () => {
    const deadline = new Date(Date.now() + 5000).toISOString(); // 0:05
    render(<Countdown deadline={deadline} />);
    expect(screen.getByText("0:05")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("0:04")).toBeInTheDocument();
  });

  it("llama a onExpire una sola vez al llegar a 0", () => {
    const onExpire = vi.fn();
    const deadline = new Date(Date.now() + 1500).toISOString();
    render(<Countdown deadline={deadline} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(1000); // todavía no expiró
    });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000); // ya expiró, y varios ticks más después
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
