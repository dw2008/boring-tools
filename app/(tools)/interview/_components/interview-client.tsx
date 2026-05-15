"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import {
  UMPIRE_STEPS,
  UMPIRE_LABELS,
  type UmpireStep,
  type Problem,
} from "@/lib/tools/interview/types";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProblemPicker } from "./problem-picker";
import { SessionHeader } from "./session-header";
import { StepIndicator } from "./step-indicator";
import { ChatPanel } from "./chat-panel";
import { CodeEditor } from "./code-editor";

export function InterviewClient() {
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [currentStep, setCurrentStep] = useState<UmpireStep>("understand");
  const [completedSteps, setCompletedSteps] = useState<Set<UmpireStep>>(
    new Set()
  );
  const [code, setCode] = useState("");
  const codeRef = useRef(code);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [usageRecorded, setUsageRecorded] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [completed, setCompleted] = useState(false);

  const showEditor =
    currentStep === "implement" ||
    currentStep === "review" ||
    currentStep === "evaluate";

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    codeRef.current = value;
  }, []);

  // Use a ref so the transport body function always reads the latest state.
  // codeRef is updated synchronously on every keystroke so it's never stale.
  const bodyRef = useRef({
    problemId: problem?.id ?? "",
    currentStep,
    code: showEditor ? codeRef.current : undefined,
    customDescription: problem?.id === "custom" ? problem.description : undefined,
    sessionId,
    recordUsage: !usageRecorded,
  });
  bodyRef.current = {
    problemId: problem?.id ?? "",
    currentStep,
    code: showEditor ? codeRef.current : undefined,
    customDescription: problem?.id === "custom" ? problem.description : undefined,
    sessionId,
    recordUsage: !usageRecorded,
  };

  // Stable transport — never re-created, reads from ref
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/interview/chat",
        body: () => ({ ...bodyRef.current }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (err) => {
      if (
        err.message?.includes("LIMIT_REACHED") ||
        err.message?.includes("monthly limit")
      ) {
        setLimitReached(true);
      }
    },
    onFinish: () => {
      if (!usageRecorded) {
        setUsageRecorded(true);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSelectProblem = useCallback(
    (p: Problem) => {
      if (!user) {
        setAuthModalOpen(true);
        return;
      }
      setProblem(p);
      setCurrentStep("understand");
      setCompletedSteps(new Set());
      setCode("");
      codeRef.current = "";
      const examples = p.examples.length > 0
        ? `\n\n**Examples:**\n${p.examples.map((e) => `- Input: \`${e.input}\` → Output: \`${e.output}\``).join("\n")}`
        : "";
      const welcomeText = `Let's work through **${p.title}** together!\n\nHere's the problem:\n\n${p.description}${examples}\n\nLet's start with the **Understand** step. Can you restate this problem in your own words? What are the key inputs and outputs?`;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          parts: [{ type: "text", text: welcomeText }],
        },
      ]);
    },
    [user, setMessages]
  );

  const handleAdvanceStep = useCallback(() => {
    const idx = UMPIRE_STEPS.indexOf(currentStep);
    if (idx >= UMPIRE_STEPS.length - 1 || isLoading) return;

    const next = UMPIRE_STEPS[idx + 1];
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep(next);

    // Update ref immediately so the transport sends the new step
    bodyRef.current = { ...bodyRef.current, currentStep: next };

    sendMessage({
      text: `I'm ready to move on to the ${UMPIRE_LABELS[next]} step.`,
    });
  }, [currentStep, isLoading, sendMessage]);

  const handleComplete = useCallback(() => {
    setCompletedSteps(new Set(UMPIRE_STEPS));
    setCompleted(true);
  }, []);

  const handleReset = useCallback(() => {
    setProblem(null);
    setCurrentStep("understand");
    setCompletedSteps(new Set());
    setCode("");
    codeRef.current = "";
    setMessages([]);
    setUsageRecorded(false);
    setLimitReached(false);
    setCompleted(false);
  }, [setMessages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      sendMessage({ text });
    },
    [isLoading, sendMessage]
  );

  if (!problem) {
    return (
      <>
        <ProblemPicker onSelect={handleSelectProblem} />
        {!user && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="underline hover:text-foreground transition-colors"
            >
              Sign in
            </button>{" "}
            to start practicing.
          </p>
        )}
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          trigger="manual"
        />
      </>
    );
  }

  if (completed) {
    return (
      <div className="space-y-4">
        <SessionHeader problem={problem} onReset={handleReset} />
        <StepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h3 className="text-2xl font-bold">Interview Complete!</h3>
          <p className="text-muted-foreground max-w-md">
            Great work finishing <span className="font-medium">{problem.title}</span>. You
            went through all six UMPIRE steps. Keep practicing to sharpen your
            skills.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleReset}>
              Try Another Problem
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SessionHeader problem={problem} onReset={handleReset} />
      <StepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      {limitReached && (
        <p className="text-sm text-muted-foreground text-center">
          You&apos;ve reached your monthly limit.{" "}
          <a
            href="/billing"
            className="underline hover:text-foreground transition-colors"
          >
            Upgrade your plan
          </a>{" "}
          for more interview sessions.
        </p>
      )}

      <div
        className={`grid gap-4 ${showEditor ? "lg:grid-cols-2" : "grid-cols-1"}`}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          currentStep={currentStep}
          onSend={handleSend}
          onAdvanceStep={handleAdvanceStep}
          onComplete={handleComplete}
        />
        {showEditor && <CodeEditor value={code} onChange={handleCodeChange} />}
      </div>
    </div>
  );
}
