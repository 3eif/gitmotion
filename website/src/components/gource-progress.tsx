"use client";

import React, { useEffect, useState, useCallback } from "react";

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
      setProgress((oldProgress) => (oldProgress + 2) % 101);
    }, 30);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const getGradient = useCallback(
    (step: ProgressStep) => {
      if (step < currentStep) {
        return "linear-gradient(to right, #2B20A5, #322893)";
      } else if (step === currentStep) {
        return `linear-gradient(to right, #4338ca, #322893 ${progress}%, #e5e7eb ${progress}%)`;
      } else {
        return "linear-gradient(to right, #e5e7eb, #e5e7eb)";
      }
    },
    [currentStep, progress]
  );

  return (
    <nav aria-label="Progress" className="w-full mx-aputo pt-10">
      <ol role="list" className="flex space-x-8">
        {steps.map((step, index) => (
          <li key={step.name} className="flex-1">
            <div className="group flex flex-col">
              <div className="flex items-center">
                <div className="relative flex-1">
                  {index !== 0 && (
                    <div
                      className="absolute inset-0 flex items-center"
                      aria-hidden="true"
                    >
                      <div className="h-0.5 w-full bg-gray-200"></div>
                    </div>
                  )}
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 bottom-0 transition-all duration-300 ease-in-out rounded-full"
                      style={{
                        width:
                          step.step <= currentStep
                            ? "101%" // Slightly over 100% to cover edges
                            : step.step === currentStep
                            ? `${progress}%`
                            : "0%",
                        backgroundImage: getGradient(step.step),
                        transform: "translateX(-0.5%)", // Shift slightly to cover both edges
                      }}
                    />
                  </div>
                </div>
              </div>
              <span
                className={`text-sm font-medium mt-2 ${
                  step.step <= currentStep ? "text-indigo-500" : "text-gray-500"
                }`}
              >
                {step.id}
              </span>
              <span className="text-sm font-medium text-gray-500">
                {step.name}
              </span>
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
