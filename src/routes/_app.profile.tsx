import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BadgeCheck, Plus, Trash2, Zap } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { ListingCard } from "@/components/listing-card";
import { Avatar, Stars, StatCard } from "@/components/ui-bits";
import { currentUser } from "@/lib/data";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Aishwarya — Profile & Reputation — REXchange" },
      { name: "description", content: "Student profile with active listings, completed exchanges, and campus reputation reviews." },
      { property: "og:title", content: "Aishwarya — REXchange" },
      { property: "og:description", content: "Student profile, listings, and reputation." },
    ],
  }),
  component: ProfilePage,
});

const trustBadges = [
  { icon: BadgeCheck, label: "Verified student", hint: "campus email confirmed" },
  { icon: Award, label: "Top exchanger", hint: "top 5% this semester" },
  { icon: Zap, label: "Fast responder", hint: "replies within an hour" },
];

function ProfilePage() {
  const { listings, reviews, completedThisSession } = useAppState();
  const myListings = listings.filter((l) => l.ownerId === currentUser.id);
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : currentUser.rating;
  const totalExchanges = currentUser.exchanges + completedThisSession;

  return (
    <PageContainer>
      {/* Header card */}
      <section className="animate-rise rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar student={currentUser} className="size-24 text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{currentUser.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentUser.department} · {currentUser.year} · Joined {currentUser.joined}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Stars rating={avgRating} className="size-4" />
              <span className="text-sm font-semibold">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">
                ({reviews.length} review{reviews.length === 1 ? "" : "s"})
              </span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {currentUser.bio}
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark sm:self-center"
          >
            <Plus className="size-4" /> Post a listing
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          {trustBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                title={badge.hint}
              >
                <Icon className="size-3.5" /> {badge.label}
              </span>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reputation" value={avgRating.toFixed(1)} hint="★ average rating" />
        <StatCard label="Completed exchanges" value={String(totalExchanges)} hint="and counting" delay={50} />
        <StatCard label="Active listings" value={String(myListings.length)} hint="live right now" delay={100} />
        <StatCard
          label="Trust level"
          value={totalExchanges >= 15 ? "Gold" : "Silver"}
          hint="next: Platinum at 30"
          delay={150}
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Listings */}
        <section>
          <h2 className="font-heading text-xl font-bold tracking-tight">
            {currentUser.name.split(" ")[0]}'s listings
          </h2>
          {myListings.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No active listings right now.</p>
              <Link
                to="/create"
                className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Create one
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {myListings.map((listing, i) => (
                <div key={listing.id} className="relative">
                  <ListingCard listing={listing} delay={i * 60} />
                  <button
                    type="button"
                    onClick={() => actions.removeListing(listing.id)}
                    className="absolute bottom-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-destructive"
                    aria-label={`Remove ${listing.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <h2 className="font-heading text-xl font-bold tracking-tight">Reputation & reviews</h2>
          <div className="mt-4 space-y-3">
            {reviews.map((review, i) => (
              <div
                key={review.id}
                className="animate-rise rounded-2xl border border-border bg-card p-4"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{review.fromName}</p>
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {review.date}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-accent p-4">
            <p className="text-xs font-semibold text-accent-foreground">How reputation works</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              After each completed exchange, both students rate each other. Consistent 5-star
              trades unlock trust badges and boost your listings in AI matching.
            </p>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
