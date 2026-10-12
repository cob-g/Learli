// Node-only domain service, shared by routes and isolated real PostgreSQL tests.
import { and, eq, gt, lt, lte, sql, inArray, ne } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { pgErrorCode } from "@/lib/db/errors";
import {
  bookings,
  bookingEvents,
  subjects,
  tutorProfiles,
  tutorAvailability,
  session,
  user,
  type LearnerLevel,
} from "@/lib/db/schema";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { isLoopbackOrigin, syntheticEmail } from "@/lib/local-mode";
import { RuleError } from "@/lib/rule-error";
import {
  readAuthorizedLearner,
  listMyLearners,
} from "@/features/learners/service";
import {
  findEligibleTutor,
  filterTutors,
  listEligibleTutors,
} from "@/features/tutors/eligibility";
import { readTutorTimeOffIntervals } from "@/features/time-off/repository";
import { demoBookingPolicy } from "./demo-policy";
import { demoCandidateIntervals, demoCandidateRange } from "./demo-schedule";
import { bookingChoiceInput, createDemoBookingInput } from "./input";
import { formatLessonTime } from "./format-time";
import { bookingFingerprint } from "./request-fingerprint";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const unavailable = () =>
  new RuleError(
    409,
    "That time is no longer available. Please choose another.",
  );

export async function requireBookingActor(
  runtime: AuthRuntime,
  headers: Headers,
) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const identity = await requireIdentity(runtime, headers);
  const current = await runtime.auth.api.getSession({ headers });
  if (!current || !syntheticEmail(current.user.email))
    throw new AccessError(403);
  if (!identity.roles.some((role) => role === "parent" || role === "student"))
    throw new AccessError(403);
  return {
    userId: identity.userId,
    sessionId: current.session.id,
    timezone: current.user.timezone,
  };
}

/** Tutor/actor locks serialize reservations; post-wait statements use fresh snapshots. */
export async function reservationTransaction<T>(
  runtime: AuthRuntime,
  run: (tx: Transaction) => Promise<T>,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await runtime.db.transaction(run, {
        isolationLevel: "read committed",
      });
    } catch (error) {
      const code = pgErrorCode(error);
      if (["40001", "40P01", "23505"].includes(code ?? "") && attempt < 3)
        continue;
      if (code === "23P01") throw unavailable();
      throw error;
    }
  }
  throw new Error("Transaction retry limit reached.");
}

export async function databaseNow(tx: Transaction) {
  // transaction_timestamp freezes before a waited lock; the current clock must not.
  const result = await tx.execute<{ milliseconds: number }>(
    sql`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS milliseconds`,
  );
  // Raw execute timestamp columns are strings in the installed Drizzle adapter.
  return new Date(result.rows[0].milliseconds);
}

async function lockTutor(tx: Transaction, slug: string) {
  const [profile] = await tx
    .select({ id: tutorProfiles.id, timezone: tutorProfiles.timezone })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.slug, slug))
    .for("update");
  if (!profile)
    throw new RuleError(409, "This tutor isn't taking bookings right now.");
  return profile;
}

/** Caller holds the tutor row before every reservation state change. */
export async function expireTutorReservations(
  tx: Transaction,
  tutorId: string,
  now: Date,
) {
  const expired = await tx
    .update(bookings)
    .set({ state: "demo_expired" })
    .where(
      and(
        eq(bookings.tutorId, tutorId),
        inArray(bookings.state, ["demo_reserved", "demo_confirmed"]),
        lte(bookings.expiresAt, now),
      ),
    )
    .returning({ id: bookings.id });
  if (expired.length)
    await tx.insert(bookingEvents).values(
      expired.map((row) => ({
        bookingId: row.id,
        event: "demo_expired" as const,
        createdAt: now,
      })),
    );
}

