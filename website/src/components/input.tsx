"use client";

import { FormEvent, useState, useEffect } from "react";
import useSWR from "swr";
import GourceProgress from "./gource-progress";

interface JobStatus {
  status: string;
  progress: number;
  video_url: string | null;
  error: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (!res.ok) {
    throw new Error("An error occurred while fetching the data.");
  }
  return res.json();
};

export default function Input() {
  const [githubUrl, setGithubUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    data: jobStatus,
    error,
    mutate,
  } = useSWR<JobStatus>(jobId ? `/api/gource/status/${jobId}` : null, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
    dedupingInterval: 0,
    onError: (err) => console.error("SWR Error:", err),
  });

  useEffect(() => {
    console.log("Current jobId:", jobId);
  }, [jobId]);

  useEffect(() => {
    if (jobStatus) {
      console.log("Job Status:", jobStatus);
    }
  }, [jobStatus]);

  useEffect(() => {
    return () => {
      // Clean up the Blob URL when the component unmounts
      if (jobStatus?.video_url) {
        URL.revokeObjectURL(jobStatus.video_url);
      }
    };
  }, [jobStatus?.video_url]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    try {
      console.log("Submitting repo URL:", githubUrl);
      const response = await fetch("/api/gource/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_url: githubUrl }),
      });
      if (!response.ok) {
        throw new Error("Failed to start Gource generation");
      }
      const data = await response.json();
      console.log("Received job ID:", data.job_id);
      setJobId(data.job_id);
      mutate(); // Trigger an immediate refetch of the job status
    } catch (error) {
      console.error("Failed to start Gource generation:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={onSubmit}
        className="relative min-w-full flex w-full md:w-4/5 justify-center"
      >
        <input
          type="text"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/username/repo"
          className="w-full appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent py-2 pl-3 pr-20 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
          <button
            type="submit"
            disabled={!githubUrl || isLoading}
            className={`select-none text-xs font-medium uppercase transition-colors ${
              !githubUrl || isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>
      {jobStatus && (
        <div className="mt-4">
          <GourceProgress
            progress={jobStatus.progress * 100}
            message={jobStatus.status}
          />
          {jobStatus.error && (
            <p className="text-red-500 mt-2">{jobStatus.error}</p>
          )}
          {jobStatus &&
            jobStatus.status === "Completed" &&
            jobStatus.video_url && (
              <div className="w-full max-w-full relative py-6 px-40">
                <video
                  className="w-full h-full object-cover aspect-video"
                  controls
                  src={`http://localhost:8081/video/${jobId}`}
                ></video>
              </div>
            )}
        </div>
      )}

      {error && (
        <p className="text-red-500 mt-2">
          Error fetching job status: {error.message}
        </p>
      )}
    </div>
  );
}
