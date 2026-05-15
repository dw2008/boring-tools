"use client";

import { useState, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ChatMessage } from "./chat-message";
import {
  UMPIRE_STEPS,
  UMPIRE_LABELS,
  type UmpireStep,
} from "@/lib/tools/interview/types";

interface ChatPanelProps {
  messages: UIMessage[];
  isLoading: boolean;
  currentStep: UmpireStep;
  onSend: (text: string) => void;
  onAdvanceStep: () => void;
  onComplete: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  currentStep,
  onSend,
  onAdvanceStep,
  onComplete,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const currentIndex = UMPIRE_STEPS.indexOf(currentStep);
  const nextStep = UMPIRE_STEPS[currentIndex + 1] as UmpireStep | undefined;
  const canAdvance = nextStep && messages.length >= 2;
  const isLastStep = currentStep === "evaluate";
  const canComplete = isLastStep && messages.length >= 2;

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="flex flex-col border rounded-lg" style={{ height: 600 }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const text = msg.parts
            .filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join("");
          return (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant"}
              content={text}
            />
          );
        })}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        {canAdvance && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAdvanceStep}
            className="w-full"
          >
            Move to {UMPIRE_LABELS[nextStep]}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
        {canComplete && (
          <Button
            size="sm"
            onClick={onComplete}
            className="w-full"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Finish Interview
          </Button>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type your response..."
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={2}
            disabled={isLoading}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
