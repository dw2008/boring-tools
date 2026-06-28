"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Upload, ArrowRight, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp";

interface NotesUploadProps {
  file: File | null;
  previewUrl: string | null;
  onFileSelected: (file: File | null) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export function NotesUpload({
  file,
  previewUrl,
  onFileSelected,
  onSubmit,
  isProcessing,
}: NotesUploadProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePick = (picked: File | undefined) => {
    setLocalError(null);
    if (!picked) {
      onFileSelected(null);
      return;
    }
    if (!ACCEPTED.split(",").includes(picked.type)) {
      setLocalError("Image must be JPEG, PNG, or WebP.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setLocalError("Image must be 10MB or smaller.");
      return;
    }
    onFileSelected(picked);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Page or notes photo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!file ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Upload a photo of a book page or handwritten notes. Diagrams and
              figures on the page get captured too. Clear handwriting and a
              sharp, well-lit image work best — fuzzy or low-quality photos
              produce weaker results.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button
                size="lg"
                onClick={() => cameraRef.current?.click()}
                disabled={isProcessing}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take photo
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => galleryRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose file
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept={ACCEPTED}
              capture="environment"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full max-h-[400px] overflow-hidden rounded-md border bg-muted">
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Selected page"
                  width={800}
                  height={600}
                  className="w-full h-auto max-h-[400px] object-contain"
                  unoptimized
                />
              )}
              {!isProcessing && (
                <button
                  onClick={() => onFileSelected(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </span>
              <Button onClick={onSubmit} disabled={isProcessing} size="lg">
                {isProcessing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Reading...
                  </>
                ) : (
                  <>
                    Digitize
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        {localError && (
          <p className="text-sm text-destructive mt-3">{localError}</p>
        )}
      </CardContent>
    </Card>
  );
}
