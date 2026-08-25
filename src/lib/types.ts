export type ListingType = "sell" | "exchange" | "giveaway" | "service" | "request";

export type Category =
  | "Books"
  | "Electronics"
  | "Event Tickets"
  | "Study Materials"
  | "Skills & Services"
  | "Gear & Lifestyle";

export const CATEGORIES: Category[] = [
  "Books",
  "Electronics",
  "Event Tickets",
  "Study Materials",
  "Skills & Services",
  "Gear & Lifestyle",
];

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "sell", label: "Sell" },
  { value: "exchange", label: "Exchange" },
  { value: "giveaway", label: "Give Away" },
  { value: "service", label: "Offer a Service" },
  { value: "request", label: "Request Something" },
];

export interface Student {
  id: string;
  name: string;
  initials: string;
  color: string;
  department: string;
  year: string;
  rating: number;
  exchanges: number;
  joined: string;
  bio: string;
}

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: Category;
  condition: string;
  type: ListingType;
  price?: number;
  exchangePref?: string;
  department: string;
  year: string;
  availability: string;
  image?: string;
  postedHours: number;
  keywords: string[];
}

export interface ChatMessage {
  id: string;
  fromId: string;
  text: string;
  time: string;
}

export type ThreadStatus = "active" | "pending" | "accepted" | "declined" | "completed";

export interface Thread {
  id: string;
  studentId: string;
  listingId?: string;
  kind: "chat" | "request";
  status: ThreadStatus;
  subject: string;
  messages: ChatMessage[];
}

export interface Review {
  id: string;
  fromName: string;
  fromId: string;
  rating: number;
  text: string;
  date: string;
}
