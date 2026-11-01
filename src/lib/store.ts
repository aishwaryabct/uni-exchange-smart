import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import {
  auth,
  deleteListingFromFirestore,
  getCurrentUser,
  getOrCreateThreadInFirestore,
  isFirebaseConfigured,
  saveListingToFirestore,
  sendMessageBatchToFirestore,
  subscribeToListings,
  subscribeToUserThreads,
  updateThreadStatusInFirestore,
} from "../firebase";
import { getCachedProfile, getInitials } from "./auth";
import { getStudent, seedListings, seedReviews, seedThreads } from "./data";
import {
  firestoreMessageToChatMessage,
  firestoreThreadToThread,
  type ChatMessage,
  type FirestoreThread,
  type Listing,
  type Review,
  type Thread,
  type ThreadStatus,
} from "./types";

interface AppState {
  listings: Listing[];
  threads: Thread[];
  reviews: Review[];
  completedThisSession: number;
}

interface UserScopedData {
  threads: Thread[];
  reviews: Review[];
  completedThisSession: number;
}

const PUBLIC_LISTINGS_STORAGE_KEY = "rexchange_public_listings_v1";
const LEGACY_STORAGE_KEY = "rexchange_app_state_v3";

function getUserStorageKey(uid: string): string {
  return `rexchange_user_data_${uid}`;
}

const LEGACY_MOCK_LISTING_IDS = new Set([
  "l1",
  "l2",
  "l3",
  "l4",
  "l5",
  "l6",
  "l7",
  "l8",
  "l9",
  "l10",
  "l11",
  "l12",
  "l13",
  "r1",
  "r2",
  "r3",
]);

interface LegacyThreadRaw {
  id?: unknown;
  listingId?: unknown;
  kind?: unknown;
  status?: unknown;
  subject?: unknown;
  messages?: unknown;
  creatorId?: unknown;
  recipientId?: unknown;
  participantIds?: unknown;
  studentId?: unknown;
}

function migrateThread(raw: unknown, listings: Listing[]): Thread | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as LegacyThreadRaw;
  if (typeof candidate.id !== "string") return null;

  const id = candidate.id;
  const listingId = typeof candidate.listingId === "string" ? candidate.listingId : undefined;
  const kind: "chat" | "request" = candidate.kind === "request" ? "request" : "chat";
  const status: ThreadStatus = (
    ["active", "pending", "accepted", "declined", "completed"] as const
  ).includes(candidate.status as ThreadStatus)
    ? (candidate.status as ThreadStatus)
    : "active";
  const subject =
    typeof candidate.subject === "string" && candidate.subject.trim()
      ? candidate.subject.trim()
      : "Conversation";
  const messages: ChatMessage[] = Array.isArray(candidate.messages)
    ? candidate.messages.filter((m: unknown): m is ChatMessage =>
        Boolean(
          m &&
          typeof m === "object" &&
          typeof (m as ChatMessage).id === "string" &&
          typeof (m as ChatMessage).fromId === "string" &&
          typeof (m as ChatMessage).text === "string",
        ),
      )
    : [];

  let creatorId = typeof candidate.creatorId === "string" ? candidate.creatorId.trim() : "";
  let recipientId = typeof candidate.recipientId === "string" ? candidate.recipientId.trim() : "";

  // Attempt safe resolution from trusted listing if available and participant IDs are missing
  if (!creatorId || !recipientId) {
    const listing = listingId ? listings.find((l) => l.id === listingId) : undefined;
    if (listing?.ownerId) {
      recipientId = recipientId || listing.ownerId;
      const firstMsgFrom = messages[0]?.fromId?.trim();
      if (firstMsgFrom && firstMsgFrom !== recipientId && !firstMsgFrom.startsWith("u")) {
        creatorId = creatorId || firstMsgFrom;
      }
    }
  }

  // Strictly check participant validity:
  // Legacy threads with mock IDs (e.g. u0, u1) or unverified participants must NOT be granted authorization
  const hasValidParticipants = Boolean(
    creatorId &&
    recipientId &&
    creatorId !== recipientId &&
    !creatorId.startsWith("u") &&
    !recipientId.startsWith("u"),
  );

  const participantIds: string[] = hasValidParticipants
    ? Array.from(new Set([creatorId, recipientId]))
    : Array.isArray(candidate.participantIds)
      ? candidate.participantIds.filter(
          (p: unknown): p is string =>
            typeof p === "string" && p.trim() !== "" && !p.startsWith("u"),
        )
      : [];

  return {
    id,
    studentId:
      recipientId || (typeof candidate.studentId === "string" ? candidate.studentId : "unknown"),
    creatorId,
    recipientId,
    participantIds,
    listingId,
    kind,
    status,
    subject,
    messages,
  };
}

