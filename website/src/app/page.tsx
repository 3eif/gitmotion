"use client";

import ExampleGenerations from "@/components/example-generations";
import Input from "@/components/input";
import { Spotlight } from "@/components/spotlight";
import Image from "next/image";
import { useState, useRef } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const scrollToVideo = () => {
    if (videoRef.current) {
      smoothScrollTo(videoRef.current, 850); // 1500ms duration for slower scroll
    }
  };

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

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-7 pt-8 pb-14">
        {/* <Spotlight
          className="left-0 top-20 md:-top-20 md:left-60"
          fill="#ffffff70"
        /> */}
        <div className="flex flex-col items-center justify-center text-center mx-auto w-full">
          <div className="py-10 max-w-7xl space-y-5 px-5">
            <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-500 bg-opacity-50">
              Gitmotion
            </h1>
            <p className="font-normal text-lg text-neutral-300 max-w-xl text-center mx-auto px-8">
              Generate beautiful visualizations of your Git repository history
              right in your browser.
            </p>
            <Input />
            <button
              onClick={scrollToVideo}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              View Demo
            </button>
          </div>
          <div className="w-full max-w-full relative py-6 lg:px-24 md:px-16 xl:px-40 px-5">
            <video
              ref={videoRef}
              className="w-full h-full object-cover aspect-video rounded-xl p-2 border-[1.5px] border-white/10 bg-transparent"
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/video-placeholder.jpg"
            >
              <source src="/gource.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <ExampleGenerations />
        </div>
      </main>
    </>
  );
}
