import type { Metadata } from "next";
import "./globals.css";

import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils";
import { Noise } from "@/components/background-noise";
import Footer from "@/components/footer";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import VisualizationsCount from "@/components/visualizations-count";
import ExampleGenerations from "@/components/example-generations";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL ?? "https://gitmotion.app"),
  title: "Gitmotion",
  description:
    "Generate beautiful visualizations of your Git history right from your browser.",
  applicationName: "Gitmotion",
  openGraph: {
    title: "Gitmotion",
    description:
      "Generate beautiful visualizations of your Git history right from your browser.",
    url: "https://gitmotion.app",
    type: "website",
    images: [
      {
        url: "/og.png",
        alt: "Gitmotion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gitmotion",
    description:
      "Generate beautiful visualizations of your Git history right from your browser.",
    images: [
      {
        url: "/og.png",
        alt: "Gitmotion",
      },
    ],
    creator: "@sabziz",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="a2b24625-0688-4af0-a7b5-d0c8dc0c968c"
        ></script>
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <div className="flex min-h-screen flex-col items-center justify-center gap-7 pt-20 pb-8 mx-auto">
          <div className="flex flex-col items-center justify-center text-center mx-auto w-full max-w-7xl">
            <div className="w-full space-y-5 duration-1000 ease-in-out animate-in fade-in slide-in-from-top-5">
              <VisualizationsCount />
              <a href="/">
                <h1 className="mt-5 text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-500 bg-opacity-50">
                  Gitmotion
                </h1>
              </a>
              <p className="font-normal text-lg text-neutral-300 max-w-xl text-center mx-auto px-8">
                Generate beautiful visualizations of your Git repository history
                right in your browser.
              </p>
              {children}
              <div className="px-8 max-w-7xl mx-auto">
                <ExampleGenerations />
              </div>
            </div>
          </div>
        </div>
        <Footer />
        {/* <Noise /> */}
      </body>
    </html>
  );
}
