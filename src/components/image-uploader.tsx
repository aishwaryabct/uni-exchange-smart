import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Camera, Loader2, RefreshCw, Trash2, Upload, AlertCircle } from "lucide-react";

interface ImageUploaderProps {
  value?: string | undefined; // existing or uploaded image URL
  previewFile?: File | null;
  onFileSelect: (file: File | null) => void;
  required?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  disabled?: boolean;
  className?: string;
}

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ImageUploader({
  value,
  previewFile,
  onFileSelect,
  required = false,
  isUploading = false,
  uploadProgress = 0,
  disabled = false,
  className = "",
}: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Preview URL from newly selected File or existing URL
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Derive active display URL
  const activeUrl = previewFile ? localPreviewUrl : value || null;

  function validateAndSelect(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, WebP, or GIF).");
      return false;
    }

    if (file.size > MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`Image size (${sizeMb}MB) exceeds the 5MB limit. Please choose a smaller photo.`);
      return false;
    }

    // Clean up previous object URL if any
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    onFileSelect(file);
    return true;
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0]!;
      validateAndSelect(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0]!;
      validateAndSelect(file);
    }
  }

  function handleRemove() {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onFileSelect(null);
  }

  function triggerSelect() {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
        aria-label="Upload listing photo"
      />

      {/* Image Preview Card */}
      {activeUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            <img src={activeUrl} alt="Listing preview" className="size-full object-cover" />

            {/* Upload progress overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs p-4 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-2 text-xs font-bold text-foreground">
                  Uploading to Firebase Storage… {uploadProgress}%
                </p>
                <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isUploading && (
            <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-2.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[200px]">
                <Camera className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{previewFile ? previewFile.name : "Current photo"}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerSelect}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <RefreshCw className="size-3" /> Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Upload Area */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelect}
          className={`flex aspect-[16/9] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
          } ${disabled ? "pointer-events-none opacity-50" : ""}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              triggerSelect();
            }
          }}
        >
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-5" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">
            {required ? "Upload a real photo (Required)" : "Upload a photo (Optional)"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag and drop or click to browse from your device
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
              JPEG, PNG, WebP, GIF
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 font-medium">Max 5MB</span>
            {required && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-primary">
                Physical item requirement
              </span>
            )}
          </div>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
