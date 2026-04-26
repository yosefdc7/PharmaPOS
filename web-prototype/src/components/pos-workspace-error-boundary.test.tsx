/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { PosWorkspaceErrorBoundary } from "./pos-workspace-error-boundary";

function ThrowingChild(): ReactElement {
  throw new Error("boom");
}

describe("PosWorkspaceErrorBoundary", () => {
  it("renders a recoverable fallback when a child crashes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <PosWorkspaceErrorBoundary>
        <ThrowingChild />
      </PosWorkspaceErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "Workspace unavailable" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload workspace" })).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it("reloads the page from the fallback action", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reloadSpy = vi.fn();

    render(
      <PosWorkspaceErrorBoundary onReload={reloadSpy}>
        <ThrowingChild />
      </PosWorkspaceErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload workspace" }));

    expect(reloadSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
