// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { SafeguardingReportForm } from "@/features/safeguarding/forms";
import { ScreeningRequest } from "@/features/tutor-screening/forms";
import { CreateLearnerForm } from "@/features/learners/create-learner-form";
import { AdmissionForm } from "@/features/learner-admission/forms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const pageId = "33333333-3333-4333-8333-333333333333";
const reloadId = "44444444-4444-4444-8444-444444444444";
const zones = [{ value: "UTC", label: "UTC" }];
type Payload = Record<string, unknown>;

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

function reportForm() {
  return screen.getByLabelText("Concern").closest("form")!;
}
function fillReport() {
  fireEvent.change(screen.getByLabelText("Report subject"), {
    target: { value: "Fictional concern" },
  });
  fireEvent.change(screen.getByLabelText("Concern"), {
    target: { value: "Fictional details" },
  });
}

describe("safeguarding report retry identity", () => {
  it("replays one committed report after in-flight edit/restore and response loss", async () => {
    let rejectFirst: (reason: Error) => void = () => {};
    const first = new Promise<Response>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const bodies: Payload[] = [];
    const committed = new Map<string, string>();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const body: Payload = JSON.parse(String(init.body));
        bodies.push(body);
        const { requestKey, ...payload } = body;
        const key = String(requestKey);
        const fingerprint = JSON.stringify(payload);
        if (committed.has(key)) expect(committed.get(key)).toBe(fingerprint);
        else committed.set(key, fingerprint);
        return bodies.length === 1
          ? first
          : Promise.resolve(
              Response.json({ message: "Unavailable." }, { status: 503 }),
            );
      }),
    );
    render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    fireEvent.change(screen.getByLabelText("Report subject"), {
      target: { value: "Edited while waiting" },
    });
    fireEvent.change(screen.getByLabelText("Report subject"), {
      target: { value: "Fictional concern" },
    });
    await waitFor(() => expect(bodies).toHaveLength(1));
    await act(async () =>
      rejectFirst(new TypeError("Response lost after commit")),
    );
    fireEvent.submit(reportForm());
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual(bodies[0]);
    expect(committed.size).toBe(1);
  });

  it("blocks synchronous repeated submits, locks fields and retries the original uncertain payload", async () => {
    let rejectFirst: (reason: Error) => void = () => {};
    const first = new Promise<Response>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const fetch = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockRejectedValue(new Error("Lost again"));
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fillReport();
    act(() => {
      fireEvent.submit(reportForm());
      fireEvent.submit(reportForm());
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Report subject")).toBeDisabled();
    expect(screen.getByLabelText("Concern")).toBeDisabled();
    // Even a programmatic field change must not retarget an uncertain retry.
    fireEvent.change(screen.getByLabelText("Concern"), {
      target: { value: "Changed" },
    });
    await act(async () => rejectFirst(new Error("Response lost")));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i);
    fireEvent.submit(reportForm());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
  });

  it("allows a genuine correction with a fresh key after a definite 400 refusal", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ message: "Correct the subject." }, { status: 400 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Correct the subject.",
      ),
    );
    expect(screen.getByLabelText("Report subject")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Report subject"), {
      target: { value: "Corrected subject" },
    });
    fireEvent.submit(reportForm());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const bodies = fetch.mock.calls.map(
      (call) => JSON.parse(call[1].body) as Payload,
    );
    expect(bodies[1].subject).toBe("Corrected subject");
    expect(bodies[1].requestKey).not.toBe(bodies[0].requestKey);
  });

  it.each([408, 499, 503])(
    "keeps a JSON HTTP %s outcome uncertain",
    async (status) => {
      const fetch = vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ message: "Request failed." }, { status }),
        );
      vi.stubGlobal("fetch", fetch);
      render(<SafeguardingReportForm />);
      fillReport();
      fireEvent.submit(reportForm());
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          /could not confirm/i,
        ),
      );
      expect(screen.getByLabelText("Concern")).toBeDisabled();
      fireEvent.submit(reportForm());
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    },
  );

  it("retains the private POST and inert server-rendered controls", () => {
    const markup = renderToString(<SafeguardingReportForm />);
    const doc = new DOMParser().parseFromString(markup, "text/html");
    expect(doc.querySelector("form")?.getAttribute("method")).toBe("post");
    for (const control of doc.querySelectorAll("input, textarea, button"))
      expect(control.hasAttribute("disabled")).toBe(true);
    expect(markup).toContain("Enable JavaScript");
  });

  it("replays a committed report across in-flight remount without storing its text", async () => {
    const bodies: Payload[] = [];
    const committed = new Set<string>();
    let finishFirst: (response: Response) => void = () => {};
    const firstResponse = new Promise<Response>((resolve) => {
      finishFirst = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const body: Payload = JSON.parse(String(init.body));
        bodies.push(body);
        committed.add(String(body.requestKey));
        return bodies.length === 1
          ? firstResponse
          : Promise.resolve(
              Response.json({ message: "Unavailable." }, { status: 503 }),
            );
      }),
    );
    const first = render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    await waitFor(() => expect(bodies).toHaveLength(1));
    const stored = Object.values(window.sessionStorage).join(" ");
    expect(stored).not.toContain("Fictional concern");
    expect(stored).not.toContain("Fictional details");
    first.unmount();
    render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    await waitFor(() => expect(bodies).toHaveLength(2));
    await act(async () =>
      finishFirst(Response.json({ message: "Unavailable." }, { status: 503 })),
    );
    expect(bodies[1]).toEqual(bodies[0]);
    expect(committed.size).toBe(1);
  });

  it("keeps the original uncertainty and key when a later retry is refused", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Response lost after commit"))
      .mockImplementation(async () =>
        Response.json({ message: "Sign in again." }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i),
    );
    fireEvent.submit(reportForm());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry same report" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i);
    expect(screen.getByLabelText("Concern")).toBeDisabled();
    fireEvent.submit(reportForm());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(fetch.mock.calls[2][1].body).toBe(fetch.mock.calls[0][1].body);
  });

  it("retains the stored key on remount with changed fields so a committed report conflicts instead of duplicating", async () => {
    const bodies: Payload[] = [];
    const committed = new Map<string, string>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body: Payload = JSON.parse(String(init.body));
        bodies.push(body);
        const { requestKey, ...payload } = body;
        const key = String(requestKey);
        const fingerprint = JSON.stringify(payload);
        if (committed.has(key)) {
          expect(committed.get(key)).not.toBe(fingerprint);
          return Response.json(
            { message: "Request conflicts." },
            { status: 409 },
          );
        }
        committed.set(key, fingerprint);
        return Response.json({ message: "Unavailable." }, { status: 503 });
      }),
    );
    const first = render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.submit(reportForm());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i),
    );
    expect(
      window.sessionStorage.getItem("learli:pending-safeguarding-request"),
    ).toBe(bodies[0].requestKey);
    first.unmount();
    render(<SafeguardingReportForm />);
    fillReport();
    fireEvent.change(screen.getByLabelText("Concern"), {
      target: { value: "Changed after remount" },
    });
    fireEvent.submit(reportForm());
    await waitFor(() => expect(bodies).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i),
    );
    expect(bodies[1].requestKey).toBe(bodies[0].requestKey);
    expect(committed.size).toBe(1);
    expect(screen.getByLabelText("Concern")).toBeDisabled();
  });
});