export async function authorizedLearner(
  tx: Transaction,
  actor: Awaited<ReturnType<typeof requireBookingActor>>,
  choice: { learnerId: string; tutorSlug: string; subjectSlug: string },
) {
  // Serialize this actor's technical create limit across different tutors. This
  // uses the existing user UPDATE grant; role/access/link writes remain denied.
  // NO KEY UPDATE permits audit foreign-key KEY SHARE checks by this legitimate
  // multi-role actor while still serializing their cross-tutor quota.
  await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actor.userId))
    .for("no key update");
  const [currentSession] = await tx
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        gt(session.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .for("share");
  if (!currentSession) throw new AccessError(401);
  await readAuthorizedLearner(tx, actor.userId, choice.learnerId, true);
  // A learner/session lock can itself wait. Recheck after all waits, with a new
  // READ COMMITTED statement; earlier predicates are not authorization evidence.
  const [activeSession] = await tx
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        gt(session.expiresAt, sql`clock_timestamp()`),
      ),
    );
  if (!activeSession) throw new AccessError(401);
  return readAuthorizedLearner(tx, actor.userId, choice.learnerId);
}

export async function eligibleContext(
  tx: Transaction,
  choice: { tutorSlug: string; subjectSlug: string },
  level: LearnerLevel,
) {
  const [subject] = await tx
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, choice.subjectSlug))
    .for("share");
  if (!subject) throw unavailable();
  const tutor = await findEligibleTutor(tx, choice.tutorSlug);
  if (
    !tutor ||
    !filterTutors([tutor], {
      subject: choice.subjectSlug,
      level,
    }).length
  )
    throw new RuleError(
      409,
      "This tutor isn't taking bookings for that subject and level right now.",
    );
  return { tutor, subject };
}

export async function candidateIntervals(
  tx: Transaction,
  tutor: { id: string; timezone: string },
  now: Date,
  excludingBookingId?: string,
) {
  const { from, to, busyTo } = demoCandidateRange(now);
  const windows = await tx
    .select({
      isoWeekday: tutorAvailability.isoWeekday,
      startMinute: tutorAvailability.startMinute,
      endMinute: tutorAvailability.endMinute,
    })
    .from(tutorAvailability)
    .where(eq(tutorAvailability.tutorId, tutor.id));
  const occupied = await tx
    .select({ start: bookings.startAtUtc, end: bookings.endAtUtc })
    .from(bookings)
    .where(
      and(
        eq(bookings.tutorId, tutor.id),
        excludingBookingId ? ne(bookings.id, excludingBookingId) : undefined,
        inArray(bookings.state, ["demo_reserved", "demo_confirmed"]),
        gt(bookings.expiresAt, now),
        lt(bookings.startAtUtc, busyTo),
        gt(bookings.endAtUtc, from),
      ),
    );
  const exceptions = await readTutorTimeOffIntervals(
    tx,
    tutor.id,
    from,
    busyTo,
  );
  return demoCandidateIntervals({
    timezone: tutor.timezone,
    windows,
    from,
    to,
    busy: [...occupied, ...exceptions],
  });
}

export async function loadDemoBookingOptions(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const actor = await requireBookingActor(runtime, headers);
  const [learners, tutors] = await Promise.all([
    listMyLearners(runtime, headers),
    listEligibleTutors(runtime.db),
  ]);
  return { learners, tutors, timezone: actor.timezone };
}
export type DemoBookingOptions = Awaited<
  ReturnType<typeof loadDemoBookingOptions>
>;

