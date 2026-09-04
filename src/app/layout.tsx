import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OnlineListener from "./OnlineListener";

export const metadata: Metadata = {
  title: "Carnet de Crédit Numérique",
  description: "Application de gestion de crédit pour petits commerçants en Côte d'Ivoire",
  // Additional metadata for PWA can be added via head tags
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* PWA manifest link */}
        <link rel="manifest" href="/manifest.json" />
        {/* Theme color meta */}
        <meta name="theme-color" content="#0d9488" />
        {/* Online listener and service worker registration */}
        <OnlineListener />
        {children}
      </body>
    </html>
  );
}

// Font definitions (moved outside the component to avoid re-creation on each render)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});