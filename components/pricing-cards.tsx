"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  tier: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    tier: "free",
    price: "$0",
    period: "",
    description: "Try it out",
    features: ["5 proofreads per month", "Grammar & style fixes"],
  },
  {
    name: "Basic",
    tier: "basic",
    price: "$1.99",
    period: "/month",
    description: "For regular use",
    features: ["200 proofreads per month", "Grammar & style fixes"],
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$5.99",
    period: "/month",
    description: "Unlimited access",
    features: ["Unlimited proofreads", "Grammar & style fixes"],
    highlight: true,
    badge: "Best value",
  },
];

const TIER_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };

interface PricingCardsProps {
  currentTier?: string;
}

export function PricingCards({ currentTier: initialTier }: PricingCardsProps) {
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState(initialTier);
  const [loadingTier, setLoadingTier] = useState(!initialTier);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setCurrentTier(undefined);
      setLoadingTier(false);
      return;
    }
    setLoadingTier(true);
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setCurrentTier(data?.subscription_tier ?? "free");
        setLoadingTier(false);
      });
  }, [user]);

  const isSubscribed = currentTier === "basic" || currentTier === "pro";
  const currentRank = TIER_RANK[currentTier ?? "free"] ?? 0;
  const visiblePlans = plans.filter((p) => TIER_RANK[p.tier] >= currentRank);

  async function handleSubscribe(tier: string) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setLoadingPlan(tier);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingPlan(null);
    }
  }

  async function handleManage() {
    setLoadingPlan("manage");
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingPlan(null);
    }
  }

  if (loadingTier) {
    return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <div className={`grid gap-6 ${visiblePlans.length === 3 ? "sm:grid-cols-3" : visiblePlans.length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" : "max-w-sm mx-auto"}`}>
        {visiblePlans.map((plan) => {
          const isCurrent = currentTier === plan.tier;

          return (
            <Card
              key={plan.name}
              className={plan.highlight ? "border-primary shadow-md" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.badge && (
                    <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">
                      {plan.period}
                    </span>
                  )}
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  isSubscribed ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManage}
                      disabled={loadingPlan === "manage"}
                    >
                      {loadingPlan === "manage"
                        ? "Loading..."
                        : "Manage subscription"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan
                    </Button>
                  )
                ) : plan.tier !== "free" ? (
                  currentTier === "basic" && plan.tier === "pro" ? (
                    <Button
                      className="w-full"
                      onClick={handleManage}
                      disabled={loadingPlan === "manage"}
                    >
                      {loadingPlan === "manage" ? "Loading..." : "Upgrade"}
                    </Button>
                  ) : isSubscribed ? null : (
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.tier)}
                      disabled={loadingPlan === plan.tier}
                    >
                      {loadingPlan === plan.tier
                        ? "Loading..."
                        : "Subscribe"}
                    </Button>
                  )
                ) : !user ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    Get started
                  </Button>
                ) : currentTier === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        trigger="manual"
      />
    </>
  );
}
