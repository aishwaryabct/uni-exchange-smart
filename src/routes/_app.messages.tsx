import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { ArrowLeft, Check, CheckCircle2, Inbox, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageContainer } from "@/components/app-shell";
import { Avatar, StarInput } from "@/components/ui-bits";
import { currentUser, getStudent } from "@/lib/data";
import { actions, useAppState } from "@/lib/store";
import type { Thread } from "@/lib/types";

const messagesSearchSchema = z.object({
  thread: fallback(z.string(), "").default(""),
  tab: fallback(z.string(), "chats").default("chats"),
});

export const Route = createFileRoute("/_app/messages")({
  validateSearch: zodValidator(messagesSearchSchema),
  head: () => ({
    meta: [
      { title: "Messages & Requests — REXchange" },
      { name: "description", content: "Chat with students, respond to exchange requests, and complete rated trades." },
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
  const { thread: threadId, tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { threads, listings } = useAppState();
  const [draft, setDraft] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRequests = tab === "requests";
  const visibleThreads = threads.filter((t) => (isRequests ? t.kind === "request" : t.kind === "chat"));
  const selected = threads.find((t) => t.id === threadId) ?? visibleThreads[0];
  const pendingCount = threads.filter((t) => t.kind === "request" && t.status === "pending").length;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.id, selected?.messages.length]);

  function selectThread(id: string) {
    navigate({ to: ".", search: (prev) => ({ ...prev, thread: id }) });
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    actions.sendMessage(selected.id, draft);
    setDraft("");
  }

  const selectedStudent = selected ? getStudent(selected.studentId) : undefined;
  const selectedListing = selected?.listingId
    ? listings.find((l) => l.id === selected.listingId)
    : undefined;
  const lastFromOther =
    selected && selected.messages.length > 0
      ? selected.messages[selected.messages.length - 1]?.fromId !== currentUser.id
      : true;

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
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            !isRequests ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          Chats
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, tab: "requests" }) })}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            isRequests ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
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
        <div
          className={`space-y-2 ${selected && threadId ? "hidden md:block" : ""}`}
        >
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
              const student = getStudent(thread.studentId);
              const last = thread.messages[thread.messages.length - 1];
              const active = selected?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <Avatar student={student} className="size-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">{student.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[thread.status]}`}
                      >
                        {thread.status}
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-primary">{thread.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {last ? last.text : "No messages yet"}
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
                {selected.messages.map((msg) => {
                  const mine = msg.fromId === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                        <p
                          className={`mt-1 text-right text-[9px] ${
                            mine ? "text-primary-foreground/60" : "text-muted-foreground"
                          }`}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Request actions */}
              {selected.kind === "request" && selected.status === "pending" && lastFromOther && (
                <div className="flex items-center gap-2 border-t border-border bg-accent/50 px-4 py-3">
                  <p className="flex-1 text-xs font-medium text-accent-foreground">
                    {selectedStudent.name.split(" ")[0]} sent you an exchange request
                  </p>
                  <button
                    type="button"
                    onClick={() => actions.respondToRequest(selected.id, true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-mint px-3 py-1.5 text-xs font-bold text-mint-foreground transition-opacity hover:opacity-90"
                  >
                    <Check className="size-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.respondToRequest(selected.id, false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-3.5" /> Decline
                  </button>
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
                      onClick={() => {
                        actions.completeExchange(selected.id, rating, reviewText);
                        setReviewText("");
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-dark"
                    >
                      Mark completed
                    </button>
                  </div>
                </div>
              )}

              {/* Composer */}
              <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${selectedStudent.name.split(" ")[0]}…`}
                  className="flex-1 rounded-full border-0 bg-muted px-4 py-2.5 text-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-dark"
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
