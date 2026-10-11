import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: { default: "Online tutoring | Learli", template: "%s | Learli" },
  description:
    "Learli connects learners and families with one-to-one tutors. Lessons take place with your tutor on Zoom or Google Meet.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { colorScheme: "light" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
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