describe("screening request safe failure feedback", () => {
  it.each([
    ["non-JSON", () => new Response("upstream is down", { status: 503 })],
    ["empty object", () => Response.json({}, { status: 503 })],
    ["empty message", () => Response.json({ message: "" }, { status: 503 })],
    [
      "whitespace message",
      () => Response.json({ message: "   " }, { status: 503 }),
    ],
    ["null", () => Response.json(null, { status: 503 })],
    [
      "oversized message",
      () => Response.json({ message: "x".repeat(501) }, { status: 503 }),
    ],
  ] as const)(
    "uses nonempty safe feedback for %s and keeps the retry key",
    async (_name, response) => {
      const fetch = vi.fn().mockImplementation(async () => response());
      vi.stubGlobal("fetch", fetch);
      render(<ScreeningRequest tutorId={pageId} />);
      const form = screen
        .getByRole("button", { name: "Request synthetic screening" })
        .closest("form")!;
      fireEvent.submit(form);
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Screening is unavailable.",
        ),
      );
      fireEvent.submit(form);
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    },
  );

  it("retains a legitimate bounded server refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "Current screening policy is required." },
          { status: 403 },
        ),
      ),
    );
    render(<ScreeningRequest tutorId={pageId} />);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Request synthetic screening" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Current screening policy is required.",
      ),
    );
  });

  it("never renders raw network exceptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private diagnostic exception")),
    );
    render(<ScreeningRequest tutorId={pageId} />);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Request synthetic screening" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Screening is unavailable.",
      ),
    );
    expect(screen.queryByText(/private diagnostic/)).toBeNull();
  });
});

