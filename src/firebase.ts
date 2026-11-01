import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, type Auth, type User } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import type {
  FirestoreChatMessage,
  FirestoreThread,
  Listing,
  StudentProfile,
  ThreadStatus,
} from "./lib/types";

/**
 * Resolves Firebase configuration with strict isolation between local development
 * and production.
 *
 * In local development (import.meta.env.DEV):
 * - Exclusively reads dedicated VITE_FIREBASE_DEV_* variables from .env.local.
 * - Does NOT fall back to standard VITE_FIREBASE_* variables or production defaults.
 * - Enforces that VITE_FIREBASE_DEV_PROJECT_ID equals "rexchange-dev-2a599" exactly.
 * - Explicitly rejects "workspace-8a6f1".
 *
 * In production builds (!import.meta.env.DEV):
 * - Reads ordinary VITE_FIREBASE_* variables provided by the deployment environment (e.g., Vercel).
 * - Contains zero hardcoded fallback strings or credentials.
 */
function resolveFirebaseConfig() {
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env["VITE_FIREBASE_DEV_API_KEY"];
    const authDomain = import.meta.env["VITE_FIREBASE_DEV_AUTH_DOMAIN"];
    const projectId = import.meta.env["VITE_FIREBASE_DEV_PROJECT_ID"];
    const storageBucket = import.meta.env["VITE_FIREBASE_DEV_STORAGE_BUCKET"];
    const messagingSenderId = import.meta.env["VITE_FIREBASE_DEV_MESSAGING_SENDER_ID"];
    const appId = import.meta.env["VITE_FIREBASE_DEV_APP_ID"];
    const measurementId = import.meta.env["VITE_FIREBASE_DEV_MEASUREMENT_ID"] || undefined;

    const missingKeys: string[] = [];
    if (!apiKey) missingKeys.push("VITE_FIREBASE_DEV_API_KEY");
    if (!authDomain) missingKeys.push("VITE_FIREBASE_DEV_AUTH_DOMAIN");
    if (!projectId) missingKeys.push("VITE_FIREBASE_DEV_PROJECT_ID");
    if (!storageBucket) missingKeys.push("VITE_FIREBASE_DEV_STORAGE_BUCKET");
    if (!messagingSenderId) missingKeys.push("VITE_FIREBASE_DEV_MESSAGING_SENDER_ID");
    if (!appId) missingKeys.push("VITE_FIREBASE_DEV_APP_ID");

    if (missingKeys.length > 0) {
      throw new Error(
        `[Firebase Safety Guard] Local development requires development variables. Missing required variable(s): ${missingKeys.join(", ")}. Please configure them in .env.local.`,
      );
    }

    if (projectId === "workspace-8a6f1") {
      throw new Error(
        "[Firebase Safety Guard BLOCKED] Local development project ID cannot be 'workspace-8a6f1'! Connection to production is strictly prohibited in local development.",
      );
    }

    if (projectId !== "rexchange-dev-2a599") {
      throw new Error(
        `[Firebase Safety Guard BLOCKED] Local development project ID must be 'rexchange-dev-2a599'. Received: '${projectId}'.`,
      );
    }

    return {
      apiKey: apiKey!,
      authDomain: authDomain!,
      projectId: projectId!,
      storageBucket: storageBucket!,
      messagingSenderId: messagingSenderId!,
      appId: appId!,
      measurementId,
    };
  }

  // Production build configuration
  const apiKey = import.meta.env["VITE_FIREBASE_API_KEY"];
  const authDomain = import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"];
  const projectId = import.meta.env["VITE_FIREBASE_PROJECT_ID"];
  const storageBucket = import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"];
  const messagingSenderId = import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"];
  const appId = import.meta.env["VITE_FIREBASE_APP_ID"];
  const measurementId = import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || undefined;

  return {
    apiKey: apiKey || "",
    authDomain: authDomain || "",
    projectId: projectId || "",
    storageBucket: storageBucket || "",
    messagingSenderId: messagingSenderId || "",
    appId: appId || "",
    measurementId,
  };
}

