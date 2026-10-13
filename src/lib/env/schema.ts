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
    AUTH_MODE: z
      .enum(["disabled", "local", "hosted-synthetic"])
      .default("disabled"),
    DATABASE_MODE: z.enum(["local", "neon-development"]).default("local"),
    NEON_DEVELOPMENT_CONFIG_FILE: optionalValue(z.string().min(1)),
    HOSTED_AUTH_CONFIG_FILE: optionalValue(z.string().min(1)),
    HOSTED_INGRESS_SECRET: optionalValue(z.string().min(32).max(512)),
    APP_URL: httpUrl.default("http://localhost:3000"),
    DATABASE_URL: optionalValue(databaseUrl),
    DATABASE_URL_DIRECT: optionalValue(databaseUrl),
    BETTER_AUTH_SECRET: optionalValue(z.string().min(32)),
    BETTER_AUTH_URL: optionalValue(httpUrl),
    RESEND_API_KEY: optionalValue(z.string().min(1)),
    EMAIL_FROM: optionalValue(z.email()),
  })
  .superRefine((env, ctx) => {
    if (env.DATABASE_MODE === "neon-development") {
      if (
        env.APP_ENV !== "development" ||
        env.AUTH_MODE !== "local" ||
        !env.NEON_DEVELOPMENT_CONFIG_FILE ||
        !isLoopbackOrigin(env.APP_URL) ||
        env.DATABASE_URL ||
        env.DATABASE_URL_DIRECT ||
        env.HOSTED_AUTH_CONFIG_FILE ||
        env.HOSTED_INGRESS_SECRET ||
        env.RESEND_API_KEY ||
        env.EMAIL_FROM
      )
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_MODE"],
          message: "Dedicated local Neon development configuration required",
        });
    } else if (env.NEON_DEVELOPMENT_CONFIG_FILE) {
      ctx.addIssue({
        code: "custom",
        path: ["NEON_DEVELOPMENT_CONFIG_FILE"],
        message: "Explicit development mode required",
      });
    }
    if (env.AUTH_MODE === "hosted-synthetic") {
      if (env.APP_ENV !== "staging")
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_MODE"],
          message: "Staging only",
        });
      if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length > 512)
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "Required",
        });
      if (
        !env.HOSTED_INGRESS_SECRET ||
        env.HOSTED_INGRESS_SECRET === env.BETTER_AUTH_SECRET
      )
        ctx.addIssue({
          code: "custom",
          path: ["HOSTED_INGRESS_SECRET"],
          message: "Independent secret required",
        });
      if (!env.HOSTED_AUTH_CONFIG_FILE)
        ctx.addIssue({
          code: "custom",
          path: ["HOSTED_AUTH_CONFIG_FILE"],
          message: "Required",
        });
      if (env.BETTER_AUTH_URL !== env.APP_URL)
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_URL"],
          message: "Origins must match",
        });
      for (const field of ["DATABASE_URL", "DATABASE_URL_DIRECT"] as const)
        if (env[field])
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Local fallback refused",
          });
    }
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
      if (env.DATABASE_MODE === "local")
        try {
          if (
            localDatabaseConfig(env.DATABASE_URL, env.APP_ENV === "test")
              .user !== "learli_app"
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