function renderLearner(flow: "create" | "admission", requestId: string) {
  return render(
    flow === "create" ? (
      <CreateLearnerForm
        requestId={requestId}
        modes={["guardian"]}
        timezone="UTC"
        zones={zones}
      />
    ) : (
      <AdmissionForm
        requestId={requestId}
        policyVersion="synthetic-admission-v1"
        policyDigest={"a".repeat(64)}
        zones={zones}
      />
    ),
  );
}
function fillLearner(flow: "create" | "admission", name = "Fictional learner") {
  fireEvent.change(
    screen.getByLabelText(
      flow === "create" ? "Display name" : "Fictional display name",
    ),
    { target: { value: name } },
  );
  fireEvent.change(
    screen.getByLabelText(flow === "create" ? "Level" : "Learner level"),
    { target: { value: "elementary" } },
  );
}
function submitLearner(flow: "create" | "admission") {
  fireEvent.submit(
    screen
      .getByLabelText(
        flow === "create" ? "Display name" : "Fictional display name",
      )
      .closest("form")!,
  );
}

describe.each(["create", "admission"] as const)(
  "%s persisted retry identity",
  (flow) => {
    it("replays one committed record when remounted while the first response is unresolved", async () => {
      const bodies: Payload[] = [];
      const committed = new Set<string>();
      let finishFirst: (response: Response) => void = () => {};
      const firstResponse = new Promise<Response>((resolve) => {
        finishFirst = resolve;
      });
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init: RequestInit) => {
          const body: Payload = JSON.parse(String(init.body));
          bodies.push(body);
          committed.add(`synthetic-actor:${String(body.requestId)}`);
          return bodies.length === 1
            ? firstResponse
            : Promise.resolve(
                Response.json({ message: "Unavailable." }, { status: 503 }),
              );
        }),
      );
      const first = renderLearner(flow, pageId);
      fillLearner(flow);
      submitLearner(flow);
      expect(bodies).toHaveLength(1);
      first.unmount();
      renderLearner(flow, reloadId);
      fillLearner(flow);
      submitLearner(flow);
      await waitFor(() => expect(bodies).toHaveLength(2));
      await act(async () =>
        finishFirst(
          Response.json({ message: "Unavailable." }, { status: 503 }),
        ),
      );
      expect(bodies[1]).toEqual(bodies[0]);
      expect(committed.size).toBe(1);
    });

    it("keeps the retry identity across remount after an invalid success response", async () => {
      const fetch = vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ id: "invalid-result" }),
        );
      vi.stubGlobal("fetch", fetch);
      const first = renderLearner(flow, pageId);
      fillLearner(flow);
      submitLearner(flow);
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).not.toBe(""),
      );
      first.unmount();
      renderLearner(flow, reloadId);
      fillLearner(flow);
      submitLearner(flow);
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    });

    it.each([408, 499])(
      "replays one committed record across remount after JSON HTTP %s",
      async (status) => {
        const bodies: Payload[] = [];
        const committed = new Map<string, string>();
        vi.stubGlobal(
          "fetch",
          vi.fn(async (_url: string, init: RequestInit) => {
            const body: Payload = JSON.parse(String(init.body));
            bodies.push(body);
            const { requestId, ...payload } = body;
            const actorKey = `synthetic-actor:${String(requestId)}`;
            const fingerprint = JSON.stringify(payload);
            if (committed.has(actorKey))
              expect(committed.get(actorKey)).toBe(fingerprint);
            else committed.set(actorKey, fingerprint);
            // Model an actual committed write whose response is lost twice.
            return Response.json({ message: "Request timed out." }, { status });
          }),
        );
        const first = renderLearner(flow, pageId);
        fillLearner(flow);
        submitLearner(flow);
        await waitFor(() =>
          expect(screen.getByRole("alert").textContent).not.toBe(""),
        );
        first.unmount();
        renderLearner(flow, reloadId);
        fillLearner(flow);
        submitLearner(flow);
        await waitFor(() => expect(bodies).toHaveLength(2));
        expect(bodies[1]).toEqual(bodies[0]);
        expect(committed.size).toBe(1);
      },
    );

    it("allows corrected input after a definite 400 refusal and a new page request", async () => {
      const fetch = vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ message: "Check learner fields." }, { status: 400 }),
        );
      vi.stubGlobal("fetch", fetch);
      const first = renderLearner(flow, pageId);
      fillLearner(flow);
      submitLearner(flow);
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).not.toBe(""),
      );
      expect(
        screen.getByLabelText(
          flow === "create" ? "Display name" : "Fictional display name",
        ),
      ).toBeEnabled();
      first.unmount();
      renderLearner(flow, reloadId);
      fillLearner(flow, "Corrected learner");
      submitLearner(flow);
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      const body = JSON.parse(fetch.mock.calls[1][1].body) as Payload;
      expect(body.requestId).toBe(reloadId);
      expect(body.displayName).toBe("Corrected learner");
    });
  },
);
