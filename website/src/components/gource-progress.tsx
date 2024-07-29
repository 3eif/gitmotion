"use client";

import React, { useEffect, useState } from "react";

export enum ProgressStep {
  InitializingProject = 1,
  AnalyzingHistory = 2,
  GeneratingVisualization = 3,
}

const steps = [
  {
    id: "Step 1",
    name: "Initializing Project",
    step: ProgressStep.InitializingProject,
  },
  {
    id: "Step 2",
    name: "Analyzing History",
    step: ProgressStep.AnalyzingHistory,
  },
  {
    id: "Step 3",
    name: "Generating Visualization",
    step: ProgressStep.GeneratingVisualization,
  },
];

interface GourceProgressProps {
  currentStep: ProgressStep;
}

export default function GourceProgress({ currentStep }: GourceProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => (oldProgress + 5) % 101);
    }, 50);

    return () => {
      clearInterval(timer);
    };
  }, []);

  console.log("Current step:", currentStep);

  return (
    <nav aria-label="Progress" className="w-full mx-auto pt-10">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step) => (
          <li key={step.name} className="md:flex-1">
            <div
              className={`group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${
                step.step <= currentStep
                  ? "border-indigo-800"
                  : "border-gray-200"
              }`}
              style={{
                borderImageSource: `linear-gradient(to right, ${
                  step.step < currentStep
                    ? "rgb(55, 48, 163) 100%"
                    : step.step === currentStep
                    ? `rgb(55, 48, 163) ${progress}%, rgb(229, 231, 235) ${progress}%`
                    : "rgb(229, 231, 235) 100%"
                })`,
                borderImageSlice: 1,
              }}
            >
              <span
                className={`text-sm font-medium ${
                  step.step <= currentStep ? "text-indigo-600" : "text-gray-500"
                }`}
              >
                {step.id}
              </span>
              <span className="text-sm font-medium">{step.name}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-gray-500 mb-4 text-center pt-8">
        This process might take a few minutes, especially for larger
        repositories.
      </p>
    </nav>
  );
}
