import Link from "next/link";
import { PenTool, Code, Crown } from "lucide-react";
import { UserMenu } from "@/components/user-menu";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="boringtools" className="h-5 w-5 rounded" />
          <span>boringtools</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/proofread"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <PenTool className="h-4 w-4" />
            Proofread
          </Link>
          <Link
            href="/interview"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code className="h-4 w-4" />
            Interview Prep
          </Link>
          <Link
            href="/chess"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Crown className="h-4 w-4" />
            Chess
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
