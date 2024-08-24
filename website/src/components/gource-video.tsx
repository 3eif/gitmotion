"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/20/solid";
import GourceProgress, { ProgressStep } from "./gource-progress";

interface GourceVideoProps {
  jobStatus: {
    step: ProgressStep;
    video_url: string | null;
    error: string | null;
  } | null;
  jobId: string | null;
  error: Error | null;
  videoRef: React.RefObject<HTMLDivElement>;
}

export default function GourceVideo({
  jobStatus,
  jobId,
  error,
  videoRef,
}: GourceVideoProps) {
  const handleDownload = () => {
    if (jobId) {
      const downloadUrl = `http://localhost:3000/api/gource/video/${jobId}`;
      window.open(downloadUrl, "_blank");
    }
  };

  return (
    <div className="w-full">
      {jobStatus && (
        <div>
          {jobStatus.video_url === null && !jobStatus.error && (
            <div className="w-full max-w-xl mx-auto">
              <GourceProgress currentStep={jobStatus.step} />
            </div>
          )}
          {jobStatus && jobStatus.error && (
            <div className="flex justify-center mt-2">
              <p className="text-red-500 text-center">{jobStatus.error}</p>
            </div>
          )}
          {jobStatus.step === ProgressStep.GeneratingVisualization &&
            jobStatus.video_url && (
              <div className="py-6 max-w-7xl p-8 mx-auto">
                <div
                  ref={videoRef}
                  className="rounded-2xl border-[1.5px] border-white/10 bg-black overflow-hidden relative"
                >
                  <button
                    onClick={handleDownload}
                    className="absolute top-3 right-3
             bg-gradient-to-b from-gray-400/20 to-gray-700/20 
             hover:from-gray-400/30 hover:to-gray-700/30
             rounded-lg p-2 
             transition-all duration-200 ease-in-out
             backdrop-blur-sm"
                    aria-label="Download video"
                  >
                    <ArrowDownTrayIcon className="h-6 w-6 text-white/70" />
                  </button>

                  <video
                    className="w-full h-auto"
                    controls
                    src={`http://localhost:3000/api/gource/video/${jobId}`}
                  />
                </div>
              </div>
            )}
        </div>
      )}

      {error && (
        <div className="flex justify-center mt-2">
          <p className="text-red-500 text-center">
            Error fetching job status: {error.message}
          </p>
        </div>
      )}
    </div>
  );
}
