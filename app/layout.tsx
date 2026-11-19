import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RunStrong Lift",
  description: "Strength sessions built around today's run and your race schedule.",
  appleWebApp: { capable: true, title: "RS Lift", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {/*
        App shell: the page itself never scrolls; only <main> does, and only when its content is taller than the screen.
        Phones: content column + bottom tab bar. Desktop (lg): sidebar on the left, wide content.
      */}
      <body className="flex h-dvh flex-col overflow-hidden lg:flex-row">
        <main id="scroller" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-2xl md:px-6 lg:max-w-6xl lg:px-10 lg:pb-12 lg:pt-10">
            {children}
          </div>
        </main>
        <Nav />
      </body>
    </html>
  );
}
