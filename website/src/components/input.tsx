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
      <form onSubmit={onSubmit} className="mb-4">
        <div className="flex items-center border-b border-gray-300 py-2">
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
          />
          <button
            type="submit"
            disabled={!githubUrl || isLoading}
            className={`flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded ${
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
              <video
                className="mt-4 w-full"
                controls
                src={`http://localhost:8081/video/${jobId}`}
              ></video>
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
