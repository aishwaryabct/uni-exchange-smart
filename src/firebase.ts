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
import type { Listing } from "./lib/types";

// Firebase web configuration
// Populate these in your .env file or replace directly with your Firebase Console web config
export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] || "",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] || "",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] || "",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] || "",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] || "",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] || "",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || "",
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

try {
  if (isFirebaseConfigured()) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (err) {
  console.warn("[Firebase] Initialization skipped or error:", err);
}

export { app, db };

export const LISTINGS_COLLECTION = "listings";

/**
 * Save or update a listing document in the Firestore "listings" collection.
 */
export async function saveListingToFirestore(listing: Listing): Promise<void> {
  if (!db || !isFirebaseConfigured()) return;
  try {
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