function loadPublicListings(): Listing[] {
  if (typeof window === "undefined") return seedListings;
  try {
    // 1. Check dedicated public listings storage key
    const raw = window.localStorage.getItem(PUBLIC_LISTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (l: Listing) => l && typeof l.id === "string" && !LEGACY_MOCK_LISTING_IDS.has(l.id),
        );
      }
    }

    // 2. Fallback to legacy global key if public listings key not yet populated
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (legacyParsed && Array.isArray(legacyParsed.listings)) {
        const valid = legacyParsed.listings.filter(
          (l: Listing) => l && typeof l.id === "string" && !LEGACY_MOCK_LISTING_IDS.has(l.id),
        );
        if (valid.length > 0) {
          savePublicListings(valid);
          return valid;
        }
      }
    }
  } catch (err) {
    console.warn("[Store] Failed to load public listings from storage:", err);
  }
  return seedListings;
}

function savePublicListings(listings: Listing[]): void {
  if (typeof window === "undefined") return;
  try {
    const valid = listings.filter(
      (l) => l && typeof l.id === "string" && !LEGACY_MOCK_LISTING_IDS.has(l.id),
    );
    window.localStorage.setItem(PUBLIC_LISTINGS_STORAGE_KEY, JSON.stringify(valid));
  } catch (err) {
    console.warn("[Store] Failed to save public listings to storage:", err);
  }
}

function loadUserData(uid: string, currentListings: Listing[]): UserScopedData {
  if (typeof window === "undefined" || !uid) {
    return { threads: seedThreads, reviews: seedReviews, completedThisSession: 0 };
  }

  const userKey = getUserStorageKey(uid);

  try {
    // 1. Check user-partitioned storage key
    const raw = window.localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const rawThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        const validThreads = rawThreads
          .map((t: unknown) => migrateThread(t, currentListings))
          .filter((t: Thread | null): t is Thread => {
            if (!t) return false;
            return Boolean(
              t.participantIds?.includes(uid) || t.creatorId === uid || t.recipientId === uid,
            );
          });

        const validReviews = Array.isArray(parsed.reviews)
          ? (parsed.reviews.filter(
              (r: unknown) =>
                r &&
                typeof r === "object" &&
                typeof (r as Review).id === "string" &&
                typeof (r as Review).fromId === "string",
            ) as Review[])
          : seedReviews;

        const completedThisSession =
          typeof parsed.completedThisSession === "number" ? parsed.completedThisSession : 0;

        return {
          threads: validThreads,
          reviews: validReviews,
          completedThisSession,
        };
      }
    }

    // 2. Legacy Migration from LEGACY_STORAGE_KEY ("rexchange_app_state_v3")
    // Runs idempotently ONLY when user-partitioned storage does not yet exist for this UID.
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (legacyParsed && typeof legacyParsed === "object" && Array.isArray(legacyParsed.threads)) {
        const migratedThreads: Thread[] = [];
        for (const rawThread of legacyParsed.threads) {
          const thread = migrateThread(rawThread, currentListings);
          if (
            thread &&
            (thread.participantIds?.includes(uid) ||
              thread.creatorId === uid ||
              thread.recipientId === uid)
          ) {
            if (!thread.participantIds.includes(uid)) {
              thread.participantIds.push(uid);
            }
            migratedThreads.push(thread);
          }
        }

        const migratedReviews: Review[] = Array.isArray(legacyParsed.reviews)
          ? (legacyParsed.reviews.filter(
              (r: unknown) =>
                r &&
                typeof r === "object" &&
                typeof (r as Review).id === "string" &&
                (r as Review).fromId === uid,
            ) as Review[])
          : [];

        const completedCount =
          typeof legacyParsed.completedThisSession === "number"
            ? legacyParsed.completedThisSession
            : 0;

        const migratedData: UserScopedData = {
          threads: migratedThreads,
          reviews: migratedReviews,
          completedThisSession: completedCount,
        };

        // Save migrated data to the user-scoped key so subsequent loads read from step 1
        saveUserData(uid, migratedData);
        // Note: The legacy key is strictly preserved until verified
        return migratedData;
      }
    }
  } catch (err) {
    console.warn(`[Store] Failed to load/migrate user data for ${uid}:`, err);
  }

  return { threads: seedThreads, reviews: seedReviews, completedThisSession: 0 };
}