export const firebaseConfig = resolveFirebaseConfig();

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
  );
}

// Initialize Firebase App (singleton across HMR / SSR)
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Initialize Analytics if supported in the current browser environment
    if (typeof window !== "undefined") {
      isSupported()
        .then((supported) => {
          if (supported && app) {
            analytics = getAnalytics(app);
          }
        })
        .catch(() => {
          // Analytics not supported in this environment
        });
    }
  }
} catch (err) {
  console.warn("[Firebase] Initialization skipped or error:", err);
}

export { app, db, auth, analytics };

/**
 * Returns the currently signed-in Firebase user, or null if unauthenticated.
 */
export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

export const USERS_COLLECTION = "users";
export const LISTINGS_COLLECTION = "listings";
export const THREADS_COLLECTION = "threads";
export const MESSAGES_SUBCOLLECTION = "messages";

/**
 * Save or update a student profile document in the Firestore "users" collection.
 */
export async function saveUserProfile(profile: StudentProfile): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, USERS_COLLECTION, profile.uid);
    const cleanData = Object.fromEntries(
      Object.entries(profile).filter(([_, v]) => v !== undefined),
    );
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`[Firebase] Failed to save profile for ${profile.uid} to Firestore:`, err);
    throw err;
  }
}

/**
 * Fetch a student profile document from the Firestore "users" collection.
 */
export async function fetchUserProfile(uid: string): Promise<StudentProfile | null> {
  if (!db || !isFirebaseConfigured()) return null;
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as StudentProfile;
  } catch (err) {
    console.error(`[Firebase] Failed to fetch profile for ${uid} from Firestore:`, err);
    return null;
  }
}

/**
 * Save or update a listing document in the Firestore "listings" collection.
 */
export async function saveListingToFirestore(
  listing: Listing,
  options?: { deletePrice?: boolean; deleteExchangePref?: boolean },
): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error("Firebase is not initialized or configured.");
  }
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listing.id);
    // Remove undefined values to comply with Firestore document constraints
    const cleanData: Record<string, unknown> = Object.fromEntries(
      Object.entries(listing).filter(([_, v]) => v !== undefined),
    );
    if (options?.deletePrice) {
      cleanData["price"] = deleteField();
    }
    if (options?.deleteExchangePref) {
      cleanData["exchangePref"] = deleteField();
    }
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`[Firebase] Failed to save listing ${listing.id} to Firestore:`, err);
    throw err;
  }
}

/**
 * Delete a listing document from the Firestore "listings" collection.
 */
export async function deleteListingFromFirestore(listingId: string): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`[Firebase] Failed to delete listing ${listingId} from Firestore:`, err);
    throw err;
  }
}

/**
 * Fetch all listings from the Firestore "listings" collection.
 */
export async function fetchListingsFromFirestore(): Promise<Listing[]> {
  if (!db || !isFirebaseConfigured()) return [];
  try {
    const colRef = collection(db, LISTINGS_COLLECTION);
    const snap = await getDocs(query(colRef));
    const listings: Listing[] = [];
    snap.forEach((d) => {
      listings.push(d.data() as Listing);
    });
    return listings;
  } catch (err) {
    console.error("[Firebase] Failed to fetch listings from Firestore:", err);
    return [];
  }
}

/**
 * Subscribe to real-time updates from the Firestore "listings" collection.
 */
export function subscribeToListings(
  onListingsUpdate: (listings: Listing[]) => void,
): Unsubscribe | null {
  if (!db || !isFirebaseConfigured() || typeof window === "undefined") {
    return null;
  }
  try {
    const colRef = collection(db, LISTINGS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: Listing[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as Listing);
        });
        if (items.length > 0) {
          onListingsUpdate(items);
        }
      },
      (err) => {
        console.warn("[Firebase] Realtime snapshot listener error:", err);
      },
    );
  } catch (err) {
    console.warn("[Firebase] Could not attach Firestore listener:", err);
    return null;
  }
}

export interface CreateThreadInput {
  kind: "chat" | "request";
  listingId: string;
  creatorId: string;
  recipientId: string;
  subject: string;
}

