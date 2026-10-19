import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FindrYU",
    template: "%s · FindrYU",
  },
  description: "Lost and found for York University's Keele campus.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="absolute left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-foreground"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