function saveUserData(uid: string, data: UserScopedData): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    // Security guard: Ensure only threads legitimately belonging to this UID are written
    const scopedThreads = data.threads.filter(
      (t) => t.participantIds?.includes(uid) || t.creatorId === uid || t.recipientId === uid,
    );

    const payload: UserScopedData = {
      threads: scopedThreads,
      reviews: data.reviews,
      completedThisSession: data.completedThisSession,
    };

    window.localStorage.setItem(getUserStorageKey(uid), JSON.stringify(payload));
  } catch (err) {
    console.warn(`[Store] Failed to save user data for ${uid}:`, err);
  }
}

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
    // Purge legacy storage key to prevent stale mock data retention
    try {
      window.localStorage.removeItem("rexchange_app_state_v2");
    } catch {
      // ignore storage access errors
    }

    const publicListings = loadPublicListings();
    // Private data is NOT loaded before authentication resolves
    return {
      listings: publicListings,
      threads: seedThreads,
      reviews: seedReviews,
      completedThisSession: 0,
    };
  } catch (err) {
    console.warn("[Store] Failed to load initial state:", err);
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

let activeAuthenticatedUid: string | null = null;
let unsubscribeThreadsListener: Unsubscribe | null = null;
let state: AppState = loadInitialState();

const listeners = new Set<() => void>();

function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  // 1. Always cache public marketplace listings
  savePublicListings(s.listings);

  // 2. Save private data ONLY if an authenticated student session is active
  const currentUid = activeAuthenticatedUid;
  if (currentUid) {
    saveUserData(currentUid, {
      threads: s.threads,
      reviews: s.reviews,
      completedThisSession: s.completedThisSession,
    });
  }
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  saveState(state);
  listeners.forEach((l) => l());
}

export function syncUserSession(uid: string | null) {
  if (uid === activeAuthenticatedUid) return;

  // Unsubscribe previous user threads listener before switching accounts or clearing
  if (unsubscribeThreadsListener) {
    unsubscribeThreadsListener();
    unsubscribeThreadsListener = null;
  }

  activeAuthenticatedUid = uid;

  if (uid) {
    // User signed in or session loaded: hydrate user partition
    const userData = loadUserData(uid, state.listings);
    setState((s) => ({
      ...s,
      threads: userData.threads,
      reviews: userData.reviews,
      completedThisSession: userData.completedThisSession,
    }));

    // Subscribe to Firestore threads for this authenticated student
    unsubscribeThreadsListener = subscribeToUserThreads(
      uid,
      (remoteThreads: FirestoreThread[]) => {
        setState((s) => {
          // Map remote Firestore threads to UI threads, preserving existing messages if already loaded
          const cloudThreads = remoteThreads.map((ft) => {
            const existing = s.threads.find((t) => t.id === ft.id);
            const messages = existing?.messages ?? [];
            return firestoreThreadToThread(ft, messages);
          });

          // Retain legacy local threads (non-cloud threads)
          const legacyThreads = s.threads.filter(
            (t) => !t.id.startsWith("t_chat_") && !t.id.startsWith("t_req_"),
          );

          return {
            ...s,
            threads: [...cloudThreads, ...legacyThreads],
          };
        });
      },
      (err) => {
        console.error("[Store] Failed to subscribe to Firestore threads:", err);
      },
    );
  } else {
    // User signed out or guest: clear private data from memory
    setState((s) => ({
      ...s,
      threads: seedThreads,
      reviews: seedReviews,
      completedThisSession: 0,
    }));
  }
}