/**
 * Computes a deterministic thread ID for a listing and two participants.
 * Sorted participant IDs guarantee that both participants resolve to the exact same thread document ID.
 *
 * Format:
 * - chat:    "t_chat_{listingId}_{sortedUidA}_{sortedUidB}"
 * - request: "t_req_{listingId}_{sortedUidA}_{sortedUidB}"
 */
export function getDeterministicThreadId(
  kind: "chat" | "request",
  listingId: string,
  uidA: string,
  uidB: string,
): string {
  // 1. Explicitly validate thread kind
  if (kind !== "chat" && kind !== "request") {
    throw new Error(
      `[Firebase] Invalid thread kind '${kind}'. Must be explicitly 'chat' or 'request'.`,
    );
  }

  // 2. Reject invalid or ambiguous inputs instead of silently normalizing
  const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

  if (!listingId || typeof listingId !== "string" || !ID_PATTERN.test(listingId)) {
    throw new Error(
      `[Firebase] Invalid listingId '${listingId}'. Must be a non-empty string matching /^[a-zA-Z0-9_-]{1,128}$/ without whitespace or special characters.`,
    );
  }

  if (!uidA || typeof uidA !== "string" || !ID_PATTERN.test(uidA)) {
    throw new Error(
      `[Firebase] Invalid participant UID '${uidA}'. Must be a non-empty string matching /^[a-zA-Z0-9_-]{1,128}$/ without whitespace or special characters.`,
    );
  }

  if (!uidB || typeof uidB !== "string" || !ID_PATTERN.test(uidB)) {
    throw new Error(
      `[Firebase] Invalid participant UID '${uidB}'. Must be a non-empty string matching /^[a-zA-Z0-9_-]{1,128}$/ without whitespace or special characters.`,
    );
  }

  if (listingId.includes("__") || uidA.includes("__") || uidB.includes("__")) {
    throw new Error(
      "[Firebase] Ambiguity error: listingId and participant UIDs must not contain consecutive underscores ('__').",
    );
  }

  if (uidA === uidB) {
    throw new Error(
      "[Firebase] Cannot create a conversation with yourself (identical participants).",
    );
  }

  const [u1, u2] = [uidA, uidB].sort();
  const prefix = kind === "chat" ? "t_chat" : "t_req";
  return `${prefix}_${listingId}_${u1}_${u2}`;
}

/**
 * Fetches an existing thread or creates a new one using a Firestore transaction.
 * Validates existing thread metadata before reuse to prevent collision or corruption.
 */
