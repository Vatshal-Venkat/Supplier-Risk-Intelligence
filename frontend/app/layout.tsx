import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Vendor Dashboard | Risk Intelligence",
  description: "Enterprise AI-driven supplier risk analytics platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[var(--bg-primary)]">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          
          {/* Header */}
          <header className="border-b border-[var(--border-subtle)] px-10 py-5 backdrop-blur-md bg-black/40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-lg font-semibold tracking-tight">
                Vendor Risk Intelligence
              </h1>
              <span className="text-sm text-[var(--text-muted)]">
                Enterprise Edition
              </span>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}
