import { defineConfig } from "drizzle-kit";

// Generation is offline. Use the guarded db:migrate script to apply reviewed SQL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: false,
});
