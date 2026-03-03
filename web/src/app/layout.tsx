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
  title: "Books Service",
  description: "Standalone books service UI + REST + MCP",
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
