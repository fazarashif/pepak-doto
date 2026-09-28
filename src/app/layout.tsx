import type { Metadata, Viewport } from "next";
import {
  Alegreya,
  Alegreya_SC,
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const display = Alegreya({
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
  variable: "--font-alegreya",
});
const displaySc = Alegreya_SC({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-alegreya-sc",
});
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-atkinson",
});
const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-atkinson-mono",
});

export const metadata: Metadata = {
  title: { default: "Pepak Doto", template: "%s | Pepak Doto" },
  description: "Draft help, item advice and match reviews that help you get better at Dota 2.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0a" },
    { media: "(prefers-color-scheme: light)", color: "#f4efe5" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${displaySc.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
