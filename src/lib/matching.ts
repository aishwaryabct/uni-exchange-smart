import { currentUser, getStudent } from "./data";
import type { Listing } from "./types";

export interface MatchResult {
  listing: Listing;
  score: number;
  reasons: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function heuristic(
  listing: Listing,
  userRequests: Listing[],
  userDepartment?: string,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 52;

  const listingTokens = new Set(
    tokenize(
      [listing.title, listing.description, listing.exchangePref ?? "", ...listing.keywords].join(
        " ",
      ),
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
    reasons.push(
      `Closely matches your request “${bestRequest.title.replace(/^Need: |^Looking for: /, "")}”`,
    );
  }

  const targetDept = userDepartment || currentUser.department;
  if (listing.department === targetDept) {
    score += 8;
    reasons.push(`Same department — ${targetDept}`);
  }

  const owner = getStudent(listing.ownerId, null, listing);
  if (owner.rating >= 4.8 && owner.exchanges > 0) {
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

/** Compute AI matches for a student across all live listings. */
export function computeMatches(
  listings: Listing[],
  boostQuery = "",
  activeUser?: { id: string; department?: string } | null,
): MatchResult[] {
  const targetId = activeUser?.id || currentUser.id;
  const targetDept = activeUser?.department || currentUser.department;
  const userRequests = listings.filter((l) => l.ownerId === targetId && l.type === "request");

  const results: MatchResult[] = [];
  for (const listing of listings) {
    if (listing.ownerId === targetId) continue;
    if (listing.type === "request") continue;

    const base = heuristic(listing, userRequests, targetDept);
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
export function matchForListing(
  listing: Listing,
  allListings: Listing[],
  activeUser?: { id: string; department?: string } | null,
): MatchResult | undefined {
  const targetId = activeUser?.id || currentUser.id;
  const targetDept = activeUser?.department || currentUser.department;
  if (listing.ownerId === targetId || listing.type === "request") return undefined;
  const userRequests = allListings.filter((l) => l.ownerId === targetId && l.type === "request");
  const base = heuristic(listing, userRequests, targetDept);
  if (base.score < 60) return undefined;
  return { listing, score: base.score, reasons: base.reasons };
}
