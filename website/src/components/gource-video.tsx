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
}

export default function GourceVideo({
  jobStatus,
  jobId,
  error,
}: GourceVideoProps) {
  return (
    <div>
      {jobStatus && (
        <div className="mt-4">
          <GourceProgress
            progress={jobStatus.progress * 100}
            message={jobStatus.status}
          />
          {jobStatus.error && (
            <p className="text-red-500 mt-2">{jobStatus.error}</p>
          )}
          {jobStatus.status === "Completed" && jobStatus.video_url && (
            <div className="w-full max-w-full relative py-6 px-40">
              <video
                className="w-full h-full object-cover aspect-video"
                controls
                src={`http://localhost:3000/api/gource/video/954762ae-0e89-48c6-9e84-78fdbf9bd0ea`}
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
