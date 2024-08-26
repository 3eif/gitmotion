"use client";

import { useParams, useRouter } from "next/navigation";
import ExampleGenerations from "@/components/example-generations";
import GourceInput, { GourceSettings } from "@/components/gource-input";
import { ProgressStep } from "@/components/gource-progress";
import GourceVideo from "@/components/gource-video";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Icons } from "@/components/ui/icons";

interface JobStatus {
  step: ProgressStep;
  video_url: string | null;
  repo_url: string;
  error: string | null;
  settings: GourceSettings;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(
      errorData.message || "An error occurred while fetching the data."
    );
  }
  const data = await res.json();
  if (typeof data.step === "string") {
    data.step = ProgressStep[data.step as keyof typeof ProgressStep];
  }
  return data;
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

const LoadingIndicator = () => (
  <div className="flex h-full items-center justify-center">
    <Icons.spinner className="h-8 w-8 animate-spin" />
  </div>
);

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isArrowVisible, setIsArrowVisible] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [lastValidJobStatus, setLastValidJobStatus] =
    useState<JobStatus | null>(null);
  const [isJobCompleted, setIsJobCompleted] = useState(false);
  const [shouldPoll, setShouldPoll] = useState(true);
  const [isGenerationInProgress, setIsGenerationInProgress] = useState(false);
  const [settings, setSettings] = useState<GourceSettings>({
    show_file_extension_key: false,
    show_usernames: true,
    show_dirnames: true,
    dir_font_size: 11,
    file_font_size: 10,
    user_font_size: 12,
  });

  const videoRef = useRef<HTMLDivElement>(null);
  const exampleGenerationsRef = useRef<HTMLDivElement>(null);

  const {
    data: jobStatus,
    error,
    mutate,
  } = useSWR<JobStatus>(
    jobId && shouldPoll ? `/api/gource/status/${jobId}` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      onSuccess: (data) => {
        if (data) {
          console.log("Raw job status data:", data);
          setLastValidJobStatus(data);
          setRepoUrl(data.repo_url);
          setSettings(data.settings);
          if (data.video_url || data.error) {
            setIsJobCompleted(true);
            setShouldPoll(false);
            setIsGenerationInProgress(false);
          } else {
            setIsGenerationInProgress(true);
          }
        }
        setIsInitialLoading(false);
      },
      onError: (err) => {
        console.error("SWR Error:", err.message);
        setIsInitialLoading(false);
        setIsGenerationInProgress(false);
      },
    }
  );

  useEffect(() => {
    if (jobStatus) {
      console.log("Job Status:", jobStatus);
      console.log("isGenerationInProgress:", isGenerationInProgress);
      if (jobStatus.video_url && videoRef.current) {
        smoothScrollTo(videoRef.current, 850);
        setIsJobCompleted(true);
        setIsArrowVisible(false);
      }
    }
  }, [jobStatus, isGenerationInProgress]);

  useEffect(() => {
    if (jobStatus) {
      setIsGenerationInProgress(
        jobStatus.step !== ProgressStep.GeneratingVisualization ||
          (!jobStatus.video_url && !jobStatus.error)
      );
    }
  }, [jobStatus]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      if (scrollPosition > 100 && !hasScrolled) {
        setHasScrolled(true);
        setIsArrowVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled]);

  async function onSubmit(
    githubUrl: string,
    accessToken?: string,
    newSettings?: GourceSettings
  ) {
    setIsLoading(true);
    setIsGenerationInProgress(true);
    setIsArrowVisible(true);
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
          settings: newSettings || settings,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to start Gource generation");
      }
      const data = await response.json();
      console.log("Received job ID:", data.job_id);

      // Update the URL with the new job ID
      router.push(`/${data.job_id}`);

      // Reset states for the new job
      setRepoUrl(githubUrl);
      setLastValidJobStatus(null);
      setIsJobCompleted(false);
      setShouldPoll(true);
      if (newSettings) {
        setSettings(newSettings);
      }

      // Trigger a new data fetch for the new job ID
      mutate();
    } catch (error) {
      console.error("Failed to start Gource generation:", error);
      setIsGenerationInProgress(false);
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

  const scrollToExampleGenerations = () => {
    if (exampleGenerationsRef.current) {
      smoothScrollTo(exampleGenerationsRef.current, 850);
      setIsArrowVisible(false);
      setHasScrolled(true);
    }
  };

  const shouldShowArrow = isArrowVisible && !lastValidJobStatus?.video_url;

  return (
    <>
      <div className="">
        {isInitialLoading ? (
          <LoadingIndicator />
        ) : (
          <div className="w-full max-w-xl mx-auto pt-2 pb-3">
            <GourceInput
              onSubmit={onSubmit}
              onCancel={async () => {
                try {
                  const response = await fetch(`/api/gource/stop/${jobId}`, {
                    method: "GET",
                  });
                  if (!response.ok) {
                    throw new Error("Failed to cancel job");
                  }
                  setIsGenerationInProgress(false);
                } catch (error) {
                  console.error("Error cancelling job:", error);
                }
              }}
              isLoading={isLoading}
              isGenerating={isGenerationInProgress}
              initialUrl={repoUrl}
              initialSettings={settings}
            />
          </div>
        )}
        <GourceVideo
          jobStatus={lastValidJobStatus}
          jobId={jobId}
          error={error}
          videoRef={videoRef}
        />
      </div>
      <ArrowButton
        onClick={scrollToExampleGenerations}
        isVisible={shouldShowArrow}
      />
      <div ref={exampleGenerationsRef} className="px-8 max-w-7xl mx-auto">
        <ExampleGenerations />
      </div>
    </>
  );
}