export async function getOrCreateThreadInFirestore(
  threadData: CreateThreadInput,
): Promise<FirestoreThread> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error("[Firebase] Firestore is not initialized or configured.");
  }

  const currentAuthUser = getCurrentUser();
  if (!currentAuthUser) {
    throw new Error("[Firebase] Authentication required to create or access conversation threads.");
  }

  if (currentAuthUser.uid !== threadData.creatorId) {
    throw new Error("[Firebase] Creator UID must match the authenticated user.");
  }

  if (threadData.creatorId === threadData.recipientId) {
    throw new Error("[Firebase] Cannot create a conversation with yourself.");
  }

  const threadId = getDeterministicThreadId(
    threadData.kind,
    threadData.listingId,
    threadData.creatorId,
    threadData.recipientId,
  );

  const threadRef = doc(db, THREADS_COLLECTION, threadId);

  return await runTransaction(db, async (transaction) => {
    const threadSnap = await transaction.get(threadRef);

    if (threadSnap.exists()) {
      const existing = threadSnap.data() as FirestoreThread;

      // 1. Verify exact ID
      if (existing.id !== threadId) {
        throw new Error(
          `[Firebase] Thread integrity error: Document ID '${existing.id}' does not match expected deterministic ID '${threadId}'.`,
        );
      }

      // 2. Verify listingId
      if (existing.listingId !== threadData.listingId) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread listingId '${existing.listingId}' does not match requested '${threadData.listingId}'.`,
        );
      }

      // 3. Verify kind
      if (existing.kind !== threadData.kind) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread kind '${existing.kind}' does not match requested '${threadData.kind}'.`,
        );
      }

      // 4. Verify creatorId
      if (existing.creatorId !== threadData.creatorId) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread creatorId '${existing.creatorId}' does not match requested '${threadData.creatorId}'.`,
        );
      }

      // 5. Verify recipientId
      if (existing.recipientId !== threadData.recipientId) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread recipientId '${existing.recipientId}' does not match requested '${threadData.recipientId}'.`,
        );
      }

      // 6. Verify participantIds: exactly the two expected UIDs, with no duplicates
      const isParticipantsValid =
        Array.isArray(existing.participantIds) &&
        existing.participantIds.length === 2 &&
        existing.participantIds.includes(threadData.creatorId) &&
        existing.participantIds.includes(threadData.recipientId) &&
        existing.participantIds[0] !== existing.participantIds[1];

      if (!isParticipantsValid) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread participants [${existing.participantIds?.join(", ")}] do not match expected [${threadData.creatorId}, ${threadData.recipientId}].`,
        );
      }

      // 7. Verify status for the thread kind and lifecycle
      const validStatusesForKind: Record<"chat" | "request", ThreadStatus[]> = {
        chat: ["active"],
        request: ["pending", "accepted", "declined", "completed"],
      };

      if (!validStatusesForKind[existing.kind]?.includes(existing.status)) {
        throw new Error(
          `[Firebase] Thread integrity error: Existing thread has invalid status '${existing.status}' for kind '${existing.kind}'.`,
        );
      }

      return existing;
    }

    // New thread creation
    const initialStatus: ThreadStatus = threadData.kind === "chat" ? "active" : "pending";
    const now = serverTimestamp();

    // Must NOT contain any lastMessage fields per firestore.rules
    const newDocData = {
      id: threadId,
      creatorId: threadData.creatorId,
      recipientId: threadData.recipientId,
      participantIds: [threadData.creatorId, threadData.recipientId],
      listingId: threadData.listingId,
      kind: threadData.kind,
      status: initialStatus,
      subject:
        threadData.subject.trim() ||
        (threadData.kind === "chat" ? "Conversation" : "Exchange Request"),
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(threadRef, newDocData);

    return {
      ...newDocData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } as FirestoreThread;
  });
}

/**
 * Sends a message and updates the parent thread's summary atomically using writeBatch.
 * Validates sender identity against the authenticated user to prevent impersonation.
 *
 * NOTE on SDK limitation:
 * The Firebase Web/Client JS SDK does not provide a create-only batch operation (`batch.create()`
 * only exists in the Firebase Admin Node.js SDK). To guarantee create-only semantics and prevent
 * accidental message overwrites:
 * 1. An explicit client-side check (`getDoc`) verifies that the message does not already exist.
 * 2. The database-level Firestore security rules enforce `!exists(msgPath) && existsAfter(msgPath)`
 *    in `isValidBatchMessageUpdate()` and `allow update: if false` on messages.
 *
 * NOTE on callerName:
 * `callerName` is intentionally omitted from the Firestore message document. The authenticated
 * `callerUid` is the sole authoritative identity in Firestore; display names are resolved
 * dynamically from verified student profiles to prevent client-side name spoofing.
 */
export async function sendMessageBatchToFirestore(
  threadId: string,
  messageId: string,
  text: string,
  callerUid: string,
  callerName?: string,
): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error("[Firebase] Firestore is not initialized or configured.");
  }

  const currentAuthUser = getCurrentUser();
  if (!currentAuthUser) {
    throw new Error("[Firebase] Authentication required to send messages.");
  }

  if (currentAuthUser.uid !== callerUid) {
    throw new Error("[Firebase] Sender UID must match the authenticated user.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("[Firebase] Message text cannot be empty.");
  }
  if (cleanText.length > 2000) {
    throw new Error("[Firebase] Message text exceeds the 2000 character limit.");
  }

  const cleanMessageId = messageId.trim();
  if (!cleanMessageId) {
    throw new Error("[Firebase] A valid messageId is required.");
  }

  void callerName;

  const messageRef = doc(db, THREADS_COLLECTION, threadId, MESSAGES_SUBCOLLECTION, cleanMessageId);

  // Client-side pre-check against accidental message overwrite (safest supported alternative in Client SDK)
  const existingMessageSnap = await getDoc(messageRef);
  if (existingMessageSnap.exists()) {
    throw new Error(
      `[Firebase] Message overwrite blocked: Document with ID '${cleanMessageId}' already exists in thread '${threadId}'.`,
    );
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();

  // 1. Message Document in subcollection: /threads/{threadId}/messages/{messageId}
  const messageData = {
    id: cleanMessageId,
    senderId: callerUid,
    text: cleanText,
    createdAt: now,
  };
  batch.set(messageRef, messageData);

  // 2. Thread Summary update: /threads/{threadId}
  // Rules require Operation A: lastMessageId, lastMessageText, lastMessageTime, lastMessageSenderId, updatedAt
  const threadRef = doc(db, THREADS_COLLECTION, threadId);
  batch.update(threadRef, {
    lastMessageId: cleanMessageId,
    lastMessageText: cleanText,
    lastMessageTime: now,
    lastMessageSenderId: callerUid,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error(`[Firebase] Failed to send message in thread ${threadId}:`, err);
    throw err;
  }
}

/**
 * Updates a thread's status (e.g. accepted, declined, completed) in Firestore.
 * Strictly enforces that only status and updatedAt are modified.
 */
export async function updateThreadStatusInFirestore(
  threadId: string,
  newStatus: ThreadStatus,
  callerUid: string,
): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error("[Firebase] Firestore is not initialized or configured.");
  }

  const currentAuthUser = getCurrentUser();
  if (!currentAuthUser) {
    throw new Error("[Firebase] Authentication required to update thread status.");
  }

  if (currentAuthUser.uid !== callerUid) {
    throw new Error("[Firebase] Caller UID must match the authenticated user.");
  }

  const threadRef = doc(db, THREADS_COLLECTION, threadId);

  try {
    await updateDoc(threadRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(`[Firebase] Failed to update thread ${threadId} status to ${newStatus}:`, err);
    throw err;
  }
}

/**
 * Real-time listener for all conversation threads where the user is a participant.
 * Uses array-contains query filter matching Firestore security rules.
 * Sorts threads in memory by updatedAt descending.
 * Returns an Unsubscribe function.
 */
export function subscribeToUserThreads(
  uid: string,
  onUpdate: (threads: FirestoreThread[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db || !isFirebaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  const colRef = collection(db, THREADS_COLLECTION);
  const q = query(colRef, where("participantIds", "array-contains", uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const threads: FirestoreThread[] = [];
      snapshot.forEach((d) => {
        threads.push(d.data() as FirestoreThread);
      });

      // Sort by updatedAt descending in memory
      threads.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() ?? 0;
        const timeB = b.updatedAt?.toMillis?.() ?? 0;
        return timeB - timeA;
      });

      onUpdate(threads);
    },
    (err) => {
      console.error(`[Firebase] Error in threads listener for user ${uid}:`, err);
      onError?.(err);
    },
  );
}

/**
 * Real-time listener for messages in a specific thread subcollection.
 * Orders messages by createdAt ascending.
 * Returns an Unsubscribe function.
 */
export function subscribeToThreadMessages(
  threadId: string,
  onUpdate: (messages: FirestoreChatMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db || !isFirebaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  const colRef = collection(db, THREADS_COLLECTION, threadId, MESSAGES_SUBCOLLECTION);
  const q = query(colRef, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: FirestoreChatMessage[] = [];
      snapshot.forEach((d) => {
        messages.push(d.data() as FirestoreChatMessage);
      });

      // Ensure stable client-side sort
      messages.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() ?? 0;
        const timeB = b.createdAt?.toMillis?.() ?? 0;
        return timeA - timeB;
      });

      onUpdate(messages);
    },
    (err) => {
      console.error(`[Firebase] Error in messages listener for thread ${threadId}:`, err);
      onError?.(err);
    },
  );
}
