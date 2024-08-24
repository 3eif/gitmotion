"use client";

import { FormEvent, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface GourceInputProps {
  onSubmit: (url: string, accessKey?: string) => Promise<void>;
  isLoading: boolean;
  isGenerating: boolean;
}

export default function Component({
  onSubmit,
  isLoading,
  isGenerating,
}: GourceInputProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [isValidUrl, setIsValidUrl] = useState(false);

  useEffect(() => {
    if (!isPrivate) {
      setAccessKey("");
    }
  }, [isPrivate]);

  useEffect(() => {
    const urlRegex =
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    setIsValidUrl(urlRegex.test(repoUrl));
  }, [repoUrl]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isValidUrl) {
      await onSubmit(repoUrl, isPrivate ? accessKey : undefined);
    }
  }

  const isDisabled =
    !isValidUrl || (isPrivate && !accessKey) || isLoading || isGenerating;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/username/repo"
          className={`w-full appearance-none rounded-lg border-[1.5px] ${
            repoUrl && !isValidUrl ? "border-red-500" : "border-white/10"
          } bg-transparent py-2 pl-3 pr-20 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30`}
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
      </div>

      <div className="relative">
        <div className="flex items-start space-x-4">
          <div className="relative flex-grow">
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Private Access Key"
              className={`w-full appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent py-2 px-3 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30 ${
                !isPrivate ? "opacity-50" : ""
              }`}
              disabled={!isPrivate || isGenerating}
            />
          </div>
          <div className="flex items-center space-x-3 pt-2">
            <Switch
              id="private-mode"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isGenerating}
              className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
            />
            <Label
              htmlFor="private-mode"
              className={`text-xs font-medium uppercase ${
                isPrivate ? "text-white" : "text-gray-500"
              }`}
            >
              PRIVATE REPO
            </Label>
          </div>
        </div>
        <div className="relative">
          <p
            className={`text-left mt-3 text-xs text-gray-600 ${
              !isPrivate ? "hidden" : ""
            }`}
          >
            Only private GitHub repos are supported. The token is encrypted on
            its way to the server.
          </p>
          <p
            className={`text-left mt-1 text-xs text-gray-600 ${
              !isPrivate ? "hidden" : ""
            }`}
          >
            <a
              href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-current hover:bg-clip-text hover:bg-gradient-to-b from-blue-400 to-blue-900 hover:text-transparent"
            >
              Learn how to create a personal access token.
            </a>
          </p>
        </div>
      </div>
    </form>
  );
}
