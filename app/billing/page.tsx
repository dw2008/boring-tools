import type { Metadata } from "next";
import { PricingCards } from "@/components/pricing-cards";

export const metadata: Metadata = {
  title: "Billing | boringtools",
  description: "Manage your subscription and billing.",
};

export default function BillingPage() {
  return (
    <div className="container max-w-4xl py-10 px-4 space-y-8">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Choose a plan that fits your needs.
        </p>
      </div>
      <PricingCards />
    </div>
  );
}
