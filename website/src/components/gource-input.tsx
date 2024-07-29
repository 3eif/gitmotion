"use client";

import { FormEvent, useState } from "react";

interface GourceInputProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
  isGenerating: boolean;
}

export default function GourceInput({
  onSubmit,
  isLoading,
  isGenerating,
}: GourceInputProps) {
  const [githubUrl, setGithubUrl] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSubmit(githubUrl);
  }

  const isDisabled = !githubUrl || isLoading || isGenerating;

  return (
    <form
      onSubmit={handleSubmit}
      className="relative min-w-full flex justify-center"
    >
      <input
        type="text"
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        placeholder="https://github.com/username/repo"
        className="w-full appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent py-2 pl-3 pr-20 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30"
        disabled={isGenerating}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        <button
          type="submit"
          disabled={isDisabled}
          className={`select-none text-xs font-medium uppercase transition-colors ${
            isDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isLoading
            ? "In Progress..."
            : isGenerating
            ? "Generating..."
            : "Generate"}
        </button>
      </div>
    </form>
  );
}
