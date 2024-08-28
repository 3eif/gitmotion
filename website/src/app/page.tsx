"use client";

import { useRouter } from "next/navigation";
import GourceInput, { GourceSettings } from "@/components/gource-input";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(
    githubUrl: string,
    accessToken?: string,
    settings?: GourceSettings
  ) {
    setIsLoading(true);
    try {
      console.log("Submitting repo URL:", githubUrl);
      const response = await fetch("/api/gource/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo_url: githubUrl,
          access_token: accessToken,
          settings: settings,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to start Gource generation");
      }
      const data = await response.json();
      console.log("Received job ID:", data.job_id);
      router.push(`/${data.job_id}`);
    } catch (error) {
      console.error("Failed to start Gource generation:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const smoothScrollTo = (element: HTMLElement, duration: number) => {
    const targetPosition =
      element.getBoundingClientRect().top + window.pageYOffset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime: number | null = null;

    function animation(currentTime: number) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
      window.scrollTo(0, run);
      if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function easeInOutQuad(t: number, b: number, c: number, d: number) {
      t /= d / 2;
      if (t < 1) return (c / 2) * t * t + b;
      t--;
      return (-c / 2) * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
  };

  return (
    <div className="w-full mx-auto pt-2 pb-3">
      <GourceInput
        onSubmit={onSubmit}
        onCancel={async () => {}}
        isLoading={isLoading}
        isGenerating={false}
        initialUrl=""
      />
    </div>
  );
}
