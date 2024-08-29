"use client";

import { FormEvent, useEffect, useState, useCallback, useRef } from "react";
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
  dir_font_size: number;
  file_font_size: number;
  user_font_size: number;
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
      dir_font_size: 11,
      file_font_size: 10,
      user_font_size: 12,
    }
  );

  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isValidUrl && !isSubmitting && !isLoading && !isGenerating) {
      setIsSubmitting(true);
      try {
        await onSubmit(repoUrl, isPrivate ? accessKey : undefined, settings);
      } catch (error) {
        console.error("Error submitting job:", error);
        // The error will be handled in the parent component
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
    (key: keyof GourceSettings) => (value: boolean | number) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const isDisabled =
    !isValidUrl || (isPrivate && !accessKey) || isSubmitting || isLoading;

  const buttonText = isSubmitting || isLoading ? "In Progress..." : "Generate";

  return (
    <div className="w-full max-w-screen-xl mx-auto px-8">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              className={`w-full appearance-none rounded-lg border-[1.5px] ${
                repoUrl && !isValidUrl ? "border-red-500" : "border-white/10"
              } bg-transparent py-2 pl-3 pr-32 text-green-50 placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30 ${
                isSubmitting || isGenerating ? "cursor-not-allowed" : ""
              }`}
              disabled={isSubmitting || isGenerating}
              autoFocus
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
                        onCheckedChange={updateSettings(
                          "show_file_extension_key"
                        )}
                        disabled={isGenerating || isLoading}
                        className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="show-usernames"
                        className="text-xs text-gray-300"
                      >
                        Show names of users
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
                        Show directory names
                      </Label>
                      <Switch
                        id="show-dirnames"
                        checked={settings.show_dirnames}
                        onCheckedChange={updateSettings("show_dirnames")}
                        disabled={isGenerating || isLoading}
                        className="bg-white/20 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
                      />
                    </div>
                    <div className="py-1">
                      <hr className="border-t border-white/10" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Label
                        htmlFor="dir-font-size"
                        className="text-xs text-gray-300"
                      >
                        Directory name font size
                      </Label>
                      <input
                        type="number"
                        id="dir-font-size"
                        value={settings.dir_font_size}
                        onChange={(e) =>
                          updateSettings("dir_font_size")(
                            Number(e.target.value)
                          )
                        }
                        min="1"
                        max="20"
                        disabled={isGenerating || isLoading}
                        className={`w-16 appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent text-sm px-2 py-1 ${
                          isGenerating || isLoading
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                        style={{ appearance: "textfield" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Label
                        htmlFor="file-font-size"
                        className="text-xs text-gray-300"
                      >
                        File name font size
                      </Label>
                      <input
                        type="number"
                        id="file-font-size"
                        value={settings.file_font_size}
                        onChange={(e) =>
                          updateSettings("file_font_size")(
                            Number(e.target.value)
                          )
                        }
                        min="1"
                        max="20"
                        disabled={isGenerating || isLoading}
                        className={`w-16 appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent text-sm px-2 py-1 ${
                          isGenerating || isLoading
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                        style={{ appearance: "textfield" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Label
                        htmlFor="user-font-size"
                        className="text-xs text-gray-300"
                      >
                        User name font size
                      </Label>
                      <input
                        type="number"
                        id="user-font-size"
                        value={settings.user_font_size}
                        onChange={(e) =>
                          updateSettings("user_font_size")(
                            Number(e.target.value)
                          )
                        }
                        min="1"
                        max="20"
                        disabled={isGenerating || isLoading}
                        className={`w-16 appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent text-sm px-2 py-1 ${
                          isGenerating || isLoading
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                        style={{ appearance: "textfield" }}
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
                  placeholder="Personal Access Token"
                  className={`w-full appearance-none rounded-lg border-[1.5px] border-white/10 bg-transparent py-2 px-3 text-white placeholder-white/20 outline-none transition-all hover:border-white/20 focus:border-white/30 ${
                    !isPrivate ? "opacity-30" : ""
                  } ${
                    !isPrivate || isSubmitting || isGenerating
                      ? "cursor-not-allowed"
                      : ""
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
                  className="bg-white/50 data-[state=checked]:bg-blurple data-[state=unchecked]:bg-gray-800"
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
                Only private GitHub repos are supported. The token is encrypted
                on its way to the server. Repository contents are deleted after
                the generation is complete.
              </p>
              <p
                className={`text-left mt-1 text-xs text-gray-600 ${
                  !isPrivate ? "hidden" : ""
                }`}
              >
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-current hover:bg-clip-text hover:bg-gradient-to-b from-blue-400 to-blue-900 hover:text-transparent"
                >
                  To obtain a personal access token, click here and select the
                  &quot;repo&quot; scope.
                </a>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
