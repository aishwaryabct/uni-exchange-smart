import { useSyncExternalStore } from "react";
import { deleteListingFromFirestore, saveListingToFirestore, subscribeToListings } from "../firebase";
import { currentUser, getStudent, seedListings, seedReviews, seedThreads } from "./data";
import type { Listing, Review, Thread } from "./types";

interface AppState {
  listings: Listing[];
  threads: Thread[];
  reviews: Review[];
  completedThisSession: number;
}

const STORAGE_KEY = "rexchange_app_state_v2";

function loadInitialState(): AppState {
  if (typeof window === "undefined") {
    return {
      listings: seedListings,
      threads: seedThreads,
      reviews: seedReviews,
      completedThisSession: 0,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.listings) && Array.isArray(parsed.threads)) {
        return {
          listings: parsed.listings.length > 0 ? parsed.listings : seedListings,
          threads: parsed.threads.length > 0 ? parsed.threads : seedThreads,
          reviews: Array.isArray(parsed.reviews) && parsed.reviews.length > 0 ? parsed.reviews : seedReviews,
          completedThisSession: typeof parsed.completedThisSession === "number" ? parsed.completedThisSession : 0,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to load state from localStorage:", err);
  }
  return {
    listings: seedListings,
    threads: seedThreads,
    reviews: seedReviews,
    completedThisSession: 0,
  };
}

const serverSnapshot: AppState = {
  listings: seedListings,
  threads: seedThreads,
  reviews: seedReviews,
  completedThisSession: 0,
};

let state: AppState = loadInitialState();

const listeners = new Set<() => void>();

function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (err) {
    console.warn("Failed to save state to localStorage:", err);
  }
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  saveState(state);
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => serverSnapshot,
  );
}

function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
    void saveListingToFirestore(listing);
    return id;
  },

  removeListing(id: string) {
    setState((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id) }));
    void deleteListingFromFirestore(id);
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
      fromName: getStudent(thread.studentId).name,
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

  resetData() {
    setState(() => ({
      listings: seedListings,
      threads: seedThreads,
      reviews: seedReviews,
      completedThisSession: 0,
    }));
  },
};

// Real-time synchronization with Firestore listings
if (typeof window !== "undefined") {
  subscribeToListings((remoteListings) => {
    if (!remoteListings || remoteListings.length === 0) return;
    setState((s) => {
      const map = new Map<string, Listing>();
      // Place existing listings in map
      s.listings.forEach((l) => map.set(l.id, l));
      // Overwrite/add remote listings from Firestore
      remoteListings.forEach((l) => map.set(l.id, l));
      return {
        ...s,
        listings: Array.from(map.values()),
      };
    });
  });
}
