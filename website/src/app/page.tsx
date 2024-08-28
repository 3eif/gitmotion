"use client";

import { useRouter } from "next/navigation";
import GourceInput, { GourceSettings } from "@/components/gource-input";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(
    githubUrl: string,
    accessToken?: string,
    settings?: GourceSettings
  ) {
    setIsLoading(true);
    setError(null);
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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start Gource generation");
      }
      console.log("Received job ID:", data.job_id);
      router.push(`/${data.job_id}`);
    } catch (error) {
      console.error("Failed to start Gource generation:", error);
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full mx-auto pt-2 pb-3">
      <GourceInput
        onSubmit={onSubmit}
        onCancel={async () => {}}
        isLoading={isLoading}
        isGenerating={false}
        initialUrl=""
      />
      {error && <div className="text-red-500 text-center mt-7">{error}</div>}
    </div>
  );
}
