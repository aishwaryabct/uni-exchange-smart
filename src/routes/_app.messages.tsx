import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageContainer } from "@/components/app-shell";
import { AuthModal } from "@/components/auth-modal";
import { Avatar, StarInput } from "@/components/ui-bits";
import { subscribeToThreadMessages } from "@/firebase";
import { useAuth } from "@/lib/auth";
import { getStudent } from "@/lib/data";
import { actions, isThreadUnread, useAppState } from "@/lib/store";
import { firestoreMessageToChatMessage, type Thread } from "@/lib/types";

const messagesSearchSchema = z.object({
  thread: fallback(z.string(), "").default(""),
  threadId: fallback(z.string(), "").default(""),
  tab: fallback(z.string(), "chats").default("chats"),
});

export const Route = createFileRoute("/_app/messages")({
  validateSearch: zodValidator(messagesSearchSchema),
  head: () => ({
    meta: [
      { title: "Messages & Requests — REXchange" },
      {
        name: "description",
        content: "Chat with students, respond to exchange requests, and complete rated trades.",
      },
      { property: "og:title", content: "Messages & Requests — REXchange" },
      { property: "og:description", content: "Chat and manage exchange requests." },
    ],
  }),
  component: MessagesPage,
});

const statusStyles: Record<Thread["status"], string> = {
  active: "bg-accent text-accent-foreground",
  pending: "bg-amber/15 text-amber",
  accepted: "bg-mint/15 text-mint",
  declined: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

function MessagesPage() {
  const search = Route.useSearch();
  const threadId = search.thread || search.threadId || "";
  const tab = search.tab;
  const navigate = useNavigate({ from: Route.fullPath });
  const { threads, listings, lastReadTimestamps } = useAppState();
  const { user, profile } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeUserId = profile?.uid || user?.uid || "";
  const isRequests = tab === "requests";
  const visibleThreads =
    profile || user
      ? threads.filter(
          (t) =>
            (t.participantIds?.includes(activeUserId) ||
              t.creatorId === activeUserId ||
              t.recipientId === activeUserId) &&
            (isRequests ? t.kind === "request" : t.kind === "chat"),
        )
      : [];
  const selected = threads.find((t) => t.id === threadId) ?? visibleThreads[0];
  const pendingCount =
    profile || user
      ? threads.filter(
          (t) => t.kind === "request" && t.status === "pending" && t.recipientId === activeUserId,
        ).length
      : 0;
  const unreadChatsCount =
    profile || user
      ? threads.filter(
          (t) => t.kind === "chat" && isThreadUnread(t, activeUserId, lastReadTimestamps),
        ).length
      : 0;

  const counterpartId = selected
    ? selected.creatorId === activeUserId
      ? selected.recipientId
      : selected.creatorId || selected.studentId
    : undefined;
  const selectedListing = selected?.listingId
    ? listings.find((l) => l.id === selected.listingId)
    : undefined;
  const selectedStudent = counterpartId
    ? getStudent(counterpartId, profile, selectedListing, listings)
    : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.id, selected?.messages.length]);

  // Mark active thread as read upon viewing or when new messages arrive
  useEffect(() => {
    if (selected?.id && activeUserId) {
      actions.markThreadRead(selected.id);
      actions.markThreadNotificationsRead(selected.id);
    }
  }, [selected?.id, selected?.messages.length, activeUserId]);

  const selectedThreadId = selected?.id;

  // Real-time Firestore messages subscription for the selected cloud thread
  // Uses stable primitive selectedThreadId to prevent unneeded teardown & resubscription loops
  useEffect(() => {
    if (!selectedThreadId) return;
    const isCloud = selectedThreadId.startsWith("t_chat_") || selectedThreadId.startsWith("t_req_");
    if (!isCloud) return;

    const unsubscribe = subscribeToThreadMessages(
      selectedThreadId,
      (firestoreMessages) => {
        const chatMessages = firestoreMessages.map((m) => {
          let formattedTime = "Recently";
          if (m.createdAt && typeof m.createdAt.toDate === "function") {
            const d = m.createdAt.toDate();
            formattedTime = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          }
          return firestoreMessageToChatMessage(m, formattedTime, m.senderName);
        });
        actions.setThreadMessages(selectedThreadId, chatMessages);
      },
      (err) => {
        console.error(
          `[Messages] Error subscribing to thread messages for ${selectedThreadId}:`,
          err,
        );
      },
    );

    return () => {
      unsubscribe();
    };
  }, [selectedThreadId]);

  if (!profile) {
    return (
      <PageContainer>
        <section className="animate-rise mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquare className="size-8" />
          </div>
          <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Sign in to view your messages
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in with your campus account to chat with classmates, respond to exchange requests,
            and complete rated trades.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
            >
              Sign in / Register
            </button>
          </div>
        </section>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </PageContainer>
    );
  }

  function selectThread(id: string) {
    setActionError(null);
    navigate({ to: ".", search: (prev) => ({ ...prev, thread: id }) });
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim() || isSending) return;
    setActionError(null);
    const textToSend = draft;
    setDraft("");
    setIsSending(true);
    try {
      await actions.sendMessage(selected.id, textToSend);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      setActionError(msg);
      console.warn("[Messages] Send message blocked:", err);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PageContainer>
      <h1 className="font-heading text-3xl font-bold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Coordinate pickups, negotiate swaps, and rate completed exchanges.
      </p>

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, tab: "chats" }) })}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            !isRequests
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          Chats
          {unreadChatsCount > 0 && (
            <span
              className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${
                !isRequests
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {unreadChatsCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, tab: "requests" }) })}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            isRequests
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          Exchange requests
          {pendingCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[300px_1fr]">
        {/* Thread list */}
        <div className={`space-y-2 ${selected && threadId ? "hidden md:block" : ""}`}>
          {visibleThreads.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
              <Inbox className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">
                {isRequests ? "No exchange requests" : "No chats yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRequests
                  ? "Requests from classmates will land here."
                  : "Message a listing owner to start a conversation."}
              </p>
              <Link
                to="/explore"
                search={{ q: "", cat: "All", types: "", sort: "newest" }}
                className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Browse listings
              </Link>
            </div>
          ) : (
            visibleThreads.map((thread) => {
              const otherId =
                thread.creatorId === activeUserId
                  ? thread.recipientId
                  : thread.creatorId || thread.studentId;
              const listingForThread = thread.listingId
                ? listings.find((l) => l.id === thread.listingId)
                : undefined;
              const student = getStudent(otherId, profile, listingForThread, listings);
              const last = thread.messages[thread.messages.length - 1];
              const active = selected?.id === thread.id;
              const unread = isThreadUnread(thread, activeUserId, lastReadTimestamps);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={`relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-accent"
                      : unread
                        ? "border-primary/40 bg-card hover:bg-accent/40"
                        : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar student={student} className="size-10 text-xs" />
                    {unread && (
                      <span
                        className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                        title="Unread messages"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          unread ? "font-bold text-foreground" : "font-semibold"
                        }`}
                      >
                        {student.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[thread.status]}`}
                      >
                        {thread.status}
                      </span>
                    </div>
                    <p
                      className={`truncate text-xs ${
                        unread ? "font-semibold text-primary" : "font-medium text-primary"
                      }`}
                    >
                      {thread.subject}
                    </p>
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        unread ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {thread.lastMessageText || (last ? last.text : "No messages yet")}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation */}
        <div className={`${!selected || (!threadId && "hidden md:block")}`}>
          {selected && selectedStudent ? (
            <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
              {/* Error banner */}
              {actionError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive"
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionError(null)}
                    className="font-semibold underline hover:no-underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border p-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, thread: "" }) })}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <Avatar student={selectedStudent} className="size-10 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{selectedStudent.name}</p>
                  {selectedListing ? (
                    <Link
                      to="/listing/$id"
                      params={{ id: selectedListing.id }}
                      className="truncate text-xs font-medium text-primary hover:underline"
                    >
                      {selected.subject}
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground">{selected.subject}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[selected.status]}`}
                >
                  {selected.status}
                </span>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
                {selected.messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <MessageSquare className="size-8 opacity-30" />
                    <p className="mt-2 text-sm font-semibold">No messages yet</p>
                    <p className="mt-1 text-xs">
                      Say hello or coordinate exchange details to get started.
                    </p>
                  </div>
                ) : (
                  selected.messages.map((msg) => {
                    const msgSenderId = msg.senderId || msg.fromId;
                    const mine = Boolean(activeUserId && msgSenderId === activeUserId);
                    const senderStudent =
                      !mine && msgSenderId
                        ? getStudent(msgSenderId, profile, selectedListing, listings)
                        : undefined;
                    const displayName = mine
                      ? "You"
                      : msg.senderName ||
                        senderStudent?.name ||
                        selectedStudent?.name ||
                        "Classmate";
                    const isPending = msg.status === "pending";
                    const isError = msg.status === "error";

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm transition-all ${
                            mine
                              ? isError
                                ? "rounded-br-sm border border-destructive/40 bg-destructive/15 text-foreground"
                                : isPending
                                  ? "rounded-br-sm bg-primary/80 text-primary-foreground"
                                  : "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm border border-border bg-card"
                          }`}
                        >
                          {!mine && (
                            <p className="mb-1 text-[11px] font-semibold text-primary">
                              {displayName}
                            </p>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                              mine
                                ? isError
                                  ? "text-destructive"
                                  : "text-primary-foreground/75"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isPending && (
                              <>
                                <Loader2 className="size-2.5 animate-spin" />
                                <span>Sending…</span>
                              </>
                            )}
                            {isError && (
                              <>
                                <AlertCircle className="size-3 text-destructive" />
                                <span>Failed to send</span>
                                <button
                                  type="button"
                                  onClick={() => actions.retrySendMessage(selected.id, msg.id)}
                                  className="ml-1.5 font-bold underline hover:no-underline"
                                >
                                  Retry
                                </button>
                              </>
                            )}
                            {!isPending && !isError && (
                              <>
                                <span>{msg.time}</span>
                                {mine && <Check className="size-2.5 opacity-80" />}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Request actions */}
              {selected.kind === "request" && selected.status === "pending" && (
                <div className="flex flex-col gap-2 border-t border-border bg-accent/50 px-4 py-3 sm:flex-row sm:items-center">
                  {selected.recipientId === activeUserId ? (
                    <>
                      <p className="flex-1 text-xs font-medium text-accent-foreground">
                        {selectedStudent.name.split(" ")[0]} sent you an exchange request
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await actions.respondToRequest(selected.id, true);
                            } catch (err: unknown) {
                              const msg =
                                err instanceof Error ? err.message : "Failed to accept request.";
                              setActionError(msg);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-mint px-3 py-1.5 text-xs font-bold text-mint-foreground transition-opacity hover:opacity-90"
                        >
                          <Check className="size-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await actions.respondToRequest(selected.id, false);
                            } catch (err: unknown) {
                              const msg =
                                err instanceof Error ? err.message : "Failed to decline request.";
                              setActionError(msg);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-3.5" /> Decline
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="flex-1 text-xs font-medium text-accent-foreground">
                      Your request has been sent to {selectedStudent.name} and is pending their
                      response.
                    </p>
                  )}
                </div>
              )}

              {selected.kind === "request" && selected.status === "accepted" && (
                <div className="space-y-2 border-t border-border bg-mint/5 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-mint">
                    <CheckCircle2 className="size-4" /> Exchange accepted — met up already?
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <StarInput value={rating} onChange={setRating} />
                    <input
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Quick review (optional)"
                      className="min-w-40 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setActionError(null);
                        try {
                          await actions.completeExchange(selected.id, rating, reviewText);
                          setReviewText("");
                        } catch (err: unknown) {
                          const msg =
                            err instanceof Error ? err.message : "Failed to complete exchange.";
                          setActionError(msg);
                        }
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
                    >
                      Mark completed
                    </button>
                  </div>
                </div>
              )}

              {/* Composer */}
              <form
                onSubmit={onSend}
                className="flex items-center gap-2 border-t border-border p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${selectedStudent.name.split(" ")[0]}…`}
                  className="flex-1 rounded-full border-0 bg-muted px-4 py-2.5 text-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={isSending || !draft.trim()}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="grid h-[560px] place-items-center rounded-2xl border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
