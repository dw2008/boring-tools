import type { Metadata } from "next";
import { InterviewClient } from "./_components/interview-client";

export const metadata: Metadata = {
  title: "Interview Prep | boringtools",
  description:
    "Practice coding interviews with an AI coach using the UMPIRE framework.",
};

export default function InterviewPage() {
  return (
    <div className="container max-w-6xl py-10 px-4 space-y-8">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-3xl font-bold tracking-tight">Interview Prep</h2>
        <p className="text-muted-foreground">
          Practice coding problems step-by-step with an AI interview coach.
        </p>
      </div>
      <InterviewClient />
    </div>
  );
}
