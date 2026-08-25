import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Gift,
  Laptop,
  Megaphone,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Wrench,
} from "lucide-react";
import imgCamera from "@/assets/listing-camera.jpg";
import imgStatsBook from "@/assets/listing-stats-book.jpg";
import { CATEGORIES } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const exchangeTypes = [
  {
    icon: Repeat2,
    title: "Exchange & Swap",
    desc: "Direct two-way trades. Swap your old gear or notes for what you need this term.",
    badge: "EXCHANGE",
    badgeCls: "bg-primary text-primary-foreground",
  },
  {
    icon: Sparkles,
    title: "AI Smart Match",
    desc: "Instant matching between requests and listings with fit score and rationale.",
    badge: "AI POWERED",
    badgeCls: "bg-mint text-mint-foreground",
  },
  {
    icon: Tag,
    title: "Sell & Buy",
    desc: "Fair campus-friendly pricing for textbooks, electronics, and supplies.",
    badge: "SELL",
    badgeCls: "bg-ink text-ink-foreground",
  },
  {
    icon: Gift,
    title: "Giveaways",
    desc: "Pass forward unused materials, lab coats, and books to junior classmates for free.",
    badge: "GIVE AWAY",
    badgeCls: "bg-mint text-mint-foreground",
  },
  {
    icon: Wrench,
    title: "Skills & Tutoring",
    desc: "Offer or book peer coding help, exam tutoring, design reviews, and repairs.",
    badge: "SERVICE",
    badgeCls: "bg-amber text-amber-foreground",
  },
  {
    icon: Megaphone,
    title: "Request Anything",
    desc: "Post a request and let classmates come to you with matching offers.",
    badge: "REQUEST",
    badgeCls: "bg-foreground text-background",
  },
];

