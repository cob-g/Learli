import "server-only";
import type { Notification } from "pg";
import type { AuthRuntime } from "@/lib/auth-factory";

type ListenerClient = {
  query(sql: string): Promise<unknown>;
  on(event: "notification", listener: (message: Notification) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  removeListener(
    event: "notification",
    listener: (message: Notification) => void,
  ): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
  release(error?: boolean): void;
};
type Channel = "learli_tutor_booking" | "learli_student_booking";
type Subscriber = {
  userId: string;
  channel: Channel;
  recipientIds: ReadonlySet<string>;
  change: () => void;
  disconnected: () => void;
};
type State = {
  subscribers: Set<Subscriber>;
  client?: ListenerClient;
  connecting?: Promise<void>;
  failed: boolean;
  onMessage: (message: Notification) => void;
  onError: () => void;
};

// Separate server bundles share one verified listener per instance/runtime pool.
const globalState = globalThis as typeof globalThis & {
  learliBookingListeners?: WeakMap<object, State>;
};
const states = (globalState.learliBookingListeners ??= new WeakMap());

function close(state: State, pool: object, failed: boolean) {
  if (state.failed) return;
  state.failed = true;
  states.delete(pool);
  const client = state.client;
  state.client = undefined;
  if (client) {
    const ignoreError = () => {};
    client.on("error", ignoreError);
    client.removeListener("notification", state.onMessage);
    client.removeListener("error", state.onError);
    const release = (destroy: boolean) => {
      try {
        client.release(destroy);
      } catch {
        /* Already released. */
      } finally {
        client.removeListener("error", ignoreError);
      }
    };
    if (failed) release(true);
    else
      void client
        .query("UNLISTEN learli_tutor_booking; UNLISTEN learli_student_booking")
        .then(
          () => release(false),
          () => release(true),
        );
  }
  if (failed)
    for (const subscriber of state.subscribers) subscriber.disconnected();
  state.subscribers.clear();
}

async function subscribe(
  runtime: AuthRuntime,
  userId: string,
  channel: Channel,
  recipientIds: readonly string[],
  change: () => void,
  disconnected: () => void,
  audience: "student" | "parent" | "tutor",
): Promise<() => void> {
  if (!recipientIds.length) throw new Error("Booking updates unavailable");
  const pool = runtime.pool;
  let state = states.get(pool);
  if (!state) {
    state = {
      subscribers: new Set(),
      failed: false,
      onMessage: (message) => {
        for (const subscriber of state!.subscribers)
          if (
            subscriber.channel === message.channel &&
            message.payload &&
            subscriber.recipientIds.has(message.payload)
          )
            subscriber.change();
      },
      onError: () => close(state!, pool, true),
    };
    states.set(pool, state);
  }
  if (
    state.subscribers.size >= 1000 ||
    [...state.subscribers].filter((s) => s.userId === userId).length >= 8
  )
    throw new Error("Booking updates unavailable");
  const subscriber: Subscriber = {
    userId,
    channel,
    recipientIds: new Set(recipientIds),
    change,
    disconnected,
  };
  state.subscribers.add(subscriber);
  const current = state;
  if (!current.connecting) {
    current.connecting = (async () => {
      const client = (await pool.connect()) as ListenerClient;
      if (current.failed || current.subscribers.size === 0) {
        client.release();
        throw new Error("Booking updates unavailable");
      }
      current.client = client;
      client.on("notification", current.onMessage);
      client.on("error", current.onError);
      await client.query("LISTEN learli_tutor_booking");
      await client.query("LISTEN learli_student_booking");
      const readiness = (await client.query(
        "SELECT count(*)::int AS count FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='bookings' AND t.tgname IN ('notify_tutor_booking_insert','notify_tutor_booking_update') AND t.tgenabled IN ('O','A')",
      )) as { rows: { count: number }[] };
      if (readiness.rows[0]?.count !== 2)
        throw new Error("Booking updates unavailable");
    })().catch(() => {
      close(current, pool, true);
      throw new Error("Booking updates unavailable");
    });
  }
  try {
    await current.connecting;
    if (current.failed || !current.client)
      throw new Error("Booking updates unavailable");
    if (channel === "learli_student_booking") {
      const ready = (await current.client.query(
        "SELECT count(*)::int AS count FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND ((c.relname='bookings' AND t.tgname IN ('notify_student_booking_insert','notify_student_booking_update')) OR (c.relname='booking_meeting_links' AND t.tgname IN ('notify_student_meeting_insert','notify_student_meeting_update'))) AND t.tgenabled IN ('O','A')",
      )) as { rows: { count: number }[] };
      if (ready.rows[0]?.count !== 4)
        throw new Error("Booking updates unavailable");
      if (audience === "parent") {
        const parentReady = (await current.client.query(
          "SELECT count(*)::int AS count FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND ((c.relname='bookings' AND t.tgname IN ('notify_parent_booking_insert','notify_parent_booking_update')) OR (c.relname='booking_meeting_links' AND t.tgname IN ('notify_parent_meeting_insert','notify_parent_meeting_update'))) AND t.tgenabled IN ('O','A')",
        )) as { rows: { count: number }[] };
        if (parentReady.rows[0]?.count !== 4)
          throw new Error("Booking updates unavailable");
      }
    }
  } catch {
    current.subscribers.delete(subscriber);
    if (!current.subscribers.size) close(current, pool, false);
    throw new Error("Booking updates unavailable");
  }
  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    current.subscribers.delete(subscriber);
    if (!current.subscribers.size) close(current, pool, false);
  };
}

export function subscribeTutorBookings(
  runtime: AuthRuntime,
  userId: string,
  tutorId: string,
  change: () => void,
  disconnected: () => void,
) {
  return subscribe(
    runtime,
    userId,
    "learli_tutor_booking",
    [tutorId],
    change,
    disconnected,
    "tutor",
  );
}
export function subscribeStudentBookings(
  runtime: AuthRuntime,
  userId: string,
  learnerIds: readonly string[],
  change: () => void,
  disconnected: () => void,
  audience: "student" | "parent" = "student",
) {
  return subscribe(
    runtime,
    userId,
    "learli_student_booking",
    learnerIds,
    change,
    disconnected,
    audience,
  );
}
