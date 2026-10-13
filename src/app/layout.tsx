import type { Metadata, Viewport } from "next";
import { Lexend, Literata } from "next/font/google";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import "./globals.css";

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

export const metadata: Metadata = {
  title: { default: "Online tutoring | Learli", template: "%s | Learli" },
  description:
    "Learli connects learners and families with one-to-one tutors. Lessons take place with your tutor on Zoom or Google Meet.",
  robots: { index: false, follow: false },
  icons: { icon: { url: "/brand/learli-icon.svg", type: "image/svg+xml" } },
};
export const viewport: Viewport = { colorScheme: "light" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lexend.variable} ${literata.variable}`}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-body text-foreground antialiased">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
