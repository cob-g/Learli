// Introspection only: this pool never connects during schema generation.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { authOptions } from "../src/lib/auth-options";
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  ...authOptions,
  plugins: [twoFactor()],
  database: drizzleAdapter(
    drizzle(
      new Pool({ host: "127.0.0.1", port: 55432, database: "learli_dev" }),
    ),
    { provider: "pg" },
  ),
});
