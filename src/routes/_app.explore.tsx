import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Filter, Search, ShieldCheck } from "lucide-react";
import { useMemo, type FormEvent } from "react";
import { z } from "zod";
import { PageContainer } from "@/components/app-shell";
import { ListingCard } from "@/components/listing-card";
import { getStudent } from "@/lib/data";
import { matchForListing } from "@/lib/matching";
import { useAppState } from "@/lib/store";
import { CATEGORIES, LISTING_TYPES, type Listing } from "@/lib/types";

const exploreSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "All").default("All"),
  types: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
});

export const Route = createFileRoute("/_app/explore")({
  validateSearch: zodValidator(exploreSearchSchema),
  head: () => ({
    meta: [
      { title: "Explore Marketplace — REXchange" },
      { name: "description", content: "Search and filter books, electronics, tickets, skills, giveaways, and requests from students on your campus." },
      { property: "og:title", content: "Explore Marketplace — REXchange" },
      { property: "og:description", content: "Search and filter campus listings across every category." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { q, cat, types, sort } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { listings } = useAppState();

  const activeTypes = types ? types.split(",").filter(Boolean) : [];

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of listings) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
    return counts;
  }, [listings]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let result = listings.filter((l) => {
      if (cat !== "All" && l.category !== cat) return false;
      if (activeTypes.length > 0 && !activeTypes.includes(l.type)) return false;
      if (query) {
        const haystack = [l.title, l.description, l.category, l.department, ...l.keywords]
          .join(" ")
          .toLowerCase();
        if (!query.split(/\s+/).every((token) => haystack.includes(token))) return false;
      }
      return true;
    });

    result = result.slice();
    switch (sort) {
      case "relevant":
        result.sort(
          (a, b) =>
            (matchForListing(b, listings)?.score ?? 0) - (matchForListing(a, listings)?.score ?? 0),
        );
        break;
      case "rating":
        result.sort((a, b) => getStudent(b.ownerId).rating - getStudent(a.ownerId).rating);
        break;
      case "price":
        result.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
        break;
      default:
        result.sort((a, b) => a.postedHours - b.postedHours);
    }
    return result;
  }, [listings, q, cat, activeTypes, sort]);

  function setSearch(patch: Partial<{ q: string; cat: string; types: string; sort: string }>) {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...patch }),
    });
  }

  function toggleType(value: string) {
    const next = activeTypes.includes(value)
      ? activeTypes.filter((t) => t !== value)
      : [...activeTypes, value];
    setSearch({ types: next.join(",") });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSearch({ q: String(data.get("q") ?? "").trim() });
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="w-full shrink-0 space-y-7 lg:w-60">
          <form onSubmit={onSubmit} className="relative lg:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              key={q}
              name="q"
              defaultValue={q}
              placeholder="Search listings…"
              className="w-full rounded-full border-0 bg-card py-2 pl-10 pr-3 text-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>

          <div>
            <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Categories
            </h3>
            <nav className="flex flex-wrap gap-1 lg:flex-col lg:gap-0 lg:space-y-1">
              {["All", ...CATEGORIES].map((c) => {
                const active = cat === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSearch({ cat: c })}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{c === "All" ? "All items" : c}</span>
                    <span className="ml-3 text-xs opacity-60">
                      {c === "All" ? listings.length : (categoryCounts.get(c) ?? 0)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Offer type
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-y-2">
              {LISTING_TYPES.map((t) => (
                <label key={t.value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeTypes.includes(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="hidden rounded-xl border border-border bg-card p-4 lg:block">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <ShieldCheck className="size-4 text-mint" /> Campus Trust Badge
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              You're browsing the <b>North Campus</b> community. Every member is verified with a
              student email. 84 students online now.
            </p>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {cat === "All" ? "Explore the marketplace" : cat}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {filtered.length} listing{filtered.length === 1 ? "" : "s"}
                {q && (
                  <>
                    {" "}
                    for “<span className="font-medium text-foreground">{q}</span>”
                  </>
                )}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="size-4" />
              <select
                value={sort}
                onChange={(e) => setSearch({ sort: e.target.value })}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="newest">Newest first</option>
                <option value="relevant">Best AI match</option>
                <option value="rating">Reputation (high to low)</option>
                <option value="price">Price (low to high)</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
              <p className="font-heading text-lg font-bold">Nothing matches that yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Try a different search — or post a request and let the campus come to you. The AI
                will notify matching owners.
              </p>
              <Link
                to="/create"
                className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
              >
                Post a request
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((listing: Listing, i: number) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  matchScore={matchForListing(listing, listings)?.score}
                  delay={Math.min(i, 8) * 50}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
