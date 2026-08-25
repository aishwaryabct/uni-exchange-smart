import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import type { Listing } from "./lib/types";

// Firebase web configuration provided by the user
export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] || "AIzaSyDqIc3WP_AeRBBWmyKEQUhTx58xRNhlCGM",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] || "workspace-8a6f1.firebaseapp.com",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] || "workspace-8a6f1",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] || "workspace-8a6f1.firebasestorage.app",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] || "962874559602",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] || "1:962874559602:web:8317d0feb3daf10bf846eb",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || "G-34F57YVKME",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== "your-api-key" &&
    firebaseConfig.projectId !== "your-project-id",
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
      isSupported().then((supported) => {
        if (supported && app) {
          analytics = getAnalytics(app);
        }
      }).catch(() => {
        // Analytics not supported in this environment
      });
    }
  }
} catch (err) {
  console.warn("[Firebase] Initialization skipped or error:", err);
}

export { app, db, auth, analytics };

let authPromise: Promise<User | null> | null = null;

/**
 * Ensures an active authenticated session exists (via Anonymous Auth)
 * before performing Firestore operations.
 */
export async function ensureAuth(): Promise<User | null> {
  if (!auth || !isFirebaseConfigured()) return null;
  if (auth.currentUser) return auth.currentUser;
  if (!authPromise) {
    authPromise = new Promise((resolve) => {
      if (!auth) return resolve(null);
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        } else {
          signInAnonymously(auth!)
            .then((cred) => {
              unsubscribe();
              resolve(cred.user);
            })
            .catch((err) => {
              console.warn("[Firebase] Anonymous sign-in error:", err);
              unsubscribe();
              resolve(null);
            });
        }
      });
    });
  }
  return authPromise;
}

// Automatically ensure auth session in browser
if (typeof window !== "undefined" && isFirebaseConfigured()) {
  void ensureAuth();
}

export const LISTINGS_COLLECTION = "listings";

/**
 * Save or update a listing document in the Firestore "listings" collection.
 */
export async function saveListingToFirestore(listing: Listing): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  try {
    await ensureAuth();
    const docRef = doc(db, LISTINGS_COLLECTION, listing.id);
    // Remove undefined values to comply with Firestore document constraints
    const cleanData = Object.fromEntries(
      Object.entries(listing).filter(([_, v]) => v !== undefined),
    );
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`[Firebase] Failed to save listing ${listing.id} to Firestore:`, err);
  }
}

/**
 * Delete a listing document from the Firestore "listings" collection.
 */
export async function deleteListingFromFirestore(listingId: string): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  try {
    await ensureAuth();
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`[Firebase] Failed to delete listing ${listingId} from Firestore:`, err);
  }
}

/**
 * Fetch all listings from the Firestore "listings" collection.
 */
export async function fetchListingsFromFirestore(): Promise<Listing[]> {
  if (!db || !isFirebaseConfigured()) return [];
  try {
    await ensureAuth();
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
    void ensureAuth();
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
