"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Problem } from "@/lib/tools/interview/types";

interface SessionHeaderProps {
  problem: Problem;
  onReset: () => void;
}

const difficultyColors = {
  easy: "bg-green-500/10 text-green-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  hard: "bg-red-500/10 text-red-600",
} as const;

export function SessionHeader({ problem, onReset }: SessionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{problem.title}</h2>
          {problem.id !== "custom" && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${difficultyColors[problem.difficulty]}`}
            >
              {problem.difficulty}
            </span>
          )}
        </div>
        {problem.topics.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {problem.topics.map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        New Problem
      </Button>
    </div>
  );
}
