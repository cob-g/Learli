import type { Metadata, Viewport } from "next";
import { Lexend, Literata } from "next/font/google";
import { connection } from "next/server";
import { GlassEffects } from "@/components/shared/glass-effects";
import { NavigationProgress } from "@/components/shared/navigation-progress";
import { BrowserTimeZone } from "@/features/public-availability/profile-zone";
import { siteMetadata } from "@/lib/seo/metadata";
import { indexingAllowed, siteOrigin } from "@/lib/seo/site";
import { getDomainAuthRuntime } from "@/lib/auth";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import { PrivateWorkflowNotice } from "@/features/private-workflow/notice";
import "./globals.css";
import "@/components/shared/site-shell.css";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  display: "swap",
  variable: "--font-lexend",
});

const literata = Literata({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-literata",
  preload: false,
});

/**
 * Whether the site may be indexed, and the origin its canonical URLs use, both
 * depend on where this build is running. They are read for each request so a
 * build made in one environment can never carry its answer into another.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return siteMetadata({ origin: siteOrigin(), indexable: indexingAllowed() });
}
export const viewport: Viewport = { colorScheme: "light" };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtime = process.env.PRIVATE_WORKFLOW_CONFIG_FILE
    ? await getDomainAuthRuntime()
    : null;
  const privateWorkflow = !!runtime && isPrivateWorkflow(runtime);
  return (
    <html lang="en" className={`${lexend.variable} ${literata.variable}`}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-body text-foreground antialiased">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <GlassEffects />
        <NavigationProgress />
        <BrowserTimeZone />
        {privateWorkflow && <PrivateWorkflowNotice />}
        {children}
      </body>
    </html>
  );
}
