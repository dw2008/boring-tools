"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: "usage-limit" | "manual";
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
          renderButton: (
            element: HTMLElement,
            config: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

export function AuthModal({
  open,
  onOpenChange,
  trigger = "manual",
}: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef<(response: { credential: string }) => void>(undefined);

  // Keep callbackRef in sync so the GIS callback always has fresh closures
  callbackRef.current = async (response: { credential: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });
      if (signInError) {
        console.error("Sign-in error:", signInError);
        setError("Sign-in failed. Please try again.");
        setIsLoading(false);
        return;
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Sign-in error:", err);
      setError("Sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Callback ref: renders the Google button as soon as the div mounts
  const googleButtonRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !open) return;

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError("Google sign-in is not configured.");
        return;
      }

      function tryRender() {
        if (!window.google || !node) return false;

        window.google.accounts.id.initialize({
          client_id: clientId!,
          callback: (resp) => callbackRef.current?.(resp),
        });

        window.google.accounts.id.renderButton(node, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 350,
        });
        return true;
      }

      if (tryRender()) return;

      // GIS script still loading — poll until ready
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 100);

      // Clean up if component unmounts before script loads
      const cleanup = () => clearInterval(interval);
      node.addEventListener("remove", cleanup, { once: true });
    },
    [open] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {trigger === "usage-limit"
              ? "Sign in to continue"
              : "Sign in to boringtools"}
          </DialogTitle>
          <DialogDescription>
            {trigger === "usage-limit"
              ? "You've reached your usage limit. Sign in with Google to continue."
              : "Sign in with your Google account to get access to all tools."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div ref={googleButtonRef} className="min-h-[44px]" />
          {isLoading && (
            <p className="text-sm text-muted-foreground">Signing in...</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
