import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { currentUser } from "@/lib/data";
import { useAppState } from "@/lib/store";
import { Avatar } from "./ui-bits";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/explore", label: "Explore" },
  { to: "/matches", label: "AI Match" },
  { to: "/messages", label: "Messages" },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="grid size-5 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              R
            </div>
            <span className="font-heading font-bold text-foreground">REXchange</span>
          </div>
          <p>Built by students, for students · North Campus community</p>
        </div>
      </footer>
    </div>
  );
}

function AppNav() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { threads } = useAppState();
  const pendingCount = threads.filter((t) => t.kind === "request" && t.status === "pending").length;

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigate({
      to: "/explore",
      search: { q: query.trim(), cat: "All", types: "", sort: "newest" },
    });
  }

  const linkClass =
    "relative rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              R
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-primary">
              REXchange
            </span>
          </Link>
          <div className="hidden items-center gap-4 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={linkClass}
                activeProps={{ className: `${linkClass} text-primary` }}
              >
                {link.label}
                {link.label === "Messages" && pendingCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <form onSubmit={onSearch} className="hidden max-w-md flex-1 px-4 sm:block">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full rounded-full border-0 bg-muted py-1.5 pl-10 pr-3 text-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Search books, gear, skills…"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/create"
            className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark sm:inline-flex sm:items-center sm:gap-1"
          >
            <Plus className="size-4" /> Create Listing
          </Link>
          <Link to="/create" className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground sm:hidden" aria-label="Create listing">
            <Plus className="size-5" />
          </Link>
          <Link to="/profile" className="flex items-center gap-3 border-l border-border pl-3">
            <div className="hidden text-right md:block">
              <p className="text-xs font-semibold">{currentUser.name}</p>
              <p className="text-[10px] text-muted-foreground">Rep: {currentUser.rating} ★</p>
            </div>
            <Avatar student={currentUser} className="size-9 text-xs ring-2 ring-border" />
          </Link>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
            activeProps={{ className: "whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground" }}
          >
            {link.label}
          </Link>
        ))}
        <Link
          to="/profile"
          className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
          activeProps={{ className: "whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground" }}
        >
          Profile
        </Link>
      </div>
    </nav>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>;
}
