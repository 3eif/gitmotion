"use client";

import GourceProgress from "./gource-progress";

interface GourceVideoProps {
  jobStatus: {
    status: string;
    progress: number;
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
  return (
    <div>
      {jobStatus && (
        <div>
          {jobStatus.status !== "Completed" && (
            <GourceProgress
              progress={jobStatus.progress * 100}
              message={jobStatus.status}
            />
          )}
          {jobStatus.error && (
            <p className="text-red-500 mt-2">{jobStatus.error}</p>
          )}
          {jobStatus.status === "Completed" && jobStatus.video_url && (
            <div className="py-6 w-full">
              <div
                ref={videoRef}
                className="rounded-2xl border-[1.5px] border-white/10 bg-black overflow-hidden"
              >
                <video
                  className="w-full h-auto"
                  controls
                  src={`http://localhost:3000/api/gource/video/954762ae-0e89-48c6-9e84-78fdbf9bd0ea`}
                />
              </div>
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
