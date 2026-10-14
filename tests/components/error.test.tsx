// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: null,
      isPending: true,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    }),
  },
}));

it("lets a visitor retry without displaying internal error data", async () => {
  const reset = vi.fn();
  const user = userEvent.setup();
  render(<ErrorPage error={new Error("PRIVATE_TEST_VALUE")} reset={reset} />);
  expect(screen.queryByText("PRIVATE_TEST_VALUE")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
});
