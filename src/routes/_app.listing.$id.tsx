import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock,
  ImageOff,
  MessageSquare,
  Repeat2,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { ListingCard } from "@/components/listing-card";
import { Avatar, MatchPill, priceLabel, Stars, TypeBadge } from "@/components/ui-bits";
import { currentUser, getStudent, timeAgo } from "@/lib/data";
import { matchForListing } from "@/lib/matching";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing — REXchange" },
      { name: "description", content: "Listing details, owner reputation, and AI match insight on REXchange." },
      { property: "og:title", content: "Listing — REXchange" },
      { property: "og:description", content: "Listing details and AI match insight." },
    ],
  }),
  component: ListingDetailPage,
});

function ListingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { listings } = useAppState();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");

  const listing = listings.find((l) => l.id === id);
  const match = useMemo(
    () => (listing ? matchForListing(listing, listings) : undefined),
    [listing, listings],
  );
  const similar = useMemo(
    () =>
      listing
        ? listings.filter((l) => l.id !== listing.id && l.category === listing.category).slice(0, 3)
        : [],
    [listing, listings],
  );

  if (!listing) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          <h1 className="font-heading text-xl font-bold">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been exchanged already — these things move fast on campus.
          </p>
          <Link
            to="/explore"
            search={{ q: "", cat: "All", types: "", sort: "newest" }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="size-4" /> Back to explore
          </Link>
        </div>
      </PageContainer>
    );
  }

  const owner = getStudent(listing.ownerId);
  const isMine = listing.ownerId === currentUser.id;

  function messageOwner() {
    if (!listing) return;
    const threadId = actions.startThread(owner.id, listing.id, listing.title, "");
    navigate({ to: "/messages", search: { thread: threadId, tab: "chats" } });
  }

  function sendRequest() {
    if (!listing) return;
    const text =
      requestText.trim() ||
      `Hi ${owner.name.split(" ")[0]}! I'm interested in “${listing.title}”. Is it still available?`;
    const threadId = actions.sendExchangeRequest(owner.id, listing.id, `Request: ${listing.title}`, text);
    navigate({ to: "/messages", search: { thread: threadId, tab: "requests" } });
  }

  const meta: { label: string; value: string }[] = [
    { label: "Category", value: listing.category },
    { label: "Condition", value: listing.condition },
    { label: "Department", value: listing.department },
    { label: "Year", value: listing.year },
    { label: "Availability", value: listing.availability },
    { label: "Posted", value: timeAgo(listing.postedHours) },
  ];

  return (
    <PageContainer>
      <Link
        to="/explore"
        search={{ q: "", cat: "All", types: "", sort: "newest" }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to explore
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-5">
        {/* Image + description */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
            {listing.image ? (
              <img
                src={listing.image}
                alt={listing.title}
                width={800}
                height={600}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[4/3] w-full place-items-center text-muted-foreground">
                <ImageOff className="size-10" />
              </div>
            )}
            <div className="absolute left-4 top-4 flex gap-2">
              <TypeBadge type={listing.type} />
              <span className="rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground backdrop-blur-sm">
                {listing.condition}
              </span>
            </div>
            {match && (
              <div className="absolute right-4 top-4">
                <MatchPill score={match.score} />
              </div>
            )}
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-bold">About this listing</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
          </section>

          {match && (
            <section className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-primary-foreground">
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-card/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles className="size-3" /> Why this matches you
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-card/25 bg-card/10 px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-xl font-bold">{match.score}%</span>
                    <span className="text-[9px] leading-tight opacity-80">
                      MATCH
                      <br />
                      SCORE
                    </span>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {match.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-sm text-primary-foreground/90">
                      <Check className="mt-0.5 size-4 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-card/5" />
            </section>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-5 lg:col-span-2">
          <div>
            <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-balance sm:text-3xl">
              {listing.title}
            </h1>
            <p className="mt-2 text-lg font-bold text-primary">{priceLabel(listing)}</p>
            {listing.exchangePref && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Repeat2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {listing.exchangePref}
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> {listing.availability}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {meta.map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Owner card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Avatar student={owner} className="size-12 text-sm" />
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-bold">{owner.name}</p>
                <div className="flex items-center gap-1.5">
                  <Stars rating={owner.rating} />
                  <span className="text-xs text-muted-foreground">
                    {owner.rating.toFixed(1)} · {owner.exchanges} exchanges
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {owner.department} · {owner.year}
                </p>
              </div>
            </div>

            {isMine ? (
              <div className="mt-4 space-y-2">
                <p className="rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-accent-foreground">
                  This is your listing
                </p>
                <button
                  type="button"
                  onClick={() => {
                    actions.removeListing(listing.id);
                    navigate({ to: "/dashboard" });
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" /> Remove listing
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={messageOwner}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
                >
                  <MessageSquare className="size-4" /> Message {owner.name.split(" ")[0]}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestOpen((v) => !v)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent"
                >
                  <Repeat2 className="size-4" />
                  {listing.type === "request"
                    ? "Make an offer"
                    : listing.type === "sell"
                      ? "Request to buy"
                      : "Request exchange"}
                </button>
                {requestOpen && (
                  <div className="animate-rise space-y-2 rounded-xl border border-border bg-muted/50 p-3">
                    <textarea
                      value={requestText}
                      onChange={(e) => setRequestText(e.target.value)}
                      rows={3}
                      placeholder={`Hi ${owner.name.split(" ")[0]}! I'm interested…`}
                      className="w-full resize-none rounded-lg border border-border bg-card p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={sendRequest}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
                    >
                      <Send className="size-4" /> Send request
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Similar listings */}
      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            More in {listing.category}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {similar.map((l, i) => (
              <ListingCard key={l.id} listing={l} matchScore={matchForListing(l, listings)?.score} delay={i * 60} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
