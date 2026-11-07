import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquare,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { actions, useAppState } from "@/lib/store";
import { type InAppNotification, type NotificationType } from "@/lib/types";

interface DisplayNotificationItem {
  key: string;
  ids: string[];
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: number;
  threadId: string;
  listingId?: string | undefined;
  isCoalesced?: boolean;
  count?: number;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "Just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "message":
      return (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <MessageSquare className="size-4" />
        </div>
      );
    case "request_received":
      return (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ArrowLeftRight className="size-4" />
        </div>
      );
    case "request_accepted":
      return (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
        </div>
      );
    case "request_declined":
      return (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <XCircle className="size-4" />
        </div>
      );
    case "exchange_completed":
      return (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <CheckCheck className="size-4" />
        </div>
      );
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, isNotificationsLoading } = useAppState();

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const displayItems = useMemo<DisplayNotificationItem[]>(() => {
    const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);
    const unreadMessageGroups: Record<string, InAppNotification[]> = {};

    for (const n of sorted) {
      if (n.type === "message" && !n.read) {
        const group = unreadMessageGroups[n.threadId] ?? [];
        group.push(n);
        unreadMessageGroups[n.threadId] = group;
      }
    }

    const items: DisplayNotificationItem[] = [];
    const processedUnreadThreadIds = new Set<string>();

    for (const n of sorted) {
      if (n.type === "message" && !n.read) {
        if (processedUnreadThreadIds.has(n.threadId)) {
          continue;
        }
        processedUnreadThreadIds.add(n.threadId);
        const group = unreadMessageGroups[n.threadId] || [n];
        if (group.length > 1) {
          items.push({
            key: `coalesced_${n.threadId}`,
            ids: group.map((item) => item.id),
            type: "message",
            title: n.title,
            body: `${n.title} sent ${group.length} new messages`,
            link: n.link,
            read: false,
            createdAt: Math.max(...group.map((item) => item.createdAt)),
            threadId: n.threadId,
            listingId: n.listingId,
            isCoalesced: true,
            count: group.length,
          });
        } else {
          items.push({
            key: n.id,
            ids: [n.id],
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            createdAt: n.createdAt,
            threadId: n.threadId,
            listingId: n.listingId,
          });
        }
      } else {
        items.push({
          key: n.id,
          ids: [n.id],
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.read,
          createdAt: n.createdAt,
          threadId: n.threadId,
          listingId: n.listingId,
        });
      }
    }

    return items;
  }, [notifications]);

  function handleItemClick(item: DisplayNotificationItem) {
    if (item.isCoalesced) {
      actions.markThreadNotificationsRead(item.threadId);
    } else if (item.ids[0]) {
      actions.markNotificationRead(item.ids[0]);
    }
    setOpen(false);

    const isRequest =
      item.type === "request_received" ||
      item.type === "request_accepted" ||
      item.type === "request_declined";

    navigate({
      to: "/messages",
      search: {
        thread: item.threadId,
        tab: isRequest ? "requests" : "chats",
      },
    });
  }

  function handleDismiss(e: React.MouseEvent, item: DisplayNotificationItem) {
    e.stopPropagation();
    for (const id of item.ids) {
      actions.dismissNotification(id);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-card animate-in zoom-in-50 duration-200">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 rounded-2xl border border-border bg-card p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => actions.markAllNotificationsRead()}
              className="text-xs font-medium text-primary transition-colors hover:text-primary-dark hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
          {isNotificationsLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-5" />
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">All caught up!</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No notifications right now. Activity will appear here.
              </p>
            </div>
          ) : (
            displayItems.map((item) => (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                  !item.read ? "bg-primary/5" : "bg-card"
                }`}
              >
                {getNotificationIcon(item.type)}

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-xs truncate ${
                        !item.read
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/80"
                      }`}
                    >
                      {item.title}
                    </p>
                    {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p
                    className={`mt-0.5 text-xs line-clamp-2 leading-relaxed ${
                      !item.read ? "text-foreground/90 font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {item.body}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDismiss(e, item)}
                  aria-label="Dismiss notification"
                  className="absolute right-2.5 top-3 p-1 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
