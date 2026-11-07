import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES, type Category, type Listing, type ListingType } from "@/lib/types";
import { actions } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AvailabilityPicker } from "@/components/availability-picker";
import { ImageUploader } from "@/components/image-uploader";
import { uploadListingImage } from "@/firebase";
import { AlertCircle, Gift, Loader2, Megaphone, Repeat2, Tag, Wrench, Check } from "lucide-react";

interface EditListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
}

const typeOptions: { value: ListingType; label: string; hint: string; icon: typeof Tag }[] = [
  { value: "sell", label: "Sell", hint: "Set a price and sell it", icon: Tag },
  { value: "exchange", label: "Exchange", hint: "Swap for something you need", icon: Repeat2 },
  { value: "giveaway", label: "Give Away", hint: "Free to a good home", icon: Gift },
  {
    value: "service",
    label: "Offer a Service",
    hint: "Tutoring, repairs, design help",
    icon: Wrench,
  },
  { value: "request", label: "Request Something", hint: "Ask the campus for it", icon: Megaphone },
];

const conditions = ["New", "Like new", "Excellent", "Very good", "Good", "Fair", "Any"];

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground";

export function EditListingModal({ open, onOpenChange, listing }: EditListingModalProps) {
  const { profile } = useAuth();
  const [type, setType] = useState<ListingType>(listing.type);
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [category, setCategory] = useState<Category>(listing.category);
  const [condition, setCondition] = useState(listing.condition);
  const [price, setPrice] = useState(listing.price !== undefined ? String(listing.price) : "");
  const [exchangePref, setExchangePref] = useState(listing.exchangePref || "");
  const [availability, setAvailability] = useState(listing.availability || "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(listing.image);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhysical = type === "sell" || type === "exchange" || type === "giveaway";

  useEffect(() => {
    if (open) {
      setType(listing.type);
      setTitle(listing.title);
      setDescription(listing.description);
      setCategory(listing.category);
      setCondition(listing.condition);
      setPrice(listing.price !== undefined ? String(listing.price) : "");
      setExchangePref(listing.exchangePref || "");
      setAvailability(listing.availability || "");
      setImageUrl(listing.image);
      setSelectedFile(null);
      setError(null);
    }
  }, [open, listing]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) {
      setError("You must be signed in to edit this listing.");
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (!trimmedTitle || !trimmedDesc) {
      setError("Title and description cannot be empty.");
      return;
    }
    if (trimmedTitle.length < 3) {
      setError("Title must be at least 3 characters long.");
      return;
    }
    if (trimmedDesc.length < 3) {
      setError("Description must be at least 3 characters long.");
      return;
    }
    if (type === "sell" && (!price.trim() || Number(price) < 0 || isNaN(Number(price)))) {
      setError("Please set a valid price (zero or greater) for items for sale.");
      return;
    }

    if (isPhysical && !imageUrl && !selectedFile) {
      setError("A real photo is required for physical items (sell, exchange, or giveaway).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let finalImage = imageUrl;
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        try {
          finalImage = await uploadListingImage(selectedFile, profile.uid, (p) => {
            setUploadProgress(p);
          });
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Failed to upload photo. Please check your image and try again.";
          setError(msg);
          setLoading(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      await actions.updateListing(
        listing.id,
        {
          title: trimmedTitle,
          description: trimmedDesc,
          category,
          condition,
          type,
          price: type === "sell" ? Number(price) : undefined,
          exchangePref:
            type !== "sell" && type !== "giveaway" ? exchangePref.trim() || undefined : undefined,
          availability: availability.trim() || "Flexible",
          image: finalImage,
        },
        profile.uid,
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update listing.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const showPrice = type === "sell";
  const showExchangePref = type === "exchange" || type === "service" || type === "request";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card p-6 sm:max-w-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold tracking-tight">
            Edit Listing
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update details, pricing, trade preferences, or photos for this item.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          {/* Listing type options */}
          <div>
            <span className={labelCls}>What are you doing?</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors ${
                      active
                        ? "border-primary bg-accent ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[9px] leading-tight text-muted-foreground">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="edit-title" className={labelCls}>
              Title
            </label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              maxLength={80}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-description" className={labelCls}>
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-category" className={labelCls}>
                Category
              </label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-condition" className={labelCls}>
                Condition
              </label>
              <select
                id="edit-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={inputCls}
              >
                {conditions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showPrice && (
            <div>
              <label htmlFor="edit-price" className={labelCls}>
                Price (₹)
              </label>
              <input
                id="edit-price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          )}

          {showExchangePref && (
            <div>
              <label htmlFor="edit-exchangePref" className={labelCls}>
                {type === "request"
                  ? "What can you offer in return?"
                  : "What would you take in exchange?"}
              </label>
              <input
                id="edit-exchangePref"
                value={exchangePref}
                onChange={(e) => setExchangePref(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label htmlFor="edit-availability" className={labelCls}>
              Availability / pickup
            </label>
            <AvailabilityPicker
              id="edit-availability"
              value={availability}
              onChange={setAvailability}
            />
          </div>

          <div>
            <span className={labelCls}>Item Photo</span>
            <ImageUploader
              previewFile={selectedFile}
              value={imageUrl}
              onFileSelect={(file) => {
                setSelectedFile(file);
                if (!file) setImageUrl(undefined);
              }}
              required={isPhysical}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              disabled={loading}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isPhysical
                ? "Physical goods (sell, exchange, giveaway) require at least one real photo."
                : "Photos are optional for services and requests."}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving changes…
                </>
              ) : (
                <>
                  <Check className="size-3.5" /> Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
