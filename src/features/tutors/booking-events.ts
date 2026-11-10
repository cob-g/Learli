import { getDomainAuthRuntime } from "@/lib/auth";
import {
  privateHeaders,
  privateJson,
  sameDomainOrigin,
} from "@/lib/auth-handler";
import { AccessError, requireRole } from "@/lib/permissions/access";
import { readBookingUpdateAudience } from "@/features/bookings/update-audience";
import { subscribeStudentBookings } from "@/features/tutors/booking-notification-server";
import {
  assertPrivateWorkflowUnchanged,
  getPrivateWorkflow,
} from "@/features/private-workflow/runtime";

export async function bookingEvents(
  request: Request,
  audience: "student" | "parent",
) {
  const auth = await getDomainAuthRuntime();
  if (!auth)
    return privateJson({ message: "Booking updates are unavailable." }, 503);
  if (
    !sameDomainOrigin(request, auth) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.has("origin") &&
      request.headers.get("origin") !== auth.origin)
  )
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (new URL(request.url).search)
    return privateJson({ message: "Invalid request." }, 400);
  try {
    const identity = await requireRole(auth, request.headers, audience);
    const packet = getPrivateWorkflow(auth);
    const learnerIds = await readBookingUpdateAudience(
      auth,
      identity,
      audience,
      packet,
    );
    if (!learnerIds.length) throw new AccessError(404);

    async function recheckAudience() {
      const ids = await readBookingUpdateAudience(
        auth!,
        identity,
        audience,
        packet,
      );
      if (
        ids.length !== learnerIds.length ||
        ids.some((id, index) => id !== learnerIds[index])
      )
        throw new AccessError(403);
      assertPrivateWorkflowUnchanged(auth!, packet);
    }

    const encoder = new TextEncoder();
    let stop = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let checking = false;
        let dirty = false;
        let unsubscribe: (() => void) | undefined;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let lifetime: ReturnType<typeof setTimeout> | undefined;

        stop = () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          if (lifetime) clearTimeout(lifetime);
          request.signal.removeEventListener("abort", stop);
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            /* Consumer already closed. */
          }
        };
        async function signal() {
          if (closed) return;
          if (checking) {
            dirty = true;
            return;
          }
          checking = true;
          try {
            await recheckAudience();
            if (!closed)
              controller.enqueue(encoder.encode("event: changed\ndata: 1\n\n"));
          } catch {
            stop();
          } finally {
            checking = false;
            if (dirty && !closed) {
              dirty = false;
              void signal();
            }
          }
        }
        request.signal.addEventListener("abort", stop, { once: true });
        if (request.signal.aborted) {
          stop();
          return;
        }
        void subscribeStudentBookings(
          auth!,
          identity.userId,
          learnerIds,
          () => void signal(),
          stop,
          audience,
        )
          .then((release) => {
            if (closed) {
              release();
              return;
            }
            unsubscribe = release;
            // LISTEN has committed before this refresh signal, closing the
            // initial snapshot/subscribe gap and recovering missed events.
            void signal();
            heartbeat = setInterval(() => {
              // Periodic authorization refresh also closes revoked sessions.
              void recheckAudience()
                .then(() => {
                  if (!closed)
                    controller.enqueue(encoder.encode(": keepalive\n\n"));
                })
                .catch(stop);
            }, 25_000);
            lifetime = setTimeout(stop, 240_000);
          })
          .catch(stop);
      },
      cancel() {
        stop();
      },
    });
    return new Response(body, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return privateJson(
      { message: "Booking updates are unavailable." },
      error instanceof AccessError ? error.status : 503,
    );
  }
}
