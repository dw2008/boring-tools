import type { Metadata } from "next";
import { ChessClient } from "./_components/chess-client";

export const metadata: Metadata = {
  title: "Chess — boringtools",
  description: "Play chess against an AI engine with real-time strategic commentary.",
};

export default function ChessPage() {
  return <ChessClient />;
}
