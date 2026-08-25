import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gift, Image as ImageIcon, Megaphone, Plus, Repeat2, Tag, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageContainer } from "@/components/app-shell";
import { ListingCard } from "@/components/listing-card";
import { imagePool } from "@/lib/data";
import { actions } from "@/lib/store";
import { CATEGORIES, type Category, type Listing, type ListingType } from "@/lib/types";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Create a Listing — REXchange" },
      { name: "description", content: "Sell, exchange, give away, offer a service, or request something from your campus community." },
      { property: "og:title", content: "Create a Listing — REXchange" },
      { property: "og:description", content: "Post something for your campus community." },
    ],
  }),
  component: CreateListingPage,
});

const typeOptions: { value: ListingType; label: string; hint: string; icon: typeof Tag }[] = [
  { value: "sell", label: "Sell", hint: "Set a price and sell it", icon: Tag },
  { value: "exchange", label: "Exchange", hint: "Swap for something you need", icon: Repeat2 },
  { value: "giveaway", label: "Give Away", hint: "Free to a good home", icon: Gift },
  { value: "service", label: "Offer a Service", hint: "Tutoring, repairs, design help", icon: Wrench },
  { value: "request", label: "Request Something", hint: "Ask the campus for it", icon: Megaphone },
];

const conditions = ["New", "Like new", "Excellent", "Very good", "Good", "Fair", "Any"];

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground";

function CreateListingPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<ListingType>("exchange");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("Books");
  const [condition, setCondition] = useState("Good");
  const [price, setPrice] = useState("");
  const [exchangePref, setExchangePref] = useState("");
  const [availability, setAvailability] = useState("");
  const [imageIdx, setImageIdx] = useState(0);
  const [error, setError] = useState("");

  const preview: Listing = {
    id: "preview",
    ownerId: "u0",
    title: title || "Your listing title",
    description: description || "A short description will appear here — what is it, what shape is it in, and what do you want for it?",
    category,
    condition,
    type,
    price: type === "sell" && price ? Number(price) : undefined,
    exchangePref: type !== "sell" && type !== "giveaway" ? exchangePref || undefined : undefined,
    department: "Computer Science",
    year: "Year 3",
    availability: availability || "Flexible",
    image: imagePool[imageIdx]?.src,
    postedHours: 0,
    keywords: [],
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Give your listing a title and a short description — classmates scroll past empty posts.");
      return;
    }
    if (type === "sell" && !price.trim()) {
      setError("Set a price, or switch the listing type to Exchange / Give Away.");
      return;
    }
    const id = actions.addListing({
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      type,
      price: type === "sell" ? Number(price) || 0 : undefined,
      exchangePref: type !== "sell" && type !== "giveaway" ? exchangePref.trim() || undefined : undefined,
      availability: availability.trim() || "Flexible",
      image: imagePool[imageIdx]?.src,
      keywords: title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    });
    navigate({ to: "/listing/$id", params: { id } });
  }

  const showPrice = type === "sell";
  const showExchangePref = type === "exchange" || type === "service" || type === "request";

  return (
    <PageContainer>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">New listing</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
          Post it to the campus
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI engine will start matching your listing to classmates' requests as soon as it's
          live.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Listing type */}
          <div>
            <span className={labelCls}>What are you doing?</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-accent ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="title" className={labelCls}>
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "request" ? "Need: graphing calculator for STAT 201" : "Sony WH-1000XM4 headphones"
              }
              className={inputCls}
              maxLength={80}
            />
          </div>

          <div>
            <label htmlFor="description" className={labelCls}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Condition, history, why you're trading it, what you'd take for it…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className={labelCls}>
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="condition" className={labelCls}>
                Condition
              </label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={inputCls}
              >
                {conditions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {showPrice && (
            <div>
              <label htmlFor="price" className={labelCls}>
                Price ($)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25"
                className={inputCls}
              />
            </div>
          )}

          {showExchangePref && (
            <div>
              <label htmlFor="exchangePref" className={labelCls}>
                {type === "request" ? "What can you offer in return?" : "What would you take in exchange?"}
              </label>
              <input
                id="exchangePref"
                value={exchangePref}
                onChange={(e) => setExchangePref(e.target.value)}
                placeholder="e.g. a mechanical keyboard, tutoring hours, or $20"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label htmlFor="availability" className={labelCls}>
              Availability / pickup
            </label>
            <input
              id="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="Weekdays after 4pm · Main Hall"
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Photo</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {imagePool.map((img, i) => (
                <button
                  key={img.label}
                  type="button"
                  onClick={() => setImageIdx(i)}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${
                    imageIdx === i ? "border-primary" : "border-transparent hover:border-primary/40"
                  }`}
                  title={img.label}
                >
                  <img
                    src={img.src}
                    alt={img.label}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </button>
              ))}
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <ImageIcon className="size-3" /> Demo mode: pick a campus photo for your listing.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" /> Publish listing
          </button>
        </div>

        {/* Live preview */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <span className={labelCls}>Live preview</span>
            <div className="pointer-events-none max-w-xs">
              <ListingCard listing={preview} />
            </div>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
