import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import {
  GLOBAL_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  pageSeo,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: pageSeo.home.title,
    template: `%s | ${SITE_NAME}`,
  },
  description: GLOBAL_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: pageSeo.home.title,
    description: GLOBAL_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: pageSeo.home.title,
    description: GLOBAL_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