// Subscribe to Firebase Auth state changes to hydrate/clear user-partitioned data
if (typeof window !== "undefined" && isFirebaseConfigured() && auth) {
  onAuthStateChanged(auth, (user) => {
    syncUserSession(user ? user.uid : null);
  });
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

export const actions = {
  async addListing(
    input: Omit<Listing, "id" | "ownerId" | "postedHours" | "department" | "year">,
    owner?: {
      id: string;
      department?: string;
      year?: string;
      name?: string;
      initials?: string;
    },
  ): Promise<string> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      throw new Error("You must be signed in to post a listing.");
    }

    if (!owner || !owner.id) {
      throw new Error("Listing owner information is required.");
    }

    if (owner.id !== authenticatedUser.uid) {
      throw new Error("Unauthorized: listing owner must match the authenticated student.");
    }

    const title = input.title.trim();
    if (title.length < 3) {
      throw new Error("Listing title must be at least 3 characters long.");
    }
    const description = input.description.trim();
    if (description.length < 3) {
      throw new Error("Listing description must be at least 3 characters long.");
    }

    const cachedProfile = getCachedProfile(authenticatedUser.uid);
    const ownerName =
      owner.name || cachedProfile?.name || authenticatedUser.displayName || "Student";
    const ownerInitials = owner.initials || cachedProfile?.initials || getInitials(ownerName);

    const id = nextId("l");
    const department = owner.department || "Student Community";
    const year = owner.year || "Undergrad";
    const listing: Listing = {
      ...input,
      title,
      description,
      id,
      ownerId: authenticatedUser.uid,
      ownerName,
      ownerInitials,
      department,
      year,
      postedHours: 0,
    };

    // 1. Await Firestore save first to ensure persistence before mutating local state
    await saveListingToFirestore(listing);

    // 2. Only update local state and localStorage after Firestore write succeeds
    setState((s) => ({ ...s, listings: [listing, ...s.listings] }));

    return id;
  },

  async updateListing(
    id: string,
    updates: Partial<
      Pick<
        Listing,
        | "title"
        | "description"
        | "category"
        | "condition"
        | "type"
        | "price"
        | "exchangePref"
        | "availability"
        | "image"
      >
    >,
    requesterUid?: string,
  ): Promise<Listing> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      throw new Error("You must be signed in to edit a listing.");
    }

    const currentUid = requesterUid || authenticatedUser.uid;
    if (currentUid !== authenticatedUser.uid) {
      throw new Error("Unauthorized: caller UID does not match authenticated student session.");
    }

    const existing = state.listings.find((l) => l.id === id);
    if (!existing) {
      throw new Error("Listing not found.");
    }

    if (existing.ownerId !== authenticatedUser.uid) {
      console.warn(
        `[Store] Blocked unauthorized update attempt for listing ${id}: caller '${authenticatedUser.uid}' does not match owner '${existing.ownerId}'`,
      );
      throw new Error("Unauthorized: you can only edit listings that you created.");
    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (!title || title.length < 3) {
      throw new Error("Listing title must be at least 3 characters long.");
    }

    const description =
      updates.description !== undefined ? updates.description.trim() : existing.description;
    if (!description || description.length < 3) {
      throw new Error("Listing description must be at least 3 characters long.");
    }

    const type = updates.type ?? existing.type;
    const price =
      type === "sell" ? (updates.price !== undefined ? updates.price : existing.price) : undefined;

    const exchangePref =
      type !== "sell" && type !== "giveaway"
        ? updates.exchangePref !== undefined
          ? updates.exchangePref
          : existing.exchangePref
        : undefined;

    const keywords = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const cachedProfile = getCachedProfile(authenticatedUser.uid);
    const ownerName =
      existing.ownerName || cachedProfile?.name || authenticatedUser.displayName || undefined;
    const ownerInitials =
      existing.ownerInitials ||
      cachedProfile?.initials ||
      (ownerName ? getInitials(ownerName) : undefined);

    const updatedListing: Listing = {
      ...existing,
      title,
      description,
      category: updates.category ?? existing.category,
      condition: updates.condition ?? existing.condition,
      type,
      price,
      exchangePref,
      availability:
        updates.availability !== undefined ? updates.availability.trim() : existing.availability,
      image: updates.image !== undefined ? updates.image : existing.image,
      keywords,
      // Strictly preserve immutable properties & attribution
      id: existing.id,
      ownerId: existing.ownerId,
      department: existing.department,
      year: existing.year,
      postedHours: existing.postedHours,
      ...(ownerName ? { ownerName } : {}),
      ...(ownerInitials ? { ownerInitials } : {}),
    };

    // 1. Await Firestore save first to ensure persistence before mutating local state
    const shouldDeletePrice = type !== "sell";
    const shouldDeleteExchangePref = (type === "sell" || type === "giveaway") && !exchangePref;

    await saveListingToFirestore(updatedListing, {
      deletePrice: shouldDeletePrice,
      deleteExchangePref: shouldDeleteExchangePref,
    });

    // 2. Only update local state and localStorage after Firestore write succeeds
    setState((s) => ({
      ...s,
      listings: s.listings.map((l) => (l.id === id ? updatedListing : l)),
    }));

    return updatedListing;
  },

  async removeListing(
    id: string,
    requesterUid?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) {
      return { success: false, error: "Listing not found." };
    }

    const currentUid = requesterUid || getCurrentUser()?.uid;
    if (!currentUid) {
      console.warn(`[Store] Blocked unauthenticated delete attempt for listing ${id}`);
      return { success: false, error: "You must be signed in to remove a listing." };
    }

    if (listing.ownerId !== currentUid) {
      console.warn(
        `[Store] Blocked unauthorized delete attempt for listing ${id}: caller '${currentUid}' does not match owner '${listing.ownerId}'`,
      );
      return { success: false, error: "You can only remove listings that you created." };
    }

    try {
      // 1. Attempt Firestore deletion first (do NOT optimistically remove from local state)
      await deleteListingFromFirestore(id);

      // 2. Only remove from local state after Firestore deletion succeeds
      setState((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id) }));
      return { success: true };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete listing from the database.";
      console.error(`[Store] Failed to remove listing ${id}:`, err);
      return { success: false, error: msg };
    }
  },

  setThreadMessages(threadId: string, messages: ChatMessage[]): void {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, messages } : t)),
    }));
  },

  async sendMessage(threadId: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      console.warn(
        `[Store] Blocked unauthenticated attempt to send a message in thread ${threadId}`,
      );
      throw new Error("You must be signed in to send a message.");
    }

    const callerUid = authenticatedUser.uid;
    const cachedProfile = getCachedProfile(callerUid);
    const callerName = cachedProfile?.name || authenticatedUser.displayName || "Student";
    const isCloud = threadId.startsWith("t_chat_") || threadId.startsWith("t_req_");

    if (isCloud) {
      const messageId = nextId("m");

      // Atomic batch write in Firestore; errors bubble up to caller (never silently fallback)
      await sendMessageBatchToFirestore(threadId, messageId, trimmed, callerUid, callerName);
      return;
    }

    // Legacy local thread fallback
    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) {
      console.warn(`[Store] Thread ${threadId} not found`);
      throw new Error("Conversation thread not found.");
    }

    if (!thread.participantIds || !thread.participantIds.includes(callerUid)) {
      console.warn(
        `[Store] Blocked unauthorized message attempt in thread ${threadId}: caller '${callerUid}' is not a participant`,
      );
      throw new Error("You are not authorized to send messages in this thread.");
    }

    const msg: ChatMessage = {
      id: nextId("m"),
      fromId: callerUid,
      senderId: callerUid,
      senderName: callerName,
      text: trimmed,
      time: "Now",
    };

    setState((s) => ({
      ...s,
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t,
      ),
    }));
  },

  async startThread(
    recipientStudentId: string,
    listingId: string | undefined,
    subject: string,
    text: string,
  ): Promise<string> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      console.warn("[Store] Blocked unauthenticated attempt to start a conversation thread");
      throw new Error("You must be signed in to start a conversation.");
    }

    const creatorId = authenticatedUser.uid;

    // Verify recipient identity against trusted listing ownership wherever available
    let recipientId = recipientStudentId.trim();
    const listing = listingId ? state.listings.find((l) => l.id === listingId) : undefined;
    if (listing?.ownerId) {
      recipientId = listing.ownerId;
    }

    if (!recipientId) {
      throw new Error("Invalid recipient for conversation.");
    }

    if (creatorId === recipientId) {
      throw new Error("You cannot start a conversation with yourself.");
    }

    // If this conversation is tied to a listing, use Firestore real-time thread
    if (listingId) {
      const threadDoc = await getOrCreateThreadInFirestore({
        kind: "chat",
        listingId,
        creatorId,
        recipientId,
        subject: subject.trim() || listing?.title || "Conversation",
      });
      const threadId = threadDoc.id;

      if (text.trim()) {
        const cachedProfile = getCachedProfile(creatorId);
        const callerName = cachedProfile?.name || authenticatedUser.displayName || "Student";
        const messageId = nextId("m");
        await sendMessageBatchToFirestore(threadId, messageId, text.trim(), creatorId, callerName);
      }

      return threadId;
    }

    // Legacy local fallback if listingId is not provided
    const existing = state.threads.find(
      (t) =>
        t.listingId === listingId &&
        t.participantIds?.includes(creatorId) &&
        t.participantIds?.includes(recipientId),
    );
    if (existing) {
      if (text.trim()) {
        await actions.sendMessage(existing.id, text);
      }
      return existing.id;
    }

    const cachedProfile = getCachedProfile(creatorId);
    const callerName = cachedProfile?.name || authenticatedUser.displayName || "Student";
    const id = nextId("t");
    const thread: Thread = {
      id,
      studentId: recipientId,
      creatorId,
      recipientId,
      participantIds: [creatorId, recipientId],
      listingId,
      kind: "chat",
      status: "active",
      subject: subject.trim() || "Conversation",
      messages: text.trim()
        ? [
            {
              id: nextId("m"),
              fromId: creatorId,
              senderId: creatorId,
              senderName: callerName,
              text: text.trim(),
              time: "Now",
            },
          ]
        : [],
    };
    setState((s) => ({ ...s, threads: [thread, ...s.threads] }));
    return id;
  },

  async sendExchangeRequest(
    recipientStudentId: string,
    listingId: string,
    subject: string,
    text: string,
  ): Promise<string> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      console.warn("[Store] Blocked unauthenticated attempt to send an exchange request");
      throw new Error("You must be signed in to send an exchange request.");
    }

    const creatorId = authenticatedUser.uid;

    // Verify recipient identity against trusted listing ownership
    const listing = state.listings.find((l) => l.id === listingId);
    const recipientId = listing?.ownerId || recipientStudentId.trim();

    if (!recipientId) {
      throw new Error("Invalid recipient for exchange request.");
    }

    if (creatorId === recipientId) {
      throw new Error("You cannot send an exchange request to yourself or on your own listing.");
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error("Exchange request message cannot be empty.");
    }

    // Create or retrieve existing deterministic request thread in Firestore
    const threadDoc = await getOrCreateThreadInFirestore({
      kind: "request",
      listingId,
      creatorId,
      recipientId,
      subject: subject.trim() || `Request: ${listing?.title || "Listing"}`,
    });
    const threadId = threadDoc.id;

    // Initial message is sent via atomic batch in Firestore
    const cachedProfile = getCachedProfile(creatorId);
    const callerName = cachedProfile?.name || authenticatedUser.displayName || "Student";
    const messageId = nextId("m");
    await sendMessageBatchToFirestore(threadId, messageId, trimmedText, creatorId, callerName);

    return threadId;
  },

  async respondToRequest(threadId: string, accept: boolean): Promise<void> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      console.warn(`[Store] Blocked unauthenticated attempt to respond to request ${threadId}`);
      throw new Error("You must be signed in to respond to an exchange request.");
    }

    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) {
      console.warn(`[Store] Thread ${threadId} not found`);
      throw new Error("Exchange request thread not found.");
    }

    if (thread.kind !== "request") {
      throw new Error("This conversation is not an exchange request.");
    }

    if (thread.status !== "pending") {
      throw new Error(`Cannot respond to an exchange request with status "${thread.status}".`);
    }

    const callerUid = authenticatedUser.uid;

    if (callerUid === thread.creatorId) {
      console.warn(
        `[Store] Blocked requester ${callerUid} from responding to their own request ${threadId}`,
      );
      throw new Error("You cannot respond to your own exchange request.");
    }

    if (callerUid !== thread.recipientId) {
      console.warn(
        `[Store] Blocked non-recipient ${callerUid} from responding to request ${threadId} (recipient: ${thread.recipientId})`,
      );
      throw new Error("Only the recipient of this request can accept or decline.");
    }

    const newStatus: ThreadStatus = accept ? "accepted" : "declined";
    const isCloud = threadId.startsWith("t_chat_") || threadId.startsWith("t_req_");

    if (isCloud) {
      await updateThreadStatusInFirestore(threadId, newStatus, callerUid);
      setState((s) => ({
        ...s,
        threads: s.threads.map((t) => (t.id === threadId ? { ...t, status: newStatus } : t)),
      }));
      return;
    }

    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, status: newStatus } : t)),
    }));
  },

  async completeExchange(threadId: string, rating: number, reviewText: string): Promise<void> {
    const authenticatedUser = getCurrentUser();
    if (!authenticatedUser) {
      console.warn(`[Store] Blocked unauthenticated attempt to complete exchange ${threadId}`);
      throw new Error("You must be signed in to complete an exchange.");
    }

    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) {
      console.warn(`[Store] Thread ${threadId} not found`);
      throw new Error("Exchange thread not found.");
    }

    if (thread.kind !== "request") {
      throw new Error("Only exchange requests can be marked as completed.");
    }

    if (thread.status !== "accepted") {
      throw new Error(
        `Cannot complete an exchange with status "${thread.status}". It must be accepted first.`,
      );
    }

    const callerUid = authenticatedUser.uid;
    if (!thread.participantIds || !thread.participantIds.includes(callerUid)) {
      console.warn(
        `[Store] Blocked unauthorized completion of thread ${threadId}: caller '${callerUid}' is not a participant`,
      );
      throw new Error("Only authorized participants in this exchange can mark it as completed.");
    }

    const cachedProfile = getCachedProfile(callerUid);
    const reviewerName = cachedProfile?.name || authenticatedUser.displayName || "Student";

    const review: Review = {
      id: nextId("rv"),
      fromId: callerUid,
      fromName: reviewerName,
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      text: reviewText.trim() || "Completed an exchange on REXchange.",
      date: "Just now",
    };

    const isCloud = threadId.startsWith("t_chat_") || threadId.startsWith("t_req_");
    if (isCloud) {
      await updateThreadStatusInFirestore(threadId, "completed", callerUid);
      setState((s) => ({
        ...s,
        threads: s.threads.map((t) => (t.id === threadId ? { ...t, status: "completed" } : t)),
        reviews: [review, ...s.reviews],
        completedThisSession: s.completedThisSession + 1,
      }));
      return;
    }

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
    if (!remoteListings) return;
    setState((s) => {
      // Filter out any legacy mock listings and let genuine Firestore listings replace state
      const validRemote = remoteListings.filter(
        (l) => l && typeof l.id === "string" && !LEGACY_MOCK_LISTING_IDS.has(l.id),
      );
      return {
        ...s,
        listings: validRemote,
      };
    });
  });
}
