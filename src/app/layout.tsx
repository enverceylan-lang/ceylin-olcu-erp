import type {
  Metadata,
  Viewport,
} from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import {
  AppRouteShell,
} from "@/components/AppRouteShell";
import {
  ThemeProvider,
} from "@/components/ThemeProvider";

const geistSans = Geist({
  variable:
    "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable:
    "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata:
  Metadata = {
    title: "ENVerp",
    description:
      "ENVerp — Entegre Net Veri iş ve operasyon yönetim platformu",
    manifest:
      "/manifest.json",
    applicationName:
      "ENVerp",
    appleWebApp: {
      capable: true,
      title: "ENVerp",
      statusBarStyle:
        "default",
    },
    icons: {
      icon: [
        {
          url:
            "/icons/icon-192x192.png",
          sizes:
            "192x192",
          type:
            "image/png",
        },
        {
          url:
            "/icons/icon-512x512.png",
          sizes:
            "512x512",
          type:
            "image/png",
        },
      ],
      apple:
        "/apple-touch-icon.png",
    },
  };

export const viewport:
  Viewport = {
    themeColor: "#071327",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground flex`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <AppRouteShell>
            {children}
          </AppRouteShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
