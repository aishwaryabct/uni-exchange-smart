import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Award,
  BadgeCheck,
  Edit3,
  Loader2,
  LogIn,
  Plus,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { AuthModal } from "@/components/auth-modal";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { ListingCard } from "@/components/listing-card";
import { Avatar, Stars, StatCard } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile & Reputation — REXchange" },
      {
        name: "description",
        content:
          "Student profile with active listings, completed exchanges, and campus reputation reviews.",
      },
      { property: "og:title", content: "Student Profile — REXchange" },
      { property: "og:description", content: "Student profile, listings, and reputation." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { listings, reviews, completedThisSession } = useAppState();
  const { profile, isLoading } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!profile || deletingId) return;
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

  // 1. Loading state prevents flicker of the guest view while auth state is resolving
  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 py-16 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading your campus profile…</p>
        </div>
      </PageContainer>
    );
  }

  // 2. Unauthenticated guest placeholder
  if (!profile) {
    return (
      <PageContainer>
        <section className="animate-rise mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <User className="size-8" />
          </div>

          <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Sign in to view your campus profile
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Join the REXchange campus marketplace with your university account to manage your
            listings, view your peer reviews, track completed exchanges, and build your campus
            reputation.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary-dark"
            >
              <LogIn className="size-4" /> Sign In / Join Campus
            </button>
            <Link
              to="/explore"
              search={{ q: "", cat: "All", types: "", sort: "newest" }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Browse Campus Listings
            </Link>
          </div>

          {/* Value highlights */}
          <div className="mt-10 grid grid-cols-1 gap-4 border-t border-border pt-8 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <BadgeCheck className="size-4 shrink-0" /> Verified Identity
              </div>
              <p className="mt-1.5 text-[11px] leading-normal text-muted-foreground">
                Trade safely with real, verified students from your campus.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Award className="size-4 shrink-0" /> Campus Reputation
              </div>
              <p className="mt-1.5 text-[11px] leading-normal text-muted-foreground">
                Earn ratings, peer feedback, and exchange badges with every trade.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Zap className="size-4 shrink-0" /> AI Matched Gear
              </div>
              <p className="mt-1.5 text-[11px] leading-normal text-muted-foreground">
                Automatically match what you need with what classmates offer.
              </p>
            </div>
          </div>
        </section>

        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </PageContainer>
    );
  }

  // 3. Authenticated student profile
  const myListings = listings.filter((l) => l.ownerId === profile.uid);
  const avgRating = profile.rating;
  const totalExchanges = (profile.exchanges || 0) + completedThisSession;

  const trustBadges = [
    { icon: BadgeCheck, label: "Verified student", hint: "Campus email confirmed" },
    {
      icon: Award,
      label: totalExchanges >= 5 ? "Active exchanger" : "Campus member",
      hint: `${totalExchanges} completed trades`,
    },
    { icon: Zap, label: "Fast responder", hint: "Active on REXchange" },
  ];

  return (
    <PageContainer>
      {/* Header card */}
      <section className="animate-rise rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar student={profile} className="size-24 text-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight">{profile.name}</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                Verified Student
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.department} · {profile.year} · Joined {profile.joined}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Stars rating={avgRating} className="size-4" />
              <span className="text-sm font-semibold">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">
                ({reviews.length} review{reviews.length === 1 ? "" : "s"})
              </span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:self-center">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Edit3 className="size-3.5" /> Edit profile
            </button>
            <Link
              to="/create"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              <Plus className="size-3.5" /> Post a listing
            </Link>
          </div>
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
        <StatCard label="Reputation" value={avgRating.toFixed(1)} hint="★ campus rating" />
        <StatCard
          label="Completed exchanges"
          value={String(totalExchanges)}
          hint="and counting"
          delay={50}
        />
        <StatCard
          label="Active listings"
          value={String(myListings.length)}
          hint="live right now"
          delay={100}
        />
        <StatCard
          label="Trust level"
          value={totalExchanges >= 15 ? "Gold" : totalExchanges >= 5 ? "Silver" : "Bronze"}
          hint={totalExchanges >= 15 ? "Top tier" : "Next tier at 5 exchanges"}
          delay={150}
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Listings */}
        <section>
          <h2 className="font-heading text-xl font-bold tracking-tight">Your active listings</h2>

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
                  {listing.ownerId === profile.uid && (
                    <button
                      type="button"
                      disabled={deletingId === listing.id}
                      onClick={() => handleDelete(listing.id)}
                      className="absolute bottom-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-destructive disabled:opacity-50"
                      aria-label={`Remove ${listing.title}`}
                    >
                      {deletingId === listing.id ? (
                        <Loader2 className="size-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <h2 className="font-heading text-xl font-bold tracking-tight">Reputation & reviews</h2>
          {reviews.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">
                No reviews yet. Complete your first exchange with a classmate to receive feedback
                and build your campus reputation!
              </p>
            </div>
          ) : (
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
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {review.text}
                  </p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {review.date}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-xl bg-accent p-4">
            <p className="text-xs font-semibold text-accent-foreground">How reputation works</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              After each completed exchange, both students rate each other. Consistent 5-star trades
              unlock trust badges and boost your listings in AI matching.
            </p>
          </div>
        </section>
      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} profile={profile} />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </PageContainer>
  );
}
