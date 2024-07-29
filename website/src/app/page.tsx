"use client";

import ExampleGenerations from "@/components/example-generations";
import Footer from "@/components/footer";
import GourceInput from "@/components/gource-input";
import GourceVideo from "@/components/gource-video";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { useState, useRef, useEffect } from "react";
import useSWR from "swr";

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

export default function Page() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isArrowVisible, setIsArrowVisible] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const exampleGenerationsRef = useRef<HTMLDivElement>(null);

  const [isJobCompleted, setIsJobCompleted] = useState(false);

  const {
    data: jobStatus,
    error,
    mutate,
  } = useSWR<JobStatus>(
    jobId && !isJobCompleted ? `/api/gource/status/${jobId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        if (data?.status === "Completed" || data?.status === "Failed") {
          return 0;
        }
        return 5000;
      },
      revalidateOnFocus: false,
      dedupingInterval: 1000,
      onSuccess: (data) => {
        if (data?.status === "Completed" || data?.status === "Failed") {
          setIsJobCompleted(true);
        }
      },
      onError: (err) => console.error("SWR Error:", err),
    }
  );

  useEffect(() => {
    if (jobStatus) {
      console.log("Job Status:", jobStatus);
      if (jobStatus.status === "Completed" && videoRef.current) {
        smoothScrollTo(videoRef.current, 850);
        setIsJobCompleted(true);
      }
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

  async function onSubmit(githubUrl: string) {
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
      mutate();
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

  const scrollToExampleGenerations = () => {
    if (exampleGenerationsRef.current) {
      smoothScrollTo(exampleGenerationsRef.current, 850);
      setIsArrowVisible(false);
      setHasScrolled(true);
    }
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-7 pt-6 pb-20">
        <div className="flex flex-col items-center justify-center text-center mx-auto w-full">
          <div className="py-5 max-w-7xl space-y-5 px-5">
            <div className="font-normal text-sm text-neutral-300 px-4 py-2 rounded-full border border-blue-500/30 bg-gradient-to-b from-blue-400/10 to-blue-900/10 inline-block">
              <strong>45</strong> visualizations generated and counting
            </div>
            <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-500 bg-opacity-50">
              Gitmotion
            </h1>
            <p className="font-normal text-lg text-neutral-300 max-w-xl text-center mx-auto px-8">
              Generate beautiful visualizations of your Git repository history
              right in your browser.
            </p>
            <GourceInput onSubmit={onSubmit} isLoading={isLoading} />
          </div>

          <div className="xl:px-40 lg:px-28 md:px-20 sm:px-14 px-8">
            <GourceVideo
              jobStatus={jobStatus ?? null}
              jobId={jobId}
              error={error}
              videoRef={videoRef}
            />
          </div>
        </div>
      </main>
      <ArrowButton
        onClick={scrollToExampleGenerations}
        isVisible={isArrowVisible}
      />
      <div className="xl:px-40 lg:px-28 md:px-20 sm:px-14 px-8">
        <div ref={exampleGenerationsRef}>
          <ExampleGenerations />
        </div>
        <Footer />
      </div>
    </>
  );
}
