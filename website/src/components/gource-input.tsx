"use client";

import { FormEvent, useEffect, useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react";

interface GourceInputProps {
  onSubmit: (
    url: string,
    accessKey?: string,
    settings?: GourceSettings
  ) => Promise<void>;
  onCancel: () => Promise<void>;
  isLoading: boolean;
  isGenerating: boolean;
  initialUrl?: string;
  initialSettings?: GourceSettings;
}

export interface GourceSettings {
  show_file_extension_key: boolean;
  show_usernames: boolean;
  show_dirnames: boolean;
}

export default function Component({
  onSubmit,
  onCancel,
  isLoading,
  isGenerating,
  initialUrl = "",
  initialSettings,
}: GourceInputProps) {
  const [repoUrl, setRepoUrl] = useState(initialUrl);
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [settings, setSettings] = useState<GourceSettings>(
    initialSettings || {
      show_file_extension_key: false,
      show_usernames: true,
      show_dirnames: true,
    }
  );

  useEffect(() => {
    console.log("Settings updated:", settings);
  }, [settings]);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  useEffect(() => {
    const urlRegex =
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    setIsValidUrl(urlRegex.test(repoUrl));
  }, [repoUrl]);

  useEffect(() => {
    if (initialUrl) {
      setRepoUrl(initialUrl);
    }
  }, [initialUrl]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isValidUrl && !isSubmitting && !isLoading && !isGenerating) {
      setIsSubmitting(true);
      try {
        await onSubmit(repoUrl, isPrivate ? accessKey : undefined, settings);
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleCancel() {
    if (isGenerating) {
      await onCancel();
    }
  }

  const updateSettings = useCallback(
    (key: keyof GourceSettings) => (checked: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: checked }));
    },
    []
  );

  const isDisabled =
    !isValidUrl ||
    (isPrivate && !accessKey) ||
    isSubmitting ||
    isLoading;

  const buttonText = isSubmitting || isLoading ? "In Progress..." : "Generate";

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
          } bg-transparent py-2 pl-3 pr-36 text-green-50 placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30`}
          disabled={isSubmitting || isGenerating}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-white" />
                <span className="sr-only">Filters</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-[#080A1A]/20 backdrop-blur-md border-white/10 text-white p-4">
              <h3 className="text-sm font-medium mb-3">
                Visualization Filters
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="show-file-extension-key"
                    className="text-gray-300 text-xs"
                  >
                    Show file extension key
                  </Label>
                  <Switch
                    id="show-file-extension-key"
                    checked={settings.show_file_extension_key}
                    onCheckedChange={updateSettings("show_file_extension_key")}
                    disabled={isGenerating || isLoading}
                    className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="show-usernames"
                    className="text-xs text-gray-300"
                  >
                    Show usernames
                  </Label>
                  <Switch
                    id="show-usernames"
                    checked={settings.show_usernames}
                    onCheckedChange={updateSettings("show_usernames")}
                    disabled={isGenerating || isLoading}
                    className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="show-dirnames"
                    className="text-xs text-gray-300"
                  >
                    Show dirnames
                  </Label>
                  <Switch
                    id="show-dirnames"
                    checked={settings.show_dirnames}
                    onCheckedChange={updateSettings("show_dirnames")}
                    disabled={isGenerating || isLoading}
                    className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="mx-2 h-4 w-px bg-white/20" aria-hidden="true" />
          {isGenerating ? (
            <button
              type="button"
              onClick={handleCancel}
              className="select-none text-xs font-medium uppercase transition-colors text-red-500 hover:text-red-400"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={isDisabled}
              className={`select-none text-xs font-medium uppercase transition-colors ${
                isDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {buttonText}
            </button>
          )}
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
                !isPrivate ? "opacity-30" : ""
              }`}
              disabled={!isPrivate || isSubmitting || isGenerating}
            />
          </div>
          <div className="flex items-center space-x-3 pt-2">
            <Switch
              id="private-mode"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isSubmitting || isGenerating}
              className="bg-white/10 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
            />
            <Label
              htmlFor="private-mode"
              className={`text-xs font-medium uppercase ${
                isPrivate ? "text-white" : "opacity-30"
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
