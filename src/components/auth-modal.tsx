import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authActions } from "@/lib/auth";
import { Loader2, LogIn, Sparkles, UserPlus } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "signin" | "signup";
  onSuccess?: () => void;
}

const departments = [
  "Computer Science",
  "Media Arts",
  "Chemistry",
  "Business",
  "Mechanical Eng",
  "Electrical Eng",
  "Architecture",
  "Music",
  "Mathematics",
];

const years = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Graduated"];

export function AuthModal({
  open,
  onOpenChange,
  defaultMode = "signin",
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(departments[0]!);
  const [year, setYear] = useState(years[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  }

  function handleModeChange(newMode: "signin" | "signup") {
    setMode(newMode);
    setError(null);
  }

  function formatFirebaseError(err: unknown): string {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = String((err as { code: unknown }).code);
      switch (code) {
        case "auth/email-already-in-use":
          return "An account with this email already exists. Try signing in instead.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          return "Incorrect email or password. Please verify and try again.";
        case "auth/weak-password":
          return "Password should be at least 6 characters.";
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/operation-not-allowed":
          return "Email/Password sign-in is not enabled in Firebase Console. Please enable it under Auth -> Sign-in method.";
        case "auth/too-many-requests":
          return "Too many attempts. Please wait a few moments and try again.";
        default:
          return (
            (err as { message?: string }).message || "Authentication failed. Please try again."
          );
      }
    }
    return err instanceof Error ? err.message : "Something went wrong. Please try again.";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await authActions.signIn(email, password);
      } else {
        await authActions.signUp({
          email,
          password,
          name,
          department,
          year,
        });
      }
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card p-6 sm:rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              R
            </div>
            <DialogTitle className="font-heading text-xl font-bold tracking-tight">
              {mode === "signin" ? "Sign in to REXchange" : "Join Your Campus Marketplace"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === "signin"
              ? "Access your listings, AI matches, and campus reputation."
              : "Create your student account to trade gear, notes, and skills safely."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="mt-2 flex rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleModeChange("signin")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "signin"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("signup")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "signup"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Join Campus (Sign Up)
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohan Patel"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Campus Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@university.edu"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Academic Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "signin" ? (
              <>
                <LogIn className="size-4" /> Sign In
              </>
            ) : (
              <>
                <UserPlus className="size-4" /> Join REXchange
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-primary" />
          <span>Student peer-to-peer verified · 100% free campus trades</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
