import { useSyncExternalStore } from "react";
import { currentUser, seedListings, seedReviews, seedThreads } from "./data";
import type { Listing, Review, Thread } from "./types";

interface AppState {
  listings: Listing[];
  threads: Thread[];
  reviews: Review[];
  completedThisSession: number;
}

let state: AppState = {
  listings: seedListings,
  threads: seedThreads,
  reviews: seedReviews,
  completedThisSession: 0,
};

const listeners = new Set<() => void>();

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

let counter = 100;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}${counter}`;
}

const cannedReplies = [
  "Sounds good! Want to meet at the library entrance tomorrow?",
  "Perfect — I'll bring it to the Main Hall around 5pm.",
  "Great, consider it done. Sending you the details in a bit!",
  "Awesome, thanks! Let me know what works for you.",
];

export const actions = {
  addListing(
    input: Omit<Listing, "id" | "ownerId" | "postedHours" | "department" | "year">,
  ): string {
    const id = nextId("l");
    const listing: Listing = {
      ...input,
      id,
      ownerId: currentUser.id,
      department: currentUser.department,
      year: currentUser.year,
      postedHours: 0,
    };
    setState((s) => ({ ...s, listings: [listing, ...s.listings] }));
    return id;
  },

  removeListing(id: string) {
    setState((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id) }));
  },

  sendMessage(threadId: string, text: string) {
    if (!text.trim()) return;
    const msg = {
      id: nextId("m"),
      fromId: currentUser.id,
      text: text.trim(),
      time: "Now",
    };
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t,
      ),
    }));
    // Simulated reply for the demo
    const thread = state.threads.find((t) => t.id === threadId);
    if (thread) {
      const replyText =
        cannedReplies[Math.floor(Math.random() * cannedReplies.length)] ??
        "Sounds good! When works for you?";
      window.setTimeout(() => {
        setState((s) => ({
          ...s,
          threads: s.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [
                    ...t.messages,
                    { id: nextId("m"), fromId: thread.studentId, text: replyText, time: "Now" },
                  ],
                }
              : t,
          ),
        }));
      }, 1400);
    }
  },

  startThread(studentId: string, listingId: string | undefined, subject: string, text: string): string {
    const existing = state.threads.find(
      (t) => t.studentId === studentId && t.listingId === listingId,
    );
    if (existing) {
      if (text.trim()) actions.sendMessage(existing.id, text);
      return existing.id;
    }
    const id = nextId("t");
    const thread: Thread = {
      id,
      studentId,
      listingId,
      kind: "chat",
      status: "active",
      subject,
      messages: text.trim()
        ? [{ id: nextId("m"), fromId: currentUser.id, text: text.trim(), time: "Now" }]
        : [],
    };
    setState((s) => ({ ...s, threads: [thread, ...s.threads] }));
    return id;
  },

  sendExchangeRequest(studentId: string, listingId: string, subject: string, text: string): string {
    const id = nextId("t");
    const thread: Thread = {
      id,
      studentId,
      listingId,
      kind: "request",
      status: "pending",
      subject,
      messages: [
        { id: nextId("m"), fromId: currentUser.id, text: text.trim(), time: "Now" },
      ],
    };
    setState((s) => ({ ...s, threads: [thread, ...s.threads] }));
    return id;
  },

  respondToRequest(threadId: string, accept: boolean) {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, status: accept ? "accepted" : "declined" } : t,
      ),
    }));
  },

  completeExchange(threadId: string, rating: number, reviewText: string) {
    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) return;
    const review: Review = {
      id: nextId("rv"),
      fromId: thread.studentId,
      fromName: "Exchange partner",
      rating,
      text: reviewText.trim() || "Completed an exchange on REXchange.",
      date: "Just now",
    };
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, status: "completed" } : t)),
      reviews: [review, ...s.reviews],
      completedThisSession: s.completedThisSession + 1,
    }));
  },
};
