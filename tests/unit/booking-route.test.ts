import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import { GET, POST } from "@/app/api/bookings/route";

const calls = vi.hoisted(() => ({
  runtime: vi.fn(),
  context: vi.fn(),
  list: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getDomainAuthRuntime: calls.runtime }));
vi.mock("@/features/bookings/read-service", () => ({
  listParticipantBookings: calls.list,
  readParticipantBooking: vi.fn(),
}));
vi.mock("@/features/booking-workflows/composition", () => ({
  bookingWorkflowContext: calls.context,
}));
vi.mock("@/features/booking-workflows/handler", () => ({
  handleWorkflowMutation: calls.mutate,
}));

const runtime = { origin: "http://127.0.0.1:3000" } as AuthRuntime;
beforeEach(() => {
  vi.resetAllMocks();
  calls.runtime.mockResolvedValue(runtime);
  calls.context.mockReturnValue({ booking: { authority: "enabled" } });
});

describe("booking collection route", () => {
  it("dispatches GET through the private read handler and preserves empty list JSON", async () => {
    const page = {
      learners: [],
      items: [],
      scope: "guardian",
      filter: "all",
      page: 1,
      pageSize: 20,
      hasNext: false,
      viewerTimezone: "Asia/Manila",
      snapshotAtUtc: "2026-10-18T00:00:00.000Z",
    };
    calls.list.mockResolvedValue(page);
    const request = new Request(
      `${runtime.origin}/api/bookings?scope=guardian`,
    );

    const response = await GET(request);

    expect(calls.runtime).toHaveBeenCalledOnce();
    expect(calls.list).toHaveBeenCalledExactlyOnceWith(
      runtime,
      request.headers,
      { scope: "guardian" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.json()).toEqual(page);
    expect(calls.context).not.toHaveBeenCalled();
    expect(calls.mutate).not.toHaveBeenCalled();
  });

  it("retains POST dispatch to the booking creation handler", async () => {
    const request = new Request(`${runtime.origin}/api/bookings`, {
      method: "POST",
    });
    const created = Response.json({ id: "created-booking" }, { status: 201 });
    calls.mutate.mockResolvedValue(created);

    expect(await POST(request)).toBe(created);
    expect(calls.runtime).toHaveBeenCalledOnce();
    expect(calls.context).toHaveBeenCalledExactlyOnceWith(runtime);
    expect(calls.mutate).toHaveBeenCalledExactlyOnceWith(runtime, request);
    expect(calls.list).not.toHaveBeenCalled();
  });
});
