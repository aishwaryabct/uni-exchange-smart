import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, LogIn, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { AuthModal } from "@/components/auth-modal";
import { ListingCard } from "@/components/listing-card";
import { priceLabel, StatCard, TypeBadge } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/data";
import { computeMatches } from "@/lib/matching";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — REXchange" },
      {
        name: "description",
        content:
          "Your campus exchange command center: listings, AI matches, and reputation at a glance.",
      },
      { property: "og:title", content: "Dashboard — REXchange" },
      { property: "og:description", content: "Your campus exchange command center." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { listings, reviews, completedThisSession } = useAppState();
  const { profile, isLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const myListings = profile ? listings.filter((l) => l.ownerId === profile.uid) : [];
  const matches = useMemo(() => computeMatches(listings, "", profile), [listings, profile]);
  const topMatch = matches[0];
  const fresh = useMemo(
    () =>
      listings
        .filter((l) => (profile ? l.ownerId !== profile.uid : true))
        .slice()
        .sort((a, b) => a.postedHours - b.postedHours)
        .slice(0, 6),
    [listings, profile],
  );

  const handleDelete = async (id: string) => {
    if (!profile) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      const res = await actions.removeListing(id, profile.uid);
      if (!res.success) {
        setDeleteError(res.error || "Failed to remove listing.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove listing.";
      setDeleteError(msg);
    } finally {
      setDeletingId(null);
    }
  };
  const avgRating = profile
    ? reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : profile.rating.toFixed(1)
    : "—";

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Command center</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {isLoading
              ? "Command center"
              : profile
                ? `Welcome back, ${profile.name.split(" ")[0]}`
                : "Welcome to REXchange"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your campus dashboard..."
              : profile
                ? `${profile.department} · ${profile.year} · North Campus`
                : "North Campus Student Community · Free peer-to-peer trades"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !profile && (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <LogIn className="size-4 text-primary" /> Sign In
            </button>
          )}
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" /> Post a listing
          </Link>
        </div>
      </div>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active listings"
          value={isLoading ? "—" : profile ? String(myListings.length) : "—"}
          hint={isLoading ? "Checking..." : profile ? "yours, live now" : "sign in to view"}
        />
        <StatCard
          label="Completed exchanges"
          value={isLoading ? "—" : profile ? String(profile.exchanges + completedThisSession) : "—"}
          hint={isLoading ? "Checking..." : profile ? "this semester" : "sign in to track"}
          delay={50}
        />
        <StatCard
          label="Average rating"
          value={isLoading ? "—" : avgRating}
          hint={isLoading ? "Checking..." : profile ? "★★★★★ campus rep" : "sign in to view rep"}
          delay={100}
        />
        <StatCard
          label="AI matches found"
          value={isLoading ? "—" : String(matches.length)}
          hint={isLoading ? "Checking..." : profile ? "updated just now" : "campus-wide"}
          delay={150}
        />
      </section>

      {/* AI match banner */}
      {topMatch && (
        <section className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-primary-foreground shadow-xl sm:p-8">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="size-3" /> AI Engine Active
            </span>
            <h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">
              We found a {topMatch.score}% match for you
            </h2>
            <p className="mt-1 max-w-xl text-sm text-primary-foreground/85">
              “{topMatch.listing.title}” —{" "}
              {topMatch.reasons[0]?.toLowerCase() ?? "recommended for you"}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-card/25 bg-card/10 px-4 py-2.5 backdrop-blur-sm">
                <span className="text-2xl font-bold">{topMatch.score}%</span>
                <span className="text-[10px] leading-tight opacity-80">
                  MATCH
                  <br />
                  SCORE
                </span>
              </div>
              <Link
                to="/listing/$id"
                params={{ id: topMatch.listing.id }}
                className="rounded-lg bg-card px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-background"
              >
                View match details
              </Link>
              <Link
                to="/matches"
                className="inline-flex items-center gap-1 rounded-lg border border-card/30 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-card/10"
              >
                All matches <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="absolute -top-16 right-0 size-64 translate-x-1/4 rounded-full bg-card/5" />
          <div className="absolute -bottom-10 right-12 size-48 rounded-full bg-primary-foreground/10 blur-3xl" />
        </section>
      )}

      {/* Your listings */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold tracking-tight">Your listings</h2>
          <Link to="/create" className="text-sm font-semibold text-primary hover:text-primary-dark">
            Post new →
          </Link>
        </div>

        {deleteError && (
          <div
            role="alert"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading your listings...</p>
          </div>
        ) : !profile ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Sign in to manage your listings and see them here.
            </p>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              <LogIn className="size-4" /> Sign in to view your listings
            </button>
          </div>
        ) : myListings.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Nothing posted yet — your unused stuff is someone else's treasure.
            </p>
            <Link
              to="/create"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Create your first listing
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {myListings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-3"
              >
                <Link
                  to="/listing/$id"
                  params={{ id: listing.id }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {listing.image && (
                    <img
                      src={listing.image}
                      alt={listing.title}
                      loading="lazy"
                      width={800}
                      height={600}
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {listing.category} · {timeAgo(listing.postedHours)}
                    </p>
                  </div>
                  <TypeBadge type={listing.type} className="hidden sm:inline-flex" />
                  <span className="hidden text-xs font-bold text-primary md:block">
                    {priceLabel(listing)}
                  </span>
                </Link>
                {Boolean(profile && listing.ownerId === profile.uid) && (
                  <button
                    type="button"
                    disabled={deletingId === listing.id}
                    onClick={() => handleDelete(listing.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${listing.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fresh on campus */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold tracking-tight">Fresh on campus</h2>
          <Link
            to="/explore"
            search={{ q: "", cat: "All", types: "", sort: "newest" }}
            className="text-sm font-semibold text-primary hover:text-primary-dark"
          >
            Explore all →
          </Link>
        </div>
        {fresh.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="font-heading text-base font-bold">No community listings yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Be the first to share textbooks, electronics, notes, or offer a peer skill on your
              campus.
            </p>
            <Link
              to="/create"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              <Plus className="size-4" /> Post a listing
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {fresh.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} delay={i * 60} />
            ))}
          </div>
        )}
      </section>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </PageContainer>
  );
}
