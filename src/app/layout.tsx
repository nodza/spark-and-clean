import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  GLOBAL_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  pageSeo,
} from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter",
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
        className={`${inter.variable} ${inter.className} font-sans antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
