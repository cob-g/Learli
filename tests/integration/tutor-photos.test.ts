import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
vi.mock("server-only", () => ({}));
const routeRuntime = vi.hoisted(() => ({ value: null as unknown }));
// Public eligibility reads through the same runtime as the handlers.
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: async () => routeRuntime.value,
}));
import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import { subjects, tutorPhotos, tutorProfiles } from "@/lib/db/schema";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
import { listEligibleTutors } from "@/features/tutors/eligibility";
import {
  listTutorApplications,
  reviewTutorPhoto,
} from "@/features/tutors/review";
import { handleTutorPhotoRequest } from "@/features/tutor-photos/handler";
import {
  readOwnTutorPhoto,
  readTutorPhotoForServing,
  removeTutorPhoto,
  submitTutorPhoto,
} from "@/features/tutor-photos/service";
import {
  localPhotoStorage,
  type PhotoStorage,
} from "@/features/tutor-photos/storage";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World;
let storage: PhotoStorage;
let math: string;

const photo = (width = 640, height = 480) =>
  sharp({ create: { width, height, channels: 3, background: "#1f2a6b" } })
    .jpeg()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

async function approvedTutor(name = "Synthetic Photo Tutor") {
  const tutor = await createAccount(world, ["tutor"], name);
  const saved = await handleTutorProfileRequest(
    world.runtime,
    jsonRequest(world, "/api/tutor/profile", {
      method: "PUT",
      cookie: tutor.cookie,
      body: {
        headline: "Synthetic algebra tutor",
        bio: "Fictional introduction for an automated test.",
        teachingBackground: "Fictional background for an automated test.",
        timezone: "Asia/Manila",
        offerings: [{ subjectId: math, levels: ["high_school"] }],
      },
    }),
  );
  expect(saved.status).toBe(200);
  const [profile] = await world.owner.db
    .update(tutorProfiles)
    .set({ reviewStatus: "approved" })
    .where(eq(tutorProfiles.userId, tutor.id))
    .returning({ id: tutorProfiles.id });
  return { ...tutor, profileId: profile.id };
}
async function reviewer(profileId: string) {
  const admin = await createAccount(world, ["admin"]);
  await provisionScreeningAssignment(
    world.owner,
    profileId,
    admin.id,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
  return admin;
}
const review = (
  admin: TestAccount,
  profileId: string,
  photoId: string,
  action: "approve" | "reject",
) =>
  reviewTutorPhoto(
    world.runtime,
    admin.headers,
    profileId,
    { photoId, action },
    storage,
  );
const serve = (account: TestAccount | null, photoId: string) =>
  readTutorPhotoForServing(
    world.runtime,
    account?.headers ?? new Headers(),
    storage,
    photoId,
  );
async function publicPhoto(slugOwner: string) {
  const [profile] = await world.owner.db
    .select({ slug: tutorProfiles.slug })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, slugOwner));
  const tutors = await listEligibleTutors(world.runtime.db);
  return tutors.find((tutor) => tutor.slug === profile.slug)?.photoId;
}
async function rows(profileId: string) {
  return world.owner.db
    .select({
      id: tutorPhotos.id,
      status: tutorPhotos.status,
      key: tutorPhotos.objectKey,
    })
    .from(tutorPhotos)
    .where(eq(tutorPhotos.tutorId, profileId))
    .orderBy(tutorPhotos.createdAt);
}
async function audit(targetUserId: string) {
  const result = await world.owner.pool.query<{ action: string }>(
    "SELECT action FROM audit_events WHERE target_user_id=$1 AND action LIKE 'tutor_photo.%' ORDER BY created_at, action",
    [targetUserId],
  );
  return result.rows.map((row) => row.action);
}
async function upload(
  account: { cookie?: string },
  body: Uint8Array | null,
  options: { origin?: string; length?: string } = {},
) {
  const form = new FormData();
  if (body)
    form.append(
      "photo",
      new Blob([new Uint8Array(body)], { type: "image/jpeg" }),
    );
  const encoded = new Response(form);
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  return handleTutorPhotoRequest(
    world.runtime,
    new Request(`${world.runtime.origin}/api/tutor/photo`, {
      method: "PUT",
      headers: {
        origin: options.origin ?? world.runtime.origin,
        "content-type": encoded.headers.get("content-type")!,
        "content-length": options.length ?? String(bytes.byteLength),
        ...(account.cookie ? { cookie: account.cookie } : {}),
      },
      body: bytes,
    }),
  );
}

