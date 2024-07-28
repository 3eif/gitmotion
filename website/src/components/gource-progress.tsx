"use client";

interface GourceProgressProps {
  progress: number;
  message: string;
}

export default function GourceProgress({
  progress,
  message,
}: GourceProgressProps) {
  return (
    <div className="mt-4">
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-sm text-white/60 mt-2">{message}</p>
    </div>
  );
}
