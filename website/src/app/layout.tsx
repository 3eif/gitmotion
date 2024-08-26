import type { Metadata } from "next";
import "./globals.css";

import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils";
import { Noise } from "@/components/background-noise";
import Footer from "@/components/footer";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import VisualizationsCount from "@/components/visualizations-count";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL ?? "http://localhost:3000/"),
  title: "Gitmotion",
  description:
    "Generate beautiful visualizations of your Git history right in your browser.",
  applicationName: "Gitmotion",
  openGraph: {
    title: "Gitmotion",
    description:
      "Generate beautiful visualizations of your Git history right in your browser.",
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
      "Generate beautiful visualizations of your Git history right in your browser.",
    images: [
      {
        url: "/og.png",
        alt: "Gitmotion",
      },
    ],
    creator: "@sabziz",
  },
};

const ArrowButton = ({
  onClick,
  isVisible,
}: {
  onClick: () => void;
  isVisible: boolean;
}) => (
  <div
    className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 text-center transition-opacity duration-300 ${
      isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
    }`}
  >
    <button
      onClick={onClick}
      className="flex flex-col items-center text-neutral-400 hover:text-neutral-300 transition duration-300 ease-in-out"
      aria-label="Scroll to example generations"
    >
      <p className="mb-1">View Examples</p>
      <ChevronDownIcon className="h-8 w-8" />
    </button>
  </div>
);

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
        <div className="flex min-h-screen flex-col items-center justify-center gap-7 pt-6 pb-20">
          <div className="flex flex-col items-center justify-center text-center mx-auto w-full max-w-7xl">
            <div className="w-full space-y-5 duration-1000 ease-in-out animate-in fade-in slide-in-from-top-5">
              <VisualizationsCount />
              <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-500 bg-opacity-50">
                Gitmotion
              </h1>
              <p className="font-normal text-lg text-neutral-300 max-w-xl text-center mx-auto px-8">
                Generate beautiful visualizations of your Git repository history
                right in your browser.
              </p>
              {children}
            </div>
          </div>
        </div>
        <Footer />
        {/* <Noise /> */}
      </body>
    </html>
  );
}