beforeAll(async () => {
  world = openWorld();
  routeRuntime.value = world.runtime;
  // The isolated test store under .local/tutor-photos/test.
  storage = localPhotoStorage("test");
});
async function discardStoredPhotos() {
  const stored = await world.owner.pool.query<{ object_key: string }>(
    "SELECT object_key FROM tutor_photos",
  );
  for (const row of stored.rows) await storage.remove(row.object_key);
}
beforeEach(async () => {
  await discardStoredPhotos();
  // Dedicated synthetic test database only; openWorld refuses anything else.
  await world.owner.pool.query(
    'TRUNCATE TABLE "user", rate_limit, verification CASCADE',
  );
  const [subject] = await world.owner.db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  math = subject.id;
});
afterAll(async () => {
  await discardStoredPhotos();
  await closeWorld(world);
});

describe("tutor profile photos", () => {
  it("keeps an upload private to its tutor until an admin approves it", async () => {
    const tutor = await approvedTutor();
    const parent = await createAccount(world, ["parent"]);
    const { pendingId } = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(),
    );
    expect(await readOwnTutorPhoto(world.runtime, tutor.headers)).toEqual({
      pendingId,
      approvedId: null,
      rejected: false,
    });
    const own = await serve(tutor, pendingId);
    expect(own?.shared).toBe(false);
    expect(await sharp(own!.bytes).metadata()).toMatchObject({
      format: "webp",
      width: 512,
      height: 512,
    });
    expect(await serve(null, pendingId)).toBeNull();
    expect(await serve(parent, pendingId)).toBeNull();
    expect(await publicPhoto(tutor.id)).toBeNull();
    expect(await audit(tutor.id)).toEqual(["tutor_photo.submitted"]);
  });

  it("publishes an approved photo and keeps it public while a new one waits", async () => {
    const tutor = await approvedTutor();
    const admin = await reviewer(tutor.profileId);
    const first = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(),
    );
    expect(
      await review(admin, tutor.profileId, first.pendingId, "approve"),
    ).toEqual({ status: "approved" });
    expect(await publicPhoto(tutor.id)).toBe(first.pendingId);
    expect((await serve(null, first.pendingId))?.shared).toBe(true);

    const second = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(800, 800),
    );
    expect(await publicPhoto(tutor.id)).toBe(first.pendingId);
    expect(await serve(null, second.pendingId)).toBeNull();
    // The admin reviewing the tutor may open the waiting photo; others not.
    expect((await serve(admin, second.pendingId))?.shared).toBe(false);
    // The queue's photo filter finds the approved tutor while a photo waits.
    const waiting = await listTutorApplications(
      world.runtime,
      admin.headers,
      "photo",
    );
    expect(waiting.applications.map((a) => [a.id, a.photoPending])).toEqual([
      [tutor.profileId, true],
    ]);
    expect(
      await serve(await createAccount(world, ["admin"]), second.pendingId),
    ).toBeNull();

    await review(admin, tutor.profileId, second.pendingId, "approve");
    expect(
      (await listTutorApplications(world.runtime, admin.headers, "photo"))
        .total,
    ).toBe(0);
    expect(await publicPhoto(tutor.id)).toBe(second.pendingId);
    const [old, current] = await rows(tutor.profileId);
    expect([old.status, current.status]).toEqual(["replaced", "approved"]);
    expect(await storage.get(old.key)).toBeNull();
    expect(await serve(null, old.id)).toBeNull();
    expect(await audit(tutor.id)).toEqual([
      "tutor_photo.submitted",
      "tutor_photo.approved",
      "tutor_photo.submitted",
      "tutor_photo.approved",
    ]);
  });

  it("deletes a rejected photo, tells the tutor and refuses stale or unassigned reviews", async () => {
    const tutor = await approvedTutor();
    const admin = await reviewer(tutor.profileId);
    const { pendingId } = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(),
    );
    const outsider = await createAccount(world, ["admin"]);
    await expect(
      review(outsider, tutor.profileId, pendingId, "approve"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      review(tutor, tutor.profileId, pendingId, "approve"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      review(admin, tutor.profileId, pendingId, "reject"),
    ).resolves.toEqual({ status: "rejected" });
    await expect(
      review(admin, tutor.profileId, pendingId, "approve"),
    ).rejects.toMatchObject({ status: 409 });
    expect(await readOwnTutorPhoto(world.runtime, tutor.headers)).toEqual({
      pendingId: null,
      approvedId: null,
      rejected: true,
    });
    const [row] = await rows(tutor.profileId);
    expect(await storage.get(row.key)).toBeNull();
    expect(await serve(tutor, pendingId)).toBeNull();
    expect(await publicPhoto(tutor.id)).toBeNull();
  });

  it("lets exactly one of two simultaneous reviews decide", async () => {
    const tutor = await approvedTutor();
    const admin = await reviewer(tutor.profileId);
    const { pendingId } = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(),
    );
    const results = await Promise.allSettled([
      review(admin, tutor.profileId, pendingId, "approve"),
      review(admin, tutor.profileId, pendingId, "reject"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected");
    expect(refused?.reason).toMatchObject({ status: 409 });
  });

  it("keeps one waiting photo when uploads race, and removal returns the initials", async () => {
    const tutor = await approvedTutor();
    const admin = await reviewer(tutor.profileId);
    const first = await submitTutorPhoto(
      world.runtime,
      tutor.headers,
      storage,
      await photo(),
    );
    await review(admin, tutor.profileId, first.pendingId, "approve");
    await Promise.all([
      submitTutorPhoto(world.runtime, tutor.headers, storage, await photo()),
      submitTutorPhoto(world.runtime, tutor.headers, storage, await photo()),
    ]);
    expect(
      (await rows(tutor.profileId)).map((row) => row.status).sort(),
    ).toEqual(["approved", "pending", "replaced"]);
    expect(
      await removeTutorPhoto(world.runtime, tutor.headers, storage),
    ).toEqual({ removed: true });
    const after = await rows(tutor.profileId);
    expect(after.filter((row) => row.status === "removed")).toHaveLength(2);
    for (const row of after) expect(await storage.get(row.key)).toBeNull();
    expect(await publicPhoto(tutor.id)).toBeNull();
    expect((await audit(tutor.id)).at(-1)).toBe("tutor_photo.removed");
  });

  it("refuses uploads without a profile, on a suspended profile or for other roles", async () => {
    const noProfile = await createAccount(world, ["tutor"]);
    await expect(
      submitTutorPhoto(
        world.runtime,
        noProfile.headers,
        storage,
        await photo(),
      ),
    ).rejects.toThrow("Save your tutor profile before adding a photo.");
    const parent = await createAccount(world, ["parent"]);
    await expect(
      submitTutorPhoto(world.runtime, parent.headers, storage, await photo()),
    ).rejects.toMatchObject({ status: 403 });
    const suspended = await approvedTutor();
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, suspended.profileId));
    await expect(
      submitTutorPhoto(
        world.runtime,
        suspended.headers,
        storage,
        await photo(),
      ),
    ).rejects.toThrow("This profile can't be edited right now.");
    await expect(
      submitTutorPhoto(world.runtime, suspended.headers, null, await photo()),
    ).rejects.toThrow("Photo uploads aren't available here yet.");
    expect(await rows(suspended.profileId)).toEqual([]);
  });

  it("checks the upload request's origin, size and content", async () => {
    const tutor = await approvedTutor();
    expect(
      (await upload(tutor, await photo(), { origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    expect(
      (await upload(tutor, await photo(), { length: String(6 * 1024 * 1024) }))
        .status,
    ).toBe(413);
    expect((await upload(tutor, null)).status).toBe(400);
    const notAnImage = await upload(
      tutor,
      new TextEncoder().encode("not an image"),
    );
    expect(notAnImage.status).toBe(400);
    expect(await notAnImage.json()).toEqual({
      message: "Choose a JPG, PNG or WebP photo.",
    });
    expect(await rows(tutor.profileId)).toEqual([]);
  });
});
