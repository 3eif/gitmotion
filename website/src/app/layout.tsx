import type { Metadata } from "next";
import "./globals.css";

import { Inter as FontSans } from "next/font/google";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Noise } from "@/components/background-noise";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export function generateMetadata(): Metadata {
  const title = "Gitsight";
  const description =
    "Generate beautiful visualizations of your Git history right in your browser.";

  return {
    metadataBase: new URL(process.env.URL ?? "http://localhost:3000/"),
    title,
    description,
    applicationName: "Gitsight",
    openGraph: {
      title,
      description,
      url: "https://gitmotion.app",
      type: "website",
      images: [
        {
          url: "/og.png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: "/og.png",
          alt: title,
        },
      ],
      creator: "@sabziz",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        {children}
        {/* <Noise /> */}
      </body>
    </html>
  );
}
