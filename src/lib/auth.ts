import { useSyncExternalStore } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  type User,
} from "firebase/auth";
import { auth, fetchUserProfile, saveUserProfile, isFirebaseConfigured } from "../firebase";
import type { StudentProfile } from "./types";

export interface AuthState {
  user: User | null;
  profile: StudentProfile | null;
  isLoading: boolean;
  error: string | null;
}

const departmentColors: Record<string, string> = {
  "Computer Science": "#6366f1",
  "Media Arts": "#0ea5e9",
  Chemistry: "#10b981",
  Business: "#ec4899",
  "Mechanical Eng": "#8b5cf6",
  "Electrical Eng": "#14b8a6",
  Architecture: "#f97316",
  Music: "#84cc16",
  Mathematics: "#ef4444",
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function getDepartmentColor(department: string): string {
  return departmentColors[department] || "#6366f1";
}

function formatJoinedDate(d = new Date()): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

const serverSnapshot: AuthState = {
  user: null,
  profile: null,
  isLoading: true,
  error: null,
};

let currentAuthState: AuthState = {
  user: null,
  profile: null,
  isLoading: typeof window !== "undefined",
  error: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function setAuthState(patch: Partial<AuthState>) {
  currentAuthState = { ...currentAuthState, ...patch };
  emitChange();
}

const KNOWN_PROFILES_STORAGE_KEY = "rexchange_known_profiles_v1";

// In-memory cache for loaded student profiles
const profileCache = new Map<string, StudentProfile>();

function loadProfilesFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KNOWN_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((p: StudentProfile) => {
          if (p && p.uid) {
            profileCache.set(p.uid, p);
          }
        });
      }
    }
  } catch (err) {
    console.warn("[Auth] Failed to load cached profiles from storage:", err);
  }
}

// Load persisted profiles on init
loadProfilesFromStorage();

export function cacheProfile(profile: StudentProfile): void {
  if (!profile?.uid) return;
  profileCache.set(profile.uid, profile);
  if (typeof window !== "undefined") {
    try {
      const all = Array.from(profileCache.values());
      window.localStorage.setItem(KNOWN_PROFILES_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore storage quota error
    }
  }
}

export function getCachedProfile(uid: string): StudentProfile | undefined {
  if (!uid) return undefined;
  let p = profileCache.get(uid);
  if (!p && typeof window !== "undefined") {
    loadProfilesFromStorage();
    p = profileCache.get(uid);
  }
  return p;
}

export function clearProfileCache(): void {
  profileCache.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KNOWN_PROFILES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

let lastAuthenticatedUid: string | null = null;

// Initialize real-time auth listener in browser
if (typeof window !== "undefined" && isFirebaseConfigured() && auth) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      lastAuthenticatedUid = null;
      setAuthState({ user: null, profile: null, isLoading: false, error: null });
      return;
    }

    if (firebaseUser.isAnonymous) {
      // Clean up any legacy anonymous session stored in browser IndexedDB from prior tests
      if (auth) void fbSignOut(auth);
      lastAuthenticatedUid = null;
      setAuthState({ user: null, profile: null, isLoading: false, error: null });
      return;
    }

    lastAuthenticatedUid = firebaseUser.uid;

    try {
      let profile = getCachedProfile(firebaseUser.uid);
      if (!profile) {
        profile = (await fetchUserProfile(firebaseUser.uid)) ?? undefined;
      }

      if (!profile) {
        // Construct fallback profile if document doesn't exist yet
        const name = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Student";
        profile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name,
          email: firebaseUser.email || "",
          initials: getInitials(name),
          color: "#6366f1",
          department: "Computer Science",
          year: "Year 1",
          rating: 5.0,
          exchanges: 0,
          joined: formatJoinedDate(),
          bio: "Student on REXchange.",
        };
        void saveUserProfile(profile);
      }

      cacheProfile(profile);
      setAuthState({
        user: firebaseUser,
        profile,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.warn("[Auth] Failed to load user profile:", err);
      profileCache.delete(firebaseUser.uid);
      setAuthState({
        user: firebaseUser,
        profile: null,
        isLoading: false,
        error: null,
      });
    }
  });
}

/**
 * Reactive hook to access the current authenticated student session.
 */
export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentAuthState,
    () => serverSnapshot,
  );
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  department: string;
  year: string;
  bio?: string;
}

export const authActions = {
  async signUp({
    email,
    password,
    name,
    department,
    year,
    bio,
  }: SignUpParams): Promise<StudentProfile> {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    setAuthState({ isLoading: true, error: null });

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try {
        await fbUpdateProfile(cred.user, { displayName: name.trim() });
      } catch {
        // non-blocking
      }
      const uid = cred.user.uid;

      const profile: StudentProfile = {
        id: uid,
        uid,
        name: name.trim(),
        email: email.trim(),
        initials: getInitials(name),
        color: getDepartmentColor(department),
        department,
        year,
        rating: 5.0,
        exchanges: 0,
        joined: formatJoinedDate(),
        bio: bio?.trim() || `${department} student · North Campus.`,
      };

      await saveUserProfile(profile);
      cacheProfile(profile);
      lastAuthenticatedUid = uid;

      setAuthState({
        user: cred.user,
        profile,
        isLoading: false,
        error: null,
      });

      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign up";
      setAuthState({ isLoading: false, error: msg });
      throw err;
    }
  },

  async signIn(email: string, password: string): Promise<StudentProfile | null> {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    setAuthState({ isLoading: true, error: null });

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      const profile = await fetchUserProfile(uid);

      if (profile) {
        cacheProfile(profile);
      }
      lastAuthenticatedUid = uid;

      setAuthState({
        user: cred.user,
        profile,
        isLoading: false,
        error: null,
      });

      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setAuthState({ isLoading: false, error: msg });
      throw err;
    }
  },

  async signOut(): Promise<void> {
    if (!auth) return;
    setAuthState({ isLoading: true, error: null });
    try {
      await fbSignOut(auth);
      lastAuthenticatedUid = null;
      setAuthState({
        user: null,
        profile: null,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      console.error("[Auth] Sign out error:", err);
      const msg = err instanceof Error ? err.message : "Failed to sign out";
      setAuthState({ isLoading: false, error: msg });
    }
  },

  async updateProfile(updates: Partial<StudentProfile>): Promise<StudentProfile> {
    const current = currentAuthState.profile;
    if (!current) throw new Error("No student is currently signed in");

    const updated: StudentProfile = {
      ...current,
      ...updates,
      initials: updates.name ? getInitials(updates.name) : current.initials,
      color: updates.department ? getDepartmentColor(updates.department) : current.color,
    };

    await saveUserProfile(updated);
    cacheProfile(updated);
    setAuthState({ profile: updated });
    return updated;
  },
};