const categoryIcons: Record<string, typeof BookOpen> = {
  Books: BookOpen,
  Electronics: Laptop,
  "Event Tickets": Ticket,
  "Study Materials": BookOpen,
  "Skills & Services": Wrench,
  "Gear & Lifestyle": Laptop,
};

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary font-heading text-base font-extrabold text-primary-foreground shadow-sm shadow-primary/30">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                REXchange
              </span>
              <span className="text-[10px] font-semibold text-primary">Campus Connect</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              to="/explore"
              search={{ q: "", cat: "All", types: "", sort: "newest" }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Explore Marketplace
            </Link>
            <Link
              to="/matches"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Sparkles className="size-3.5 text-primary" /> AI Match
            </Link>
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/explore"
              search={{ q: "", cat: "All", types: "", sort: "newest" }}
              className="hidden text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              Browse Listings
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
            >
              Explore REXchange <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/40 via-background to-background pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Left Copy */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/80 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs backdrop-blur-sm">
                <span className="size-2 animate-pulse-dot rounded-full bg-mint" />
                <span>The Smart Campus Exchange Marketplace</span>
              </div>

              <h1 className="mt-5 font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
                Trade unused gear, notes & skills within your campus.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                REXchange is the college-only exchange platform where students buy, swap, give away,
                and offer services safely within their university community — matched automatically by
                our campus AI engine.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary-dark hover:shadow-lg"
                >
                  Explore REXchange <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/explore"
                  search={{ q: "", cat: "All", types: "", sort: "newest" }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-bold text-foreground shadow-xs transition-colors hover:bg-accent"
                >
                  Browse Live Marketplace
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <p className="font-heading text-2xl font-bold text-primary">100%</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Student Verified (.edu)</p>
                </div>
                <div>
                  <p className="font-heading text-2xl font-bold text-mint">₹0 Fees</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Direct Peer-to-Peer</p>
                </div>
                <div>
                  <p className="font-heading text-2xl font-bold text-foreground">AI Powered</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Relevance & Match Scores</p>
                </div>
              </div>
            </div>

            {/* Right Interactive Showcase */}
            <div className="relative lg:col-span-5">
              <div className="relative mx-auto max-w-md space-y-4">
                {/* AI Match Spotlight Card */}
                <div className="animate-rise rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-accent/40 p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Sparkles className="size-3 text-primary" /> Top AI Recommendation
                    </span>
                    <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-extrabold text-mint">
                      96% Match
                    </span>
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    <img
                      src={imgStatsBook}
                      alt="Intro to Statistics"
                      className="size-16 rounded-xl object-cover ring-1 ring-border"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-heading text-base font-bold text-foreground">
                        Intro to Statistics (STAT 201)
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Priya N. · Electrical Eng · Year 4
                      </p>
                      <span className="mt-1 inline-block text-xs font-bold text-primary">
                        Open to swap
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-accent/60 p-2.5 text-[11px] text-muted-foreground">
                    <p className="font-medium text-foreground">Why REX AI matched this:</p>
                    <p className="mt-0.5 leading-snug">
                      • Answers your request for STAT 201 textbook
                      <br />• Priya wants headphones — matches your Bose QC35 listing
                    </p>
                  </div>
                </div>

                {/* Second Mini Preview Card */}
                <div className="animate-rise rounded-2xl border border-border bg-card p-4 shadow-md [animation-delay:120ms]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold text-ink-foreground">
                        EXCHANGE
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Media Arts · North Campus
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary">Sony A6000 Kit</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <img
                      src={imgCamera}
                      alt="Camera"
                      className="size-12 rounded-lg object-cover"
                    />
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      Looking to swap mirrorless camera for noise-cancelling headphones or an iPad.
                    </p>
                  </div>
                </div>

                {/* Campus Trust Banner */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="size-5 shrink-0 text-mint" />
                  <span>
                    Safe, verified exchanges with student ratings & on-campus meetup spots.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Exchange Modes Section */}
      <section className="border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Versatile Campus Economy
            </span>
            <h2 className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              More than buying and selling.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Students don't always have cash. REXchange supports flexible options designed
              specifically for campus life.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exchangeTypes.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="card-hover relative flex flex-col rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                      <Icon className="size-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${item.badgeCls}`}>
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Explore Categories */}
      <section className="border-b border-border bg-accent/25 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Quick Browse
              </span>
              <h2 className="mt-1 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
                Explore by Category
              </h2>
            </div>
            <Link
              to="/explore"
              search={{ q: "", cat: "All", types: "", sort: "newest" }}
              className="text-xs font-bold text-primary hover:underline"
            >
              View all listings →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.map((cat) => {
              const Icon = categoryIcons[cat] ?? BookOpen;
              return (
                <Link
                  key={cat}
                  to="/explore"
                  search={{ q: "", cat, types: "", sort: "newest" }}
                  className="card-hover flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-primary/50"
                >
                  <div className="grid size-11 place-items-center rounded-full bg-accent text-primary">
                    <Icon className="size-5" />
                  </div>
                  <span className="mt-3 text-xs font-bold text-foreground">{cat}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-dark p-8 text-primary-foreground shadow-2xl sm:p-12">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="size-3.5" /> Hackathon Demo Edition
              </span>
              <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl text-balance">
                Ready to experience REXchange?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/90 sm:text-base">
                Jump into the demo dashboard to explore live student listings, test AI-powered
                matches, negotiate exchange requests, and see campus reputation ratings in action.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-card px-7 py-3.5 text-sm font-bold text-primary shadow-lg transition-all hover:bg-background"
                >
                  Launch Student Dashboard <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/create"
                  className="inline-flex items-center gap-2 rounded-full border border-card/30 bg-card/10 px-6 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-card/20"
                >
                  Post a Test Listing
                </Link>
              </div>
            </div>

            <div className="absolute -top-24 right-0 size-80 translate-x-1/4 rounded-full bg-card/10 blur-2xl" />
            <div className="absolute -bottom-24 right-20 size-72 rounded-full bg-mint/20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              R
            </div>
            <span className="font-heading font-bold text-foreground">REXchange</span>
            <span className="text-muted-foreground">· Campus Community Exchange</span>
          </div>
          <p>Built for the Hackathon · North Campus Community Edition</p>
        </div>
      </footer>
    </div>
  );
}
