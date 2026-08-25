import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, MessageSquare, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { Avatar, TypeBadge } from "@/components/ui-bits";
import { currentUser, getStudent } from "@/lib/data";
import { computeMatches } from "@/lib/matching";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/matches")({
  head: () => ({
    meta: [
      { title: "AI Match — REXchange" },
      { name: "description", content: "AI-powered matching between your requests and campus listings, with match scores and explanations." },
      { property: "og:title", content: "AI Match — REXchange" },
      { property: "og:description", content: "AI-powered campus exchange matching." },
    ],
  }),
  component: MatchesPage,
});

function scoreTone(score: number): string {
  if (score >= 90) return "text-mint";
  if (score >= 75) return "text-primary";
  return "text-amber";
}

function MatchesPage() {
  const navigate = useNavigate();
  const { listings } = useAppState();
  const [boost, setBoost] = useState("");

  const matches = useMemo(() => computeMatches(listings, boost), [listings, boost]);
  const myRequests = listings.filter((l) => l.ownerId === currentUser.id && l.type === "request");

  function messageOwner(listingId: string, ownerId: string, title: string) {
    const threadId = actions.startThread(ownerId, listingId, title, "");
    navigate({ to: "/messages", search: { thread: threadId, tab: "chats" } });
  }

  return (
    <PageContainer>
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-primary-foreground shadow-xl sm:p-8">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-mint" /> AI Engine Active
          </span>
          <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">
            Your things found their people
          </h1>
          <p className="mt-1 max-w-xl text-sm text-primary-foreground/85">
            REX AI reads your requests, offers, department, and schedule — then ranks every live
            campus listing by how well it fits you.
          </p>
          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-foreground/60" />
            <input
              value={boost}
              onChange={(e) => setBoost(e.target.value)}
              placeholder="Refine matches — try “statistics textbook” or “tutoring”"
              className="w-full rounded-full border border-card/25 bg-card/10 py-2.5 pl-10 pr-4 text-sm placeholder:text-primary-foreground/60 focus:outline-none focus:ring-2 focus:ring-card/50 backdrop-blur-sm"
            />
          </div>
        </div>
        <div className="absolute -top-16 right-0 size-64 translate-x-1/4 rounded-full bg-card/5" />
      </section>

      {/* Active requests */}
      {myRequests.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Matching against your requests:
          </span>
          {myRequests.map((r) => (
            <Link
              key={r.id}
              to="/listing/$id"
              params={{ id: r.id }}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              {r.title}
            </Link>
          ))}
        </div>
      )}

      {/* Match list */}
      <section className="mt-8">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{matches.length}</span> matches found
          {boost && (
            <>
              {" "}
              for “<span className="font-medium text-foreground">{boost}</span>”
            </>
          )}
        </p>

        {matches.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-heading text-lg font-bold">No matches yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Post a request for something you need — the AI matches new listings against it
              instantly.
            </p>
            <Link
              to="/create"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              Post a request
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {matches.map(({ listing, score, reasons }, i) => {
              const owner = getStudent(listing.ownerId);
              return (
                <article
                  key={listing.id}
                  className="card-hover animate-rise flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                  style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                >
                  {listing.image && (
                    <Link
                      to="/listing/$id"
                      params={{ id: listing.id }}
                      className="shrink-0 overflow-hidden rounded-xl"
                    >
                      <img
                        src={listing.image}
                        alt={listing.title}
                        loading="lazy"
                        width={800}
                        height={600}
                        className="h-32 w-full object-cover sm:h-28 sm:w-36"
                      />
                    </Link>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={listing.type} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {listing.category} · {listing.department}
                      </span>
                    </div>
                    <Link to="/listing/$id" params={{ id: listing.id }}>
                      <h3 className="mt-1.5 font-heading text-lg font-bold leading-snug transition-colors hover:text-primary">
                        {listing.title}
                      </h3>
                    </Link>
                    <ul className="mt-2 space-y-1">
                      {reasons.slice(0, 3).map((reason) => (
                        <li
                          key={reason}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
                          <Check className="mt-0.5 size-3.5 shrink-0 text-mint" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-2">
                      <Avatar student={owner} className="size-6 text-[9px]" />
                      <span className="text-xs font-medium">{owner.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ★ {owner.rating.toFixed(1)} · {owner.exchanges} exchanges
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-3">
                    <div className="rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-center">
                      <p className={`font-heading text-2xl font-bold ${scoreTone(score)}`}>{score}%</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Match score
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to="/listing/$id"
                        params={{ id: listing.id }}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => messageOwner(listing.id, listing.ownerId, listing.title)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
                      >
                        <MessageSquare className="size-3.5" /> Message
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
