import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Syne: () => ({ className: "syne" }),
  Kosugi_Maru: () => ({ className: "kosugi" }),
  Unbounded: () => ({ className: "unbounded" }),
}));

import Home from "./page";

describe("Home", () => {
  it("fumumu. ロゴが表示される", () => {
    render(<Home />);
    const logos = screen.getAllByText(/fumumu/);
    expect(logos.length).toBeGreaterThan(0);
  });

  it("始めるボタンが表示される", () => {
    render(<Home />);
    const buttons = screen.getAllByText(/始める/);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("キャッチコピーが表示される", () => {
    render(<Home />);
    expect(screen.getByText(/専門用語を、その場で、あなたの言葉に。/)).toBeInTheDocument();
  });
});
