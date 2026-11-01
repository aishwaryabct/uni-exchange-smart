import type { Timestamp } from "firebase/firestore";

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

export interface StudentProfile extends Student {
  uid: string;
  email: string;
}

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: Category;
  condition: string;
  type: ListingType;
  price?: number | undefined;
  exchangePref?: string | undefined;
  department: string;
  year: string;
  availability: string;
  image?: string | undefined;
  postedHours: number;
  keywords: string[];
  ownerName?: string | undefined;
  ownerInitials?: string | undefined;
}

export interface FirestoreChatMessage {
  id: string;
  senderId: string;
  senderName?: string | undefined;
  text: string;
  createdAt: Timestamp;
}

export type FirestoreMessage = FirestoreChatMessage;

export type ThreadStatus = "active" | "pending" | "accepted" | "declined" | "completed";

export interface FirestoreThread {
  id: string;
  creatorId: string;
  recipientId: string;
  participantIds: string[];
  listingId: string;
  kind: "chat" | "request";
  status: ThreadStatus;
  subject: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessageId?: string | undefined;
  lastMessageText?: string | undefined;
  lastMessageTime?: Timestamp | undefined;
  lastMessageSenderId?: string | undefined;
}

export type FirestoreThreadDoc = FirestoreThread;

export interface LegacyChatMessage {
  id: string;
  fromId: string;
  text: string;
  time: string;
}

export interface LegacyThread {
  id: string;
  studentId: string;
  creatorId?: string | undefined;
  recipientId?: string | undefined;
  participantIds?: string[] | undefined;
  listingId?: string | undefined;
  kind?: "chat" | "request" | undefined;
  status: ThreadStatus;
  subject: string;
  messages: LegacyChatMessage[];
}

export interface ChatMessage {
  id: string;
  fromId: string;
  text: string;
  time: string;
  senderId?: string | undefined;
  senderName?: string | undefined;
  createdAt?: Timestamp | undefined;
}

export interface Thread {
  id: string;
  studentId: string;
  creatorId: string;
  recipientId: string;
  participantIds: string[];
  listingId?: string | undefined;
  kind: "chat" | "request";
  status: ThreadStatus;
  subject: string;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
  lastMessageId?: string | undefined;
  lastMessageText?: string | undefined;
  lastMessageTime?: Timestamp | undefined;
  lastMessageSenderId?: string | undefined;
  messages: ChatMessage[];
}

export function firestoreMessageToChatMessage(
  msg: FirestoreChatMessage,
  formattedTime?: string,
  senderName?: string,
): ChatMessage {
  return {
    id: msg.id,
    fromId: msg.senderId,
    senderId: msg.senderId,
    senderName: msg.senderName ?? senderName,
    text: msg.text,
    createdAt: msg.createdAt,
    time: formattedTime ?? "Recently",
  };
}

export function firestoreThreadToThread(
  thread: FirestoreThread,
  messages: ChatMessage[] = [],
): Thread {
  return {
    id: thread.id,
    studentId: thread.recipientId,
    creatorId: thread.creatorId,
    recipientId: thread.recipientId,
    participantIds: thread.participantIds,
    listingId: thread.listingId,
    kind: thread.kind,
    status: thread.status,
    subject: thread.subject,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessageId: thread.lastMessageId,
    lastMessageText: thread.lastMessageText,
    lastMessageTime: thread.lastMessageTime,
    lastMessageSenderId: thread.lastMessageSenderId,
    messages,
  };
}

export function legacyThreadToThread(legacy: LegacyThread, currentUserId?: string): Thread {
  const creatorId = legacy.creatorId ?? currentUserId ?? legacy.studentId;
  const recipientId = legacy.recipientId ?? legacy.studentId;
  const participantIds =
    legacy.participantIds && legacy.participantIds.length >= 2
      ? legacy.participantIds
      : Array.from(new Set([creatorId, recipientId]));

  return {
    id: legacy.id,
    studentId: legacy.studentId,
    creatorId,
    recipientId,
    participantIds,
    listingId: legacy.listingId,
    kind: legacy.kind ?? "chat",
    status: legacy.status,
    subject: legacy.subject,
    messages: (legacy.messages || []).map((m) => ({
      id: m.id,
      fromId: m.fromId,
      senderId: m.fromId,
      senderName: (m as { senderName?: string }).senderName,
      text: m.text,
      time: m.time,
    })),
  };
}

export interface Review {
  id: string;
  fromName: string;
  fromId: string;
  rating: number;
  text: string;
  date: string;
}
