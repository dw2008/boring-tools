import Link from "next/link";
import { PenTool, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const tools = [
  {
    title: "Proofreader",
    description:
      "Catch grammar errors without changing your style. Paste text, see a diff.",
    href: "/proofread",
    icon: PenTool,
  },
];

export default function HomePage() {
  return (
    <div className="container max-w-4xl py-20 px-4 space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple tools that do one thing well.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A collection of focused, no-nonsense utilities for everyday tasks.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <tool.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium inline-flex items-center gap-1">
                  Try it <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
