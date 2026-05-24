"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

const CHESS_APP_URL =
  process.env.NEXT_PUBLIC_CHESS_APP_URL ?? "/chess-app/index.html";

type State = "idle" | "loading" | "playing" | "limit_reached" | "error";

export function ChessClient() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);

  async function startGame() {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/chess/start-game", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setState("playing");
      } else if (res.status === 403) {
        setErrorMsg(data.error ?? "Monthly limit reached.");
        setState("limit_reached");
      } else {
        setErrorMsg(data.error ?? "Something went wrong.");
        setState("error");
      }
    } catch {
      setErrorMsg("Could not connect. Please try again.");
      setState("error");
    }
  }

  if (state === "playing") {
    return (
      <div className="h-[calc(100dvh-3.5rem)] overflow-hidden">
        <iframe
          src={CHESS_APP_URL}
          className="w-full h-full border-0"
          title="Chess"
          allow="cross-origin-isolated"
        />
      </div>
    );
  }

  return (
    <>
      <div className="container max-w-lg py-20 px-4 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-muted p-4">
            <Crown className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Chess</h1>
          <p className="text-muted-foreground">
            Play against the boring engine with real-time AI commentary on every
            move.
          </p>
        </div>

        {state === "limit_reached" ? (
          <div className="w-full rounded-lg border border-border bg-muted/40 p-6 flex flex-col gap-4 text-center">
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button asChild>
              <a href="/billing">Upgrade plan</a>
            </Button>
          </div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" onClick={() => setState("idle")}>
              Try again
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={startGame}
            disabled={authLoading || state === "loading"}
            className="w-full max-w-xs"
          >
            {state === "loading" ? "Starting…" : user ? "Start game" : "Sign in to play"}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Free: 1 game/month · Basic: 15/month · Pro: unlimited
        </p>
      </div>

      <AuthModal
        open={authModalOpen}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          if (!open) setState("idle");
        }}
        trigger="manual"
      />
    </>
  );
}
