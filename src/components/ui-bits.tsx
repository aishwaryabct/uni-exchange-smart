import { Sparkles, Star } from "lucide-react";
import type { Listing, ListingType, Student } from "@/lib/types";

export function Avatar({
  student,
  className = "size-8 text-xs",
}: {
  student: Student;
  className?: string;
}) {
  return (
    <div
      className={`grid shrink-0 select-none place-items-center rounded-full font-bold ${className}`}
      style={{ backgroundColor: student.color, color: "#ffffff" }}
      aria-hidden
    >
      {student.initials}
    </div>
  );
}

const typeConfig: Record<ListingType, { label: string; className: string }> = {
  sell: { label: "SELL", className: "bg-ink text-ink-foreground" },
  exchange: { label: "EXCHANGE", className: "bg-primary text-primary-foreground" },
  giveaway: { label: "GIVE AWAY", className: "bg-mint text-mint-foreground" },
  service: { label: "SERVICE", className: "bg-amber text-amber-foreground" },
  request: { label: "REQUEST", className: "bg-foreground text-background" },
};

export function TypeBadge({ type, className = "" }: { type: ListingType; className?: string }) {
  const config = typeConfig[type];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide shadow-sm ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

export function MatchPill({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm backdrop-blur-sm">
      <Sparkles className="size-3 text-primary" />
      {score}% AI Match
    </span>
  );
}

export function Stars({ rating, className = "size-3.5" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${
            i <= Math.round(rating) ? "fill-amber text-amber" : "fill-border text-border"
          }`}
        />
      ))}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110"
          aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
        >
          <Star
            className={`size-6 ${i <= value ? "fill-amber text-amber" : "fill-border text-border"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function priceLabel(listing: Listing): string {
  switch (listing.type) {
    case "sell":
      return listing.price != null ? `$${listing.price}` : "For sale";
    case "exchange":
      return "Open to swap";
    case "giveaway":
      return "Free";
    case "service":
      return "Book a slot";
    case "request":
      return "Wanted";
  }
}

export function StatCard({
  label,
  value,
  hint,
  delay = 0,
}: {
  label: string;
  value: string;
  hint: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-rise rounded-2xl border border-border bg-card p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-primary">{hint}</p>
    </div>
  );
}