export async function readDemoCandidates(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const actor = await requireBookingActor(runtime, headers);
  const values = bookingChoiceInput.parse(input);
  return reservationTransaction(runtime, async (tx) => {
    const profile = await lockTutor(tx, values.tutorSlug);
    const learner = await authorizedLearner(tx, actor, values);
    await eligibleContext(tx, values, learner.level);
    // Subject locking may wait after the first ownership check. Authorization
    // must still be current before expiry writes or private candidate output.
    await authorizedLearner(tx, actor, values);
    const now = await databaseNow(tx);
    await expireTutorReservations(tx, profile.id, now);
    return {
      times: (await candidateIntervals(tx, profile, now)).map((interval) => ({
        ...formatLessonTime(
          interval.start,
          interval.end,
          values.displayTimezone,
        ),
        tutorTime: formatLessonTime(
          interval.start,
          interval.end,
          profile.timezone,
        ),
      })),
      durationMinutes: demoBookingPolicy.durationMinutes,
    };
  });
}
export type DemoCandidates = Awaited<ReturnType<typeof readDemoCandidates>>;

function reservationResult(
  row: typeof bookings.$inferSelect,
  tutorZone: string,
) {
  return {
    id: row.id,
    state: row.state,
    time: formatLessonTime(row.startAtUtc, row.endAtUtc, row.displayTimezone),
    tutorTime: formatLessonTime(row.startAtUtc, row.endAtUtc, tutorZone),
    expires: formatLessonTime(
      row.expiresAt,
      row.expiresAt,
      row.displayTimezone,
    ),
  };
}
export type DemoReservation = ReturnType<typeof reservationResult>;

export async function createDemoReservation(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
): Promise<DemoReservation> {
  const actor = await requireBookingActor(runtime, headers);
  const values = createDemoBookingInput.parse(input);
  const fingerprint = bookingFingerprint(values);
  return reservationTransaction(runtime, async (tx) => {
    // Shared protocol: tutor row first, then reservation/exception reads and writes.
    const profile = await lockTutor(tx, values.tutorSlug);
    const learner = await authorizedLearner(tx, actor, values);
    let now = await databaseNow(tx);
    await expireTutorReservations(tx, profile.id, now);
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.bookedByUserId, actor.userId),
          eq(bookings.idempotencyKey, values.idempotencyKey),
        ),
      );
    if (existing) {
      if (existing.requestFingerprint !== fingerprint)
        throw new RuleError(
          409,
          "This request changed. Choose a time and start a new simulated reservation.",
        );
      return reservationResult(existing, profile.timezone);
    }
    const { subject } = await eligibleContext(tx, values, learner.level);
    // Subject eligibility can wait too; deny revocations committed before the
    // final authorization point. In-flight requests may finish after that point.
    await authorizedLearner(tx, actor, values);
    now = await databaseNow(tx);
    // A subject wait may outlast another reservation's deadline. Materialize
    // that expiry before the exclusion constraint evaluates a new insertion.
    await expireTutorReservations(tx, profile.id, now);
    const start = new Date(values.startAtUtc),
      end = new Date(values.endAtUtc);
    const candidates = await candidateIntervals(tx, profile, now);
    if (
      !candidates.some(
        (time) =>
          time.start.getTime() === start.getTime() &&
          time.end.getTime() === end.getTime(),
      )
    )
      throw unavailable();
    // Bounds resource use in this synthetic demo; successful retries consume no quota.
    const recent = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.bookedByUserId, actor.userId),
          gt(bookings.createdAt, new Date(now.getTime() - 60_000)),
        ),
      );
    if (recent[0].count >= 20)
      throw new RuleError(
        409,
        "Too many simulated reservations. Wait a minute before starting another.",
      );
    const [created] = await tx
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: profile.id,
        learnerId: values.learnerId,
        bookedByUserId: actor.userId,
        subjectId: subject.id,
        startAtUtc: start,
        endAtUtc: end,
        displayTimezone: values.displayTimezone,
        idempotencyKey: values.idempotencyKey,
        requestFingerprint: fingerprint,
        state: "demo_reserved",
        createdAt: now,
        expiresAt: new Date(
          now.getTime() + demoBookingPolicy.ttlMinutes * 60_000,
        ),
      })
      .returning();
    await tx.insert(bookingEvents).values({
      bookingId: created.id,
      event: "demo_reserved",
      createdAt: now,
    });
    return reservationResult(created, profile.timezone);
  });
}
