"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MAX_CHARS = 10_000;

interface ProofreadInputProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export function ProofreadInput({
  value,
  onChange,
  onSubmit,
  isProcessing,
}: ProofreadInputProps) {
  const handleSubmit = () => {
    if (!value.trim() || isProcessing) return;
    onSubmit();
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Original Text
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Paste your text here (e.g. 'I goes to the store yesterday')"
          className="min-h-[200px] resize-y text-base p-4"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          disabled={isProcessing}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {value.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!value.trim() || isProcessing}
            size="lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                Proofread Text
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
