import { z } from "zod";
import { localDatabaseConfig } from "../db/local-config";
import { isLoopbackOrigin } from "../local-mode";

const optionalValue = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

const httpUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ["http:", "https:"].includes(new URL(value).protocol),
  );
const databaseUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
  );

const serverEnvSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    AUTH_MODE: z.enum(["disabled", "local"]).default("disabled"),
    APP_URL: httpUrl.default("http://localhost:3000"),
    DATABASE_URL: optionalValue(databaseUrl),
    DATABASE_URL_DIRECT: optionalValue(databaseUrl),
    BETTER_AUTH_SECRET: optionalValue(z.string().min(32)),
    BETTER_AUTH_URL: optionalValue(httpUrl),
    RESEND_API_KEY: optionalValue(z.string().min(1)),
    EMAIL_FROM: optionalValue(z.email()),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === "local") {
      if (!["development", "test"].includes(env.APP_ENV))
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_MODE"],
          message: "Local mode only",
        });
      if (!isLoopbackOrigin(env.APP_URL))
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message: "Loopback origin required",
        });
      if (env.BETTER_AUTH_URL && env.BETTER_AUTH_URL !== env.APP_URL)
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_URL"],
          message: "Origins must match",
        });
      if (!env.BETTER_AUTH_SECRET)
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "Required for local auth",
        });
      try {
        if (
          localDatabaseConfig(env.DATABASE_URL, env.APP_ENV === "test").user !==
          "learli_app"
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Dedicated local database required",
        });
      }
    }

    if (["staging", "production"].includes(env.APP_ENV)) {
      for (const field of ["APP_URL", "BETTER_AUTH_URL"] as const) {
        if (
          env[field] &&
          URL.canParse(env[field]) &&
          new URL(env[field]).protocol !== "https:"
        ) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "HTTPS required",
          });
        }
      }
    }
  });

/** Never forward Zod's input values or raw issues into logs or HTTP responses. */
export function parseServerEnv(source: Record<string, string | undefined>) {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(
      `Invalid server configuration: ${fields.join(", ")}. Values omitted.`,
    );
  }
  return parsed.data;
}
