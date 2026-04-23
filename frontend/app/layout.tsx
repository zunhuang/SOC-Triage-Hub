import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { SessionGate } from "@/components/auth/SessionGate";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "IAM Triage Hub",
  description: "AI-assisted IAM incident triage operations console"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${ibmPlexMono.variable}`}>
      <body className="animate-fade-in">
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/35 flex flex-col">
          <AppHeader />
          <div className="flex flex-1">
            <AppSidebar />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
              <div className="mx-auto w-full max-w-[1400px]">
                <SessionGate>{children}</SessionGate>
              </div>
            </main>
          </div>
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
