import { currentUser, getStudent } from "./data";
import type { Listing } from "./types";

export interface MatchResult {
  listing: Listing;
  score: number;
  reasons: string[];
}

/**
 * Curated, high-quality matches for the seeded demo data.
 * Keyed by listing id. The heuristic below covers everything else
 * (including listings created at runtime).
 */
const CURATED: Record<string, { score: number; reasons: string[] }> = {
  l11: {
    score: 96,
    reasons: [
      "Directly answers your request “Intro to Statistics textbook” — exact title and edition",
      "Priya accepts exchanges and wants headphones — you listed Bose QC35",
      "STAT 201 is a core course for your CS year",
    ],
  },
  l12: {
    score: 94,
    reasons: [
      "Matches your request “Calculus tutoring before finals”",
      "Thursday 5pm slot fits your free evening window",
      "Sam is a 5.0-rated math grad student with 41 completed exchanges",
    ],
  },
  l1: {
    score: 89,
    reasons: [
      "Two-way match: Marcus wants noise-cancelling headphones — you listed Bose QC35",
      "His trade terms mention an iPad, which is on your wishlist",
      "Same year group, active trader with a 4.8 rating",
    ],
  },
  l6: {
    score: 84,
    reasons: [
      "Your STAT 201 course requires an exam-approved calculator",
      "Priya wants a desk lamp — your Philips lamp giveaway is a perfect swap",
      "Same campus zone, flexible pickup",
    ],
  },
  l3: {
    score: 78,
    reasons: [
      "Same department (Computer Science) — relevant to your project deadlines",
      "David is top-rated and offers free sessions for swaps",
      "Complements your CS skill-swap offer",
    ],
  },
  l2: {
    score: 71,
    reasons: [
      "Free study material from a top-rated alum",
      "Popular giveaway among students in your network",
    ],
  },
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function heuristic(listing: Listing, userRequests: Listing[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 52;

  const listingTokens = new Set(
    tokenize(
      [listing.title, listing.description, listing.exchangePref ?? "", ...listing.keywords].join(" "),
    ),
  );

  let bestOverlap = 0;
  let bestRequest: Listing | undefined;
  for (const req of userRequests) {
    const reqTokens = tokenize([req.title, ...req.keywords].join(" "));
    const hits = reqTokens.filter((t) => listingTokens.has(t)).length;
    const overlap = reqTokens.length ? hits / reqTokens.length : 0;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestRequest = req;
    }
  }

  if (bestRequest && bestOverlap > 0.15) {
    score += Math.round(bestOverlap * 34);
    reasons.push(`Closely matches your request “${bestRequest.title.replace(/^Need: |^Looking for: /, "")}”`);
  }

  if (listing.department === currentUser.department) {
    score += 8;
    reasons.push(`Same department — ${currentUser.department}`);
  }

  const owner = getStudent(listing.ownerId);
  if (owner.rating >= 4.8) {
    score += 5;
    reasons.push(`Highly rated owner (${owner.rating.toFixed(1)}★, ${owner.exchanges} exchanges)`);
  }

  if (listing.type === "giveaway") {
    score += 4;
    reasons.push("Free giveaway — no trade needed");
  }

  if (reasons.length === 0) {
    reasons.push("Trending in your campus community this week");
  }

  return { score: Math.min(score, 88), reasons };
}

/** Compute AI matches for the current user across all live listings. */
export function computeMatches(listings: Listing[], boostQuery = ""): MatchResult[] {
  const userRequests = listings.filter((l) => l.ownerId === currentUser.id && l.type === "request");

  const results: MatchResult[] = [];
  for (const listing of listings) {
    if (listing.ownerId === currentUser.id) continue;
    if (listing.type === "request") continue;

    const base = CURATED[listing.id] ?? heuristic(listing, userRequests);
    let score = base.score;
    const reasons = [...base.reasons];

    if (boostQuery.trim()) {
      const q = tokenize(boostQuery);
      const haystack = tokenize(
        [listing.title, listing.description, listing.category, ...listing.keywords].join(" "),
      );
      const hits = q.filter((t) => haystack.includes(t)).length;
      if (hits > 0) {
        score = Math.min(score + hits * 6, 98);
        reasons.unshift(`Matches your search focus “${boostQuery.trim()}”`);
      } else {
        score = Math.max(score - 12, 40);
      }
    }

    if (score >= 55) results.push({ listing, score, reasons });
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Quick match score for a single listing (used on cards / detail pages). */
export function matchForListing(listing: Listing, allListings: Listing[]): MatchResult | undefined {
  if (listing.ownerId === currentUser.id || listing.type === "request") return undefined;
  const userRequests = allListings.filter((l) => l.ownerId === currentUser.id && l.type === "request");
  const base = CURATED[listing.id] ?? heuristic(listing, userRequests);
  if (base.score < 60) return undefined;
  return { listing, score: base.score, reasons: base.reasons };
}
