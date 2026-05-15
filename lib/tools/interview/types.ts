export type UmpireStep =
  | "understand"
  | "match"
  | "plan"
  | "implement"
  | "review"
  | "evaluate";

export const UMPIRE_STEPS: UmpireStep[] = [
  "understand",
  "match",
  "plan",
  "implement",
  "review",
  "evaluate",
];

export const UMPIRE_LABELS: Record<UmpireStep, string> = {
  understand: "Understand",
  match: "Match",
  plan: "Plan",
  implement: "Implement",
  review: "Review",
  evaluate: "Evaluate",
};

export type Difficulty = "easy" | "medium" | "hard";

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  topics: string[];
  constraints: string[];
  examples: ProblemExample[];
  hints: string[];
  optimalComplexity: { time: string; space: string };
  solutionApproach: string;
}
