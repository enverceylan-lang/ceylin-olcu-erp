import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { PWAController } from "@/components/PWAController";
import { AuthGate } from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ölçü ERP V1.0.1",
  description: "Ceylin saha cari ve perde ölçü uygulaması",
  manifest: "/manifest.json",
  applicationName: "Ölçü ERP V1.0.1",
  appleWebApp: {
    capable: true,
    title: "Ölçü ERP",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-gray-950 flex`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PWAController />
          <AuthGate>
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
              <Topbar />
              <main className="flex-1 p-4 lg:p-8 overflow-auto">
                {children}
              </main>
            </div>
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}

