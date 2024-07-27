"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function Input() {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // router.push(`/some-path/${githubUrl}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative min-w-full flex w-full md:w-4/5 justify-center"
    >
      <input
        type="text"
        name="githubUrl"
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        className="w-full appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent py-2 pl-3 pr-20 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30"
        placeholder="https://github.com/username/repo"
      />

      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        <button
          type="submit"
          className={`select-none text-xs font-medium uppercase transition-colors ${
            githubUrl.length === 0
              ? "text-white/20 cursor-not-allowed"
              : "text-white/20 hover:text-white/40"
          }`}
          disabled={githubUrl.length === 0}
        >
          Submit
        </button>
      </div>
    </form>
  );
}
