"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PROBLEMS } from "@/lib/tools/interview/problems";
import type { Problem } from "@/lib/tools/interview/types";

interface ProblemPickerProps {
  onSelect: (problem: Problem) => void;
}

const difficultyColors = {
  easy: "bg-green-500/10 text-green-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  hard: "bg-red-500/10 text-red-600",
} as const;

export function ProblemPicker({ onSelect }: ProblemPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCustomSubmit = () => {
    const text = customText.trim();
    if (!text) return;

    const custom: Problem = {
      id: "custom",
      title: "Custom Problem",
      description: text,
      difficulty: "medium",
      topics: [],
      constraints: [],
      examples: [],
      hints: [],
      optimalComplexity: { time: "N/A", space: "N/A" },
      solutionApproach: "",
    };

    onSelect(custom);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Choose a problem</h2>
        <p className="text-sm text-muted-foreground">
          Select a coding problem to practice with your AI interview coach.
        </p>
      </div>

      {showCustom ? (
        <div className="space-y-3">
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Paste or type your problem description here..."
            className="w-full min-h-[160px] resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCustomSubmit} disabled={!customText.trim()}>
              Start
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCustom(false);
                setCustomText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <button
              key={problem.id}
              onClick={() => onSelect(problem)}
              className="text-left"
            >
              <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {problem.title}
                    </CardTitle>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${difficultyColors[problem.difficulty]}`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <CardDescription className="text-xs line-clamp-2">
                    {problem.description}
                  </CardDescription>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {problem.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </CardHeader>
              </Card>
            </button>
          ))}
          <button onClick={() => setShowCustom(true)} className="text-left">
            <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Custom Problem</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Paste your own problem description to practice with.
                </CardDescription>
              </CardHeader>
            </Card>
          </button>
        </div>
      )}
    </div>
  );
}
