import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";
import { getStudent, timeAgo } from "@/lib/data";
import type { Listing } from "@/lib/types";
import { Avatar, MatchPill, priceLabel, TypeBadge } from "./ui-bits";

export function ListingCard({
  listing,
  matchScore,
  delay = 0,
}: {
  listing: Listing;
  matchScore?: number;
  delay?: number;
}) {
  const owner = getStudent(listing.ownerId);

  return (
    <Link
      to="/listing/$id"
      params={{ id: listing.id }}
      className="card-hover group animate-rise relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {listing.image ? (
          <img
            src={listing.image}
            alt={listing.title}
            loading="lazy"
            width={800}
            height={600}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <TypeBadge type={listing.type} />
        </div>
        {matchScore != null && (
          <div className="absolute right-3 top-3">
            <MatchPill score={matchScore} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold uppercase text-muted-foreground">
            {listing.category} · {listing.department}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            {timeAgo(listing.postedHours)}
          </span>
        </div>
        <h3 className="font-heading text-lg font-bold leading-snug transition-colors group-hover:text-primary">
          {listing.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{listing.description}</p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3.5 [margin-top:auto]">
          <div className="mt-3.5 flex items-center gap-2">
            <Avatar student={owner} className="size-6 text-[9px]" />
            <span className="text-xs font-medium">{owner.name.split(" ")[0]} {owner.name.split(" ")[1]?.[0]}.</span>
          </div>
          <span className="mt-3.5 text-xs font-bold text-primary">{priceLabel(listing)}</span>
        </div>
      </div>
    </Link>
  );
}
