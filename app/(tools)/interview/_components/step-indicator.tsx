"use client";

import { Check } from "lucide-react";
import {
  UMPIRE_STEPS,
  UMPIRE_LABELS,
  type UmpireStep,
} from "@/lib/tools/interview/types";

interface StepIndicatorProps {
  currentStep: UmpireStep;
  completedSteps: Set<UmpireStep>;
}

export function StepIndicator({
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {UMPIRE_STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(step);
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-px w-4 mx-1 ${
                  isCompleted ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                isCompleted
                  ? "bg-green-500/10 text-green-600"
                  : isCurrent
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted && <Check className="h-3 w-3" />}
              {UMPIRE_LABELS[step]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
