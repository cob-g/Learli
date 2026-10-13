"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
// Same-origin requests; server secrets and config are never imported here.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
