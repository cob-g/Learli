import {
  assertOwnedReadinessDatabase,
  screeningMirrorOrigin,
} from "./readiness-placement";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
/** Test-owned private evidence only. No private needles are written to summaries. */
export async function inspectW6BrowserPrivacy(
  fixture: {
    origin: string;
    sourceRoot: string;
    password: string;
    parent: {
      id: string;
      email: string;
      learnerId: string;
      learnerName: string;
    };
    college: {
      id: string;
      email: string;
      learnerId: string;
      learnerName: string;
    };
    reviewer: { id: string; email: string };
    tutor: { id: string; email: string };
  },
  transientSecret: string,
) {
  assertOwnedReadinessDatabase(process.cwd());
  if (
    fixture.sourceRoot !== process.cwd() ||
    fixture.origin !== screeningMirrorOrigin
  )
    throw new Error("Own W6 private inspection required.");
  const base = ".local/booking-workflows",
    needles = [
      ...(["parent", "college"] as const).flatMap((k) => [
        fixture[k].learnerId,
        fixture[k].learnerName,
      ]),
      ...(["parent", "college", "reviewer", "tutor"] as const).flatMap((k) => [
        fixture[k].email,
        fixture[k].id,
      ]),
      fixture.password,
      transientSecret,
      ...["BETTER_AUTH_SECRET", "DATABASE_URL", "DATABASE_URL_DIRECT"].flatMap(
        (k) => (process.env[k] ? [process.env[k]!] : []),
      ),
    ];
  mkdirSync(`${base}/public-html`, { recursive: true, mode: 0o700 });
  const checks: Record<string, unknown>[] = [];
  for (const origin of [process.env.APP_URL!, fixture.origin])
    for (const route of ["/", "/sign-in", "/tutors", "/get-matched"]) {
      const r = await fetch(origin + route),
        body = await r.text(),
        hits = needles.filter((v) => v && body.includes(v)).length,
        file = `${base}/public-html/${origin === fixture.origin ? "mirror" : "default"}-${route.replaceAll("/", "_")}.html`;
      writeFileSync(file, body, { mode: 0o600 });
      checks.push({
        surface: "public/authHTML",
        origin,
        route,
        status: r.status,
        privateNeedleHits: hits,
        sha256: createHash("sha256").update(body).digest("hex"),
      });
      if (!r.ok || hits)
        throw new Error(
          "Public/auth HTML private inspection failed; evidence retained privately.",
        );
    }
  for (const route of [
    `/api/bookings/${randomUUID()}/meeting-link`,
    `/api/bookings/${randomUUID()}/workflow/complete`,
  ]) {
    const post = route.endsWith("/complete"),
      r = await fetch(fixture.origin + route, {
        method: post ? "POST" : "GET",
        ...(post
          ? {
              headers: {
                origin: fixture.origin,
                "content-type": "application/json",
              },
              body: "{}",
            }
          : {}),
      }),
      body = await r.text(),
      hits = needles.filter((v) => v && body.includes(v)).length;
    checks.push({
      surface: "anonymousAPIerror",
      route: route.replace(/[a-f0-9-]{36}/, "[opaque]"),
      status: r.status,
      privateNeedleHits: hits,
    });
    if (r.ok || hits)
      throw new Error("Anonymous API denial/private inspection failed.");
  }
  function files(root: string): string[] {
    return readdirSync(root).flatMap((name) => {
      const p = root + "/" + name;
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  }
  for (const root of [
    ".next/static",
    ".local/screening-safeguarding/mirror/.next/static",
  ]) {
    const paths = files(root),
      hits = paths.filter((p) =>
        needles.some((v) => v && readFileSync(p).includes(Buffer.from(v))),
      ).length;
    checks.push({
      surface: "clientAssets",
      root,
      files: paths.length,
      privateNeedleHitFiles: hits,
    });
    if (hits)
      throw new Error("Emitted client asset private inspection failed.");
  }
  writeFileSync(
    `${base}/privacy-inspection.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        limitation:
          "Selected exact current fixture/secret needles in live public/authHTML, anonymous API errors and emitted client assets; not a universal information-flow proof. Browser tests separately exercise authenticated document lifetime. No private needles in summary.",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}
