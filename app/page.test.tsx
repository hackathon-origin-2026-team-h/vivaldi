import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/image", () => ({
  default: ({ alt }: React.ComponentProps<"img">) => <span data-next-image={alt ?? ""} />,
}));

describe("Home", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(screen.getByText("To get started, edit the page.tsx file.")).toBeInTheDocument();
  });

  it("renders the deploy link", () => {
    render(<Home />);
    expect(screen.getByText("Deploy Now")).toBeInTheDocument();
  });

  it("renders the documentation link", () => {
    render(<Home />);
    expect(screen.getByText("Documentation")).toBeInTheDocument();
  });
});
