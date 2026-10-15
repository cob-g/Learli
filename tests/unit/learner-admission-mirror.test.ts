import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareAdmissionMirror } from "../support/learner-admission-mirror";

const directories: string[] = [];
const context = "src/features/learner-admission/context.ts";
const retired = "src/features/tutors/workspace-navigation.tsx";
const retained = "src/app/page.tsx";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  const repo = await mkdtemp(path.join(tmpdir(), "learli-admission-mirror-"));
  directories.push(repo);
  const files = {
    [context]: 'export const admission = { authority: "disabled" };\n',
    [retired]: "export const retired = true;\n",
    [retained]: "export const page = true;\n",
    "public/brand.txt": "fictional brand fixture\n",
    "package.json": '{"private":true}\n',
    "package-lock.json": '{"lockfileVersion":3}\n',
    "tsconfig.json": "{}\n",
    "next.config.ts": "export default {};\n",
    "postcss.config.mjs": "export default {};\n",
    "node_modules/fixture.txt": "disposable module fixture\n",
  };
  for (const [relative, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(repo, relative)), { recursive: true });
    await writeFile(path.join(repo, relative), value);
  }
  return { repo, files };
}

describe("learner admission source mirror refresh", () => {
  it("removes retired source on reuse while preserving canonical files, private state and caches", async () => {
    const { repo, files } = await fixture();
    const policyId = randomUUID();
    const mirror = await prepareAdmissionMirror(repo, policyId);
    expect(await readFile(path.join(mirror, retired), "utf8")).toBe(
      files[retired],
    );
    const sentinels = [
      ".local/learner-admission/mail/message.txt",
      ".local/learner-admission/fixture.json",
      ".local/learner-admission/isolated-mirror/.next/cache/fixture.txt",
    ];
    for (const sentinel of sentinels) {
      await mkdir(path.dirname(path.join(repo, sentinel)), { recursive: true });
      await writeFile(path.join(repo, sentinel), "private fixture sentinel\n");
    }
    await rm(path.join(repo, retired));

    expect(await prepareAdmissionMirror(repo, policyId)).toBe(mirror);

    await expect(readFile(path.join(mirror, retired))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const sourceEntries = await readdir(path.join(mirror, "src"), {
      recursive: true,
      withFileTypes: true,
    });
    expect(
      sourceEntries
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path.relative(mirror, path.join(entry.parentPath, entry.name)),
        )
        .sort(),
    ).toEqual([retained, context].sort());
    const replacement = await readFile(path.join(mirror, context), "utf8");
    expect(replacement).toContain(`"policyId":"${policyId}"`);
    expect(replacement).toContain("validateAdmissionCapability(");
    expect(await readFile(path.join(mirror, retained), "utf8")).toBe(
      files[retained],
    );
    const provenance = JSON.parse(
      await readFile(
        path.join(repo, ".local/learner-admission/mirror-source.json"),
        "utf8",
      ),
    );
    expect(provenance).toEqual({
      root: mirror,
      before: {
        [context]: hash(files[context]),
        [retained]: hash(files[retained]),
      },
      after: {
        [context]: hash(replacement),
        [retained]: hash(files[retained]),
      },
      overrides: [context],
      policyId,
    });
    for (const [relative, value] of Object.entries(files)) {
      if (relative !== retired)
        expect(await readFile(path.join(repo, relative), "utf8")).toBe(value);
    }
    await expect(readFile(path.join(repo, retired))).rejects.toMatchObject({
      code: "ENOENT",
    });
    for (const sentinel of sentinels)
      expect(await readFile(path.join(repo, sentinel), "utf8")).toBe(
        "private fixture sentinel\n",
      );
    expect(await readFile(path.join(mirror, "public/brand.txt"), "utf8")).toBe(
      files["public/brand.txt"],
    );
    expect(await readlink(path.join(mirror, "node_modules"))).toBe(
      path.join(repo, "node_modules"),
    );
  });

  it.each([
    ".local",
    ".local/learner-admission",
    ".local/learner-admission/isolated-mirror",
  ])(
    "refuses a linked generated parent at %s before touching its target",
    async (relative) => {
      const { repo, files } = await fixture();
      const foreign = await mkdtemp(
        path.join(tmpdir(), "learli-mirror-foreign-"),
      );
      directories.push(foreign);
      await mkdir(path.join(foreign, "src"));
      await writeFile(
        path.join(foreign, "src/sentinel.txt"),
        "foreign source\n",
      );
      await mkdir(path.dirname(path.join(repo, relative)), { recursive: true });
      await symlink(foreign, path.join(repo, relative), "dir");

      await expect(prepareAdmissionMirror(repo, randomUUID())).rejects.toThrow(
        "Mirror requires checkout-owned generated directories.",
      );

      expect(await readdir(foreign)).toEqual(["src"]);
      expect(await readdir(path.join(foreign, "src"))).toEqual([
        "sentinel.txt",
      ]);
      expect(
        await readFile(path.join(foreign, "src/sentinel.txt"), "utf8"),
      ).toBe("foreign source\n");
      for (const [file, value] of Object.entries(files))
        expect(await readFile(path.join(repo, file), "utf8")).toBe(value);
    },
  );

  it("unlinks a linked generated src without deleting its canonical target", async () => {
    const { repo, files } = await fixture();
    const mirror = path.join(repo, ".local/learner-admission/isolated-mirror");
    await mkdir(mirror, { recursive: true });
    await symlink(path.join(repo, "src"), path.join(mirror, "src"), "dir");

    await prepareAdmissionMirror(repo, randomUUID());

    for (const [file, value] of Object.entries(files))
      expect(await readFile(path.join(repo, file), "utf8")).toBe(value);
    expect(await readFile(path.join(mirror, retired), "utf8")).toBe(
      files[retired],
    );
    await expect(readlink(path.join(mirror, "src"))).rejects.toMatchObject({
      code: "EINVAL",
    });
  });
});
