"use client";
import { createAuthClient } from "better-auth/react";
// Same-origin requests; server secrets and config are never imported here.
export const authClient = createAuthClient();
