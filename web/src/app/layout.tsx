import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/core/components/layout/theme-provider";
import { DEFAULT_BOOKS_THEME, BOOKS_THEME_NAMES } from "@/core/lib/themes";
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
  title: "Sankirtanam — Search Srila Prabhupada's Books",
  description:
    "Full-text search across Srila Prabhupada's books with REST API and MCP tools for AI agents.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Sankirtanam — Search Srila Prabhupada's Books",
    description:
      "Full-text search across Srila Prabhupada's books with REST API and MCP tools for AI agents.",
    url: "https://sankirtan.am",
    siteName: "Sankirtanam",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme={DEFAULT_BOOKS_THEME}
          disableTransitionOnChange
          themes={BOOKS_THEME_NAMES}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
