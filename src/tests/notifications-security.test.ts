import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  getDeterministicMessageNotificationId,
  getDeterministicNotificationLink,
  getDeterministicRequestNotificationId,
  getDeterministicStatusNotificationId,
  type NotificationType,
} from "../lib/types.ts";

/**
 * Simulated Firestore Security Rules Validator for:
 * /users/{userId}/notifications/{notificationId}
 *
 * Implements the security logic agreed upon for Batch 3A.
 */
interface SecurityContext {
  auth: { uid: string } | null;
}

interface SimulatedNotificationDoc {
  id: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: number;
  threadId: string;
  listingId?: string;
}

interface SimulatedThreadDoc {
  id: string;
  participantIds: string[];
  creatorId: string;
  recipientId: string;
  listingId?: string;
  status: "pending" | "active" | "accepted" | "declined" | "completed";
}

interface SimulatedMessageDoc {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
}

interface DatabaseState {
  threads: Map<string, SimulatedThreadDoc>;
  messages: Map<string, SimulatedMessageDoc>;
  notifications: Map<string, SimulatedNotificationDoc>;
}

function isValidNotificationLink(link: string): boolean {
  // Reject external protocols, protocol-relative slashes, and javascript schemes
  if (!link.startsWith("/messages?thread=")) return false;
  if (link.includes("//") || link.includes(":") || link.includes("\\")) return false;
  const threadIdPart = link.replace("/messages?thread=", "");
  return /^[a-zA-Z0-9_-]+$/.test(threadIdPart);
}

function evaluateNotificationCreateRule(
  context: SecurityContext,
  targetUserId: string,
  notificationId: string,
  data: SimulatedNotificationDoc,
  db: DatabaseState,
  batchMessagesCreated?: SimulatedMessageDoc[],
  batchThreadsCreated?: SimulatedThreadDoc[],
): { allowed: boolean; reason?: string } {
  if (!context.auth) {
    return { allowed: false, reason: "Unauthenticated" };
  }

  // 1. Recipient must match URL path
  if (data.recipientId !== targetUserId) {
    return { allowed: false, reason: "recipientId does not match user document path" };
  }

  // 2. Sender must be authenticated user
  if (data.senderId !== context.auth.uid) {
    return { allowed: false, reason: "senderId does not match authenticated user (impersonation)" };
  }

  // 3. Prevent self-notifications
  if (data.senderId === data.recipientId) {
    return { allowed: false, reason: "senderId cannot be recipientId (self-notification)" };
  }

  // 4. Validate navigation link
  if (!isValidNotificationLink(data.link)) {
    return { allowed: false, reason: "Invalid or malicious notification link" };
  }

  // 5. Check if document already exists (deterministic ID collision prevention)
  const fullDocKey = `${targetUserId}/${notificationId}`;
  if (db.notifications.has(fullDocKey)) {
    return {
      allowed: false,
      reason: "Document already exists (duplicate event notification blocked)",
    };
  }

  // 6. Type-specific deterministic ID and relational authorization
  if (data.type === "message") {
    const expectedId = getDeterministicMessageNotificationId(
      data.threadId,
      data.id.replace(`notif_msg_${data.threadId}_`, ""),
    );
    if (notificationId !== expectedId) {
      return { allowed: false, reason: "Invalid deterministic message notification ID format" };
    }

    // Verify thread exists and sender is a participant
    const thread = db.threads.get(data.threadId);
    if (!thread || !thread.participantIds.includes(context.auth.uid)) {
      return { allowed: false, reason: "Sender is not a participant in the target thread" };
    }

    // Verify corresponding message document exists in thread (or in atomic batch)
    const messageDocId = notificationId.replace(`notif_msg_${data.threadId}_`, "");
    const msgExistsInDb = db.messages.has(`${data.threadId}/${messageDocId}`);
    const msgExistsInBatch = batchMessagesCreated?.some(
      (m) =>
        m.threadId === data.threadId && m.id === messageDocId && m.senderId === context.auth!.uid,
    );
    if (!msgExistsInDb && !msgExistsInBatch) {
      return {
        allowed: false,
        reason: "Message notification without corresponding message document",
      };
    }
  } else if (data.type === "request_received") {
    if (!data.listingId) {
      return { allowed: false, reason: "request_received notification must include listingId" };
    }
    const expectedId = getDeterministicRequestNotificationId(data.listingId, context.auth.uid);
    if (notificationId !== expectedId) {
      return { allowed: false, reason: "Invalid deterministic request notification ID format" };
    }

    // Verify corresponding thread exists or was created in atomic batch
    const threadExistsInDb = db.threads.get(data.threadId);
    const threadExistsInBatch = batchThreadsCreated?.some(
      (t) =>
        t.id === data.threadId &&
        t.creatorId === context.auth!.uid &&
        t.recipientId === data.recipientId &&
        t.listingId === data.listingId,
    );
    if (!threadExistsInDb && !threadExistsInBatch) {
      return {
        allowed: false,
        reason: "Request notification without corresponding thread document",
      };
    }
  } else if (
    data.type === "request_accepted" ||
    data.type === "request_declined" ||
    data.type === "exchange_completed"
  ) {
    const expectedStatus =
      data.type === "request_accepted"
        ? "accepted"
        : data.type === "request_declined"
          ? "declined"
          : "completed";
    const expectedId = getDeterministicStatusNotificationId(data.threadId, expectedStatus);
    if (notificationId !== expectedId) {
      return { allowed: false, reason: "Invalid deterministic status notification ID format" };
    }

    const thread = db.threads.get(data.threadId);
    if (!thread) {
      return {
        allowed: false,
        reason: "Target thread does not exist for status update notification",
      };
    }
    if (!thread.participantIds.includes(context.auth.uid)) {
      return { allowed: false, reason: "Sender is not a participant in the target thread" };
    }
  } else {
    return { allowed: false, reason: "Unknown notification type" };
  }

  return { allowed: true };
}

