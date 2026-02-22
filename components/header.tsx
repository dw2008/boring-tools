import Link from "next/link";
import { Wrench, PenTool } from "lucide-react";
import { UserMenu } from "@/components/user-menu";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Wrench className="h-5 w-5" />
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
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