function evaluateNotificationUpdateRule(
  context: SecurityContext,
  targetUserId: string,
  existingData: SimulatedNotificationDoc,
  updatedData: SimulatedNotificationDoc,
): { allowed: boolean; reason?: string } {
  if (!context.auth) {
    return { allowed: false, reason: "Unauthenticated" };
  }

  // Only the notification owner can update
  if (context.auth.uid !== targetUserId || context.auth.uid !== existingData.recipientId) {
    return { allowed: false, reason: "Unauthorized user attempting to update notification" };
  }

  // Recipient can ONLY update the `read` field. All other fields are immutable.
  const protectedFields: (keyof SimulatedNotificationDoc)[] = [
    "id",
    "recipientId",
    "senderId",
    "type",
    "title",
    "body",
    "link",
    "createdAt",
    "threadId",
    "listingId",
  ];

  for (const field of protectedFields) {
    if (existingData[field] !== updatedData[field]) {
      return {
        allowed: false,
        reason: `Protected field '${field}' cannot be modified by recipient`,
      };
    }
  }

  return { allowed: true };
}

describe("Batch 3A Notification Security & Architecture Test Suite", () => {
  const alice = "user_alice_123";
  const bob = "user_bob_456";
  const eve = "user_eve_789";

  let db: DatabaseState;

  test.beforeEach(() => {
    db = {
      threads: new Map(),
      messages: new Map(),
      notifications: new Map(),
    };

    // Pre-populate legitimate thread between Alice and Bob
    db.threads.set("t_chat_alice_bob", {
      id: "t_chat_alice_bob",
      participantIds: [alice, bob],
      creatorId: alice,
      recipientId: bob,
      listingId: "listing_textbook_1",
      status: "active",
    });
  });

  test("Scenario 1: Legitimate exchange request and notification creation succeeds", () => {
    const listingId = "listing_calc_101";
    const threadId = "t_req_listing_calc_101_alice";
    const notificationId = getDeterministicRequestNotificationId(listingId, alice);

    const newThread: SimulatedThreadDoc = {
      id: threadId,
      creatorId: alice,
      recipientId: bob,
      participantIds: [alice, bob],
      listingId,
      status: "pending",
    };

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "request_received",
      title: "Exchange Request Received",
      body: "Alice sent a request for your listing",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
      listingId,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      bob,
      notificationId,
      notifData,
      db,
      [],
      [newThread],
    );

    assert.equal(result.allowed, true);
  });

  test("Scenario 2 & 3: Duplicate exchange request and notification prevention (deterministic ID collision)", () => {
    const listingId = "listing_calc_101";
    const threadId = "t_req_listing_calc_101_alice";
    const notificationId = getDeterministicRequestNotificationId(listingId, alice);

    // Existing notification in DB
    db.notifications.set(`${bob}/${notificationId}`, {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "request_received",
      title: "Exchange Request Received",
      body: "Alice sent a request",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now() - 10000,
      threadId,
      listingId,
    });

    // Alice attempts to send duplicate notification for same listing
    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "request_received",
      title: "Exchange Request Received",
      body: "Alice sent another request",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
      listingId,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      bob,
      notificationId,
      notifData,
      db,
    );

    assert.equal(result.allowed, false);
    assert.match(result.reason!, /already exists/);
  });

  test("Scenario 4: Legitimate message notification creation with atomic batch", () => {
    const threadId = "t_chat_alice_bob";
    const messageId = "m_1001";
    const notificationId = getDeterministicMessageNotificationId(threadId, messageId);

    const messageDoc: SimulatedMessageDoc = {
      id: messageId,
      threadId,
      senderId: alice,
      text: "Hi Bob, is this still available?",
    };

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "message",
      title: "Alice",
      body: "Hi Bob, is this still available?",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      bob,
      notificationId,
      notifData,
      db,
      [messageDoc],
    );

    assert.equal(result.allowed, true);
  });

  test("Scenario 5: Rejection of message notification without corresponding message doc", () => {
    const threadId = "t_chat_alice_bob";
    const messageId = "m_ghost_999";
    const notificationId = getDeterministicMessageNotificationId(threadId, messageId);

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "message",
      title: "Alice",
      body: "Ghost notification",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
    };

    // No message exists in DB or batch
    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      bob,
      notificationId,
      notifData,
      db,
      [],
    );

    assert.equal(result.allowed, false);
    assert.match(result.reason!, /without corresponding message/);
  });

  test("Scenario 6: Rejection of notification without corresponding thread", () => {
    const nonExistentThread = "t_chat_fake_999";
    const messageId = "m_2001";
    const notificationId = getDeterministicMessageNotificationId(nonExistentThread, messageId);

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "message",
      title: "Alice",
      body: "Hey",
      link: getDeterministicNotificationLink(nonExistentThread),
      read: false,
      createdAt: Date.now(),
      threadId: nonExistentThread,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      bob,
      notificationId,
      notifData,
      db,
    );

    assert.equal(result.allowed, false);
    assert.match(result.reason!, /Sender is not a participant/);
  });

  test("Scenario 7: Unauthorized notification creation (Eve attempting to inject into Alice-Bob thread)", () => {
    const threadId = "t_chat_alice_bob";
    const messageId = "m_eve_attacker";
    const notificationId = getDeterministicMessageNotificationId(threadId, messageId);

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: eve,
      type: "message",
      title: "Eve",
      body: "Phishing message",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: eve } },
      bob,
      notificationId,
      notifData,
      db,
    );

    assert.equal(result.allowed, false);
    assert.match(result.reason!, /Sender is not a participant/);
  });

  test("Scenario 8: Unauthorized recipient modification (altering title/body/createdAt)", () => {
    const notificationId = "notif_msg_t_chat_alice_bob_m_1";
    const originalNotif: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: bob,
      senderId: alice,
      type: "message",
      title: "Original Title",
      body: "Original Body",
      link: "/messages?thread=t_chat_alice_bob",
      read: false,
      createdAt: 1700000000000,
      threadId: "t_chat_alice_bob",
    };

    // Bob can mark it as read
    const validUpdate: SimulatedNotificationDoc = {
      ...originalNotif,
      read: true,
    };
    const validResult = evaluateNotificationUpdateRule(
      { auth: { uid: bob } },
      bob,
      originalNotif,
      validUpdate,
    );
    assert.equal(validResult.allowed, true);

    // Bob attempts to alter title or body
    const tamperedNotif: SimulatedNotificationDoc = {
      ...originalNotif,
      title: "Tampered Title",
      read: true,
    };
    const invalidResult = evaluateNotificationUpdateRule(
      { auth: { uid: bob } },
      bob,
      originalNotif,
      tamperedNotif,
    );
    assert.equal(invalidResult.allowed, false);
    assert.match(invalidResult.reason!, /Protected field 'title'/);
  });

  test("Scenario 9: Self-notification prevention (senderId == recipientId)", () => {
    const threadId = "t_chat_alice_bob";
    const messageId = "m_self_1";
    const notificationId = getDeterministicMessageNotificationId(threadId, messageId);

    const notifData: SimulatedNotificationDoc = {
      id: notificationId,
      recipientId: alice,
      senderId: alice, // Self notification
      type: "message",
      title: "Alice",
      body: "Self message",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
    };

    const result = evaluateNotificationCreateRule(
      { auth: { uid: alice } },
      alice,
      notificationId,
      notifData,
      db,
    );

    assert.equal(result.allowed, false);
    assert.match(result.reason!, /self-notification/);
  });

  test("Scenario 10: Malicious notification link rejection", () => {
    const maliciousLinks = [
      "https://phishing.campus-login.com",
      "http://attacker.example.org",
      "//evil.example.com/messages",
      "javascript:alert(document.cookie)",
      "/messages?thread=../../etc/passwd",
      "/dashboard",
      "/messages?thread=valid&redirect=evil.com",
    ];

    for (const link of maliciousLinks) {
      assert.equal(
        isValidNotificationLink(link),
        false,
        `Expected link '${link}' to be rejected as invalid/malicious`,
      );
    }

    // Valid internal relative route link
    assert.equal(isValidNotificationLink("/messages?thread=t_chat_123_abc"), true);
  });

  test("Scenario 11: Valid and invalid status-transition notifications", () => {
    const threadId = "t_chat_alice_bob";

    // Valid accepted notification
    const acceptedNotifId = getDeterministicStatusNotificationId(threadId, "accepted");
    assert.equal(acceptedNotifId, `notif_status_${threadId}_accepted`);

    const acceptedNotif: SimulatedNotificationDoc = {
      id: acceptedNotifId,
      recipientId: alice,
      senderId: bob,
      type: "request_accepted",
      title: "Request Accepted!",
      body: "Bob accepted your request",
      link: getDeterministicNotificationLink(threadId),
      read: false,
      createdAt: Date.now(),
      threadId,
    };

    const acceptedResult = evaluateNotificationCreateRule(
      { auth: { uid: bob } },
      alice,
      acceptedNotifId,
      acceptedNotif,
      db,
    );
    assert.equal(acceptedResult.allowed, true);

    // Invalid status ID format attempt
    const spoofedNotifId = "arbitrary_custom_id_123";
    const spoofedNotif: SimulatedNotificationDoc = {
      ...acceptedNotif,
      id: spoofedNotifId,
    };
    const spoofedResult = evaluateNotificationCreateRule(
      { auth: { uid: bob } },
      alice,
      spoofedNotifId,
      spoofedNotif,
      db,
    );
    assert.equal(spoofedResult.allowed, false);
    assert.match(spoofedResult.reason!, /Invalid deterministic status notification ID/);
  });
});
