import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import test, { describe, before, after, beforeEach } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const PROJECT_ID = "demo-rexchange-security";
const PROPOSED_RULES_PATH = resolve(process.cwd(), "firestore.notifications.proposed.rules");

describe("Genuine Firestore Security Rules Emulator Tests", () => {
  let testEnv: RulesTestEnvironment | null = null;
  let emulatorAvailable = false;
  let initError: string | null = null;

  const aliceUid = "student_alice";
  const bobUid = "student_bob";
  const eveUid = "student_eve";

  async function isEmulatorReachable(
    host: string,
    port: number,
    timeoutMs = 1500,
  ): Promise<boolean> {
    return new Promise((res) => {
      const socket = net.createConnection({ host, port, timeout: timeoutMs });
      socket.once("connect", () => {
        socket.destroy();
        res(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        res(false);
      });
      socket.once("error", () => {
        socket.destroy();
        res(false);
      });
    });
  }

  before(async () => {
    const host = process.env["FIRESTORE_EMULATOR_HOST"]?.split(":")[0] || "127.0.0.1";
    const port = Number(process.env["FIRESTORE_EMULATOR_HOST"]?.split(":")[1] || 8080);

    const reachable = await isEmulatorReachable(host, port, 1500);
    if (!reachable) {
      initError = `Firestore Emulator is not reachable at ${host}:${port}.`;
      emulatorAvailable = false;
      return;
    }

    try {
      const rulesContent = readFileSync(PROPOSED_RULES_PATH, "utf8");
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: rulesContent,
          host,
          port,
        },
      });
      // Ping emulator to verify active connection
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const pingDoc = doc(context.firestore(), "test_ping/check");
        await setDoc(pingDoc, { ok: true });
        await deleteDoc(pingDoc);
      });
      emulatorAvailable = true;
    } catch (err: unknown) {
      initError = err instanceof Error ? err.message : String(err);
      emulatorAvailable = false;
    }
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (!emulatorAvailable || !testEnv) return;
    await testEnv.clearFirestore();

    // Seed baseline data with rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      // Alice's profile
      await setDoc(doc(adminDb, `users/${aliceUid}`), {
        id: aliceUid,
        uid: aliceUid,
        name: "Alice Student",
        email: "alice@campus.edu",
        department: "Computer Science",
        year: "Junior",
        rating: 5,
        exchanges: 4,
      });

      // Bob's profile
      await setDoc(doc(adminDb, `users/${bobUid}`), {
        id: bobUid,
        uid: bobUid,
        name: "Bob Classmate",
        email: "bob@campus.edu",
        department: "Economics",
        year: "Senior",
        rating: 4.8,
        exchanges: 10,
      });

      // Bob's listing
      await setDoc(doc(adminDb, "listings/listing_macbook"), {
        id: "listing_macbook",
        ownerId: bobUid,
        title: "MacBook Pro 14",
        description: "Excellent condition laptop for computer science or engineering courses.",
        category: "Electronics",
        condition: "Like New",
        type: "exchange",
        department: "Economics",
        year: "Senior",
        availability: "Weekdays after 4 PM",
        postedHours: 12,
        keywords: ["macbook", "laptop", "apple"],
      });

      // Open chat thread between Alice and Bob
      await setDoc(doc(adminDb, "threads/t_chat_listing_macbook_alice_bob"), {
        id: "t_chat_listing_macbook_alice_bob",
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId: "listing_macbook",
        kind: "chat",
        status: "active",
        subject: "MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  });

  function ensureEmulator() {
    assert.equal(
      emulatorAvailable,
      true,
      `Firestore Emulator must be running and healthy. Error: ${initError}`,
    );
    assert.ok(testEnv, "Test environment must be initialized.");
  }

  // -------------------------------------------------------------
  // Test Case 1: Environment & Rules Loading Verification
  // -------------------------------------------------------------
  test("Firestore Emulator connection and proposed rules verification", () => {
    ensureEmulator();
  });

  // -------------------------------------------------------------
  // Authorization & Isolation Tests
  // -------------------------------------------------------------
  test("Authorization: Recipient can read their own notification, others cannot", async () => {
    ensureEmulator();
    const notifPath = `users/${aliceUid}/notifications/notif_sample_1`;
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      const adminDb = c.firestore();
      await setDoc(doc(adminDb, notifPath), {
        id: "notif_sample_1",
        recipientId: aliceUid,
        senderId: bobUid,
        type: "message",
        title: "New Message",
        body: "Hello Alice",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const bobDb = testEnv!.authenticatedContext(bobUid).firestore();

    // Recipient reading their own notification: SUCCEEDS
    await assertSucceeds(getDoc(doc(aliceDb, notifPath)));

    // Other user reading Alice's notification: FAILS
    await assertFails(getDoc(doc(bobDb, notifPath)));
  });

  test("Authorization: Cross-account read-update and deletion is strictly rejected", async () => {
    ensureEmulator();
    const notifPath = `users/${aliceUid}/notifications/notif_sample_cross`;
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      const adminDb = c.firestore();
      await setDoc(doc(adminDb, notifPath), {
        id: "notif_sample_cross",
        recipientId: aliceUid,
        senderId: bobUid,
        type: "message",
        title: "Private Alert",
        body: "Only for Alice",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      });
    });

    const bobDb = testEnv!.authenticatedContext(bobUid).firestore();
    const eveDb = testEnv!.authenticatedContext(eveUid).firestore();

    // Bob attempting to mark Alice's notification as read: FAILS
    await assertFails(updateDoc(doc(bobDb, notifPath), { read: true }));

    // Eve attempting to mark Alice's notification as read: FAILS
    await assertFails(updateDoc(doc(eveDb, notifPath), { read: true }));

    // Bob attempting to delete Alice's notification: FAILS
    await assertFails(deleteDoc(doc(bobDb, notifPath)));

    // Eve attempting to delete Alice's notification: FAILS
    await assertFails(deleteDoc(doc(eveDb, notifPath)));
  });

  test("Authorization: Self-notification is strictly blocked", async () => {
    ensureEmulator();
    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const notifPath = `users/${aliceUid}/notifications/notif_self_1`;

    // Alice attempting to create a notification for Alice: FAILS
    await assertFails(
      setDoc(doc(aliceDb, notifPath), {
        id: "notif_self_1",
        recipientId: aliceUid,
        senderId: aliceUid,
        type: "message",
        title: "Self",
        body: "Self notification",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      }),
    );
  });

  test("Authorization: Non-participant cannot create notification for private thread", async () => {
    ensureEmulator();
    const eveDb = testEnv!.authenticatedContext(eveUid).firestore();
    const notifId = "notif_msg_t_chat_listing_macbook_alice_bob_m_eve";
    const notifPath = `users/${bobUid}/notifications/${notifId}`;

    // Eve (not in participantIds) attempting to inject notification for Bob: FAILS
    await assertFails(
      setDoc(doc(eveDb, notifPath), {
        id: notifId,
        recipientId: bobUid,
        senderId: eveUid,
        type: "message",
        title: "Eve",
        body: "Phishing message",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      }),
    );
  });

  // -------------------------------------------------------------
  // Message Notification Tests (Atomic Batches)
  // -------------------------------------------------------------
  test("Message Notifications: Atomic batch (message + thread update + notification) succeeds", async () => {
    ensureEmulator();
    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const threadId = "t_chat_listing_macbook_alice_bob";
    const messageId = "m_batch_101";
    const notifId = `notif_msg_${threadId}_${messageId}`;

    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();

    // 1. Message document
    batch.set(doc(aliceDb, `threads/${threadId}/messages/${messageId}`), {
      id: messageId,
      senderId: aliceUid,
      text: "Hi Bob, can we meet tomorrow?",
      createdAt: now,
    });

    // 2. Thread summary update
    batch.update(doc(aliceDb, `threads/${threadId}`), {
      lastMessageId: messageId,
      lastMessageText: "Hi Bob, can we meet tomorrow?",
      lastMessageTime: now,
      lastMessageSenderId: aliceUid,
      updatedAt: now,
    });

    // 3. Recipient notification
    batch.set(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "message",
      title: "Alice Student",
      body: "Hi Bob, can we meet tomorrow?",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
      listingId: "listing_macbook",
    });

    // Entire atomic batch: SUCCEEDS
    await assertSucceeds(batch.commit());
  });

  test("Message Notifications: Notification without corresponding message in batch fails", async () => {
    ensureEmulator();
    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const threadId = "t_chat_listing_macbook_alice_bob";
    const ghostMessageId = "m_ghost_999";
    const notifId = `notif_msg_${threadId}_${ghostMessageId}`;

    // Notification created without message doc: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "message",
        title: "Alice",
        body: "Ghost message",
        link: `/messages?thread=${threadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId,
      }),
    );
  });

  test("Message Notifications: Messages on declined thread are rejected", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const messageId = "m_after_decline";
    const notifId = `notif_msg_${threadId}_${messageId}`;

    // Seed thread with status: 'declined'
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "declined",
        subject: "Declined Request",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();

    batch.set(doc(aliceDb, `threads/${threadId}/messages/${messageId}`), {
      id: messageId,
      senderId: aliceUid,
      text: "Can I still have it?",
      createdAt: now,
    });
    batch.update(doc(aliceDb, `threads/${threadId}`), {
      lastMessageId: messageId,
      lastMessageText: "Can I still have it?",
      lastMessageTime: now,
      lastMessageSenderId: aliceUid,
      updatedAt: now,
    });
    batch.set(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "message",
      title: "Alice Student",
      body: "Can I still have it?",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });

    // Attempting to send message & notification on declined thread: FAILS
    await assertFails(batch.commit());
  });

  test("Message Notifications: Messages on completed thread are rejected", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const messageId = "m_after_completed";
    const notifId = `notif_msg_${threadId}_${messageId}`;

    // Seed thread with status: 'completed'
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "completed",
        subject: "Completed Request",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();

    batch.set(doc(aliceDb, `threads/${threadId}/messages/${messageId}`), {
      id: messageId,
      senderId: aliceUid,
      text: "Thanks again!",
      createdAt: now,
    });
    batch.update(doc(aliceDb, `threads/${threadId}`), {
      lastMessageId: messageId,
      lastMessageText: "Thanks again!",
      lastMessageTime: now,
      lastMessageSenderId: aliceUid,
      updatedAt: now,
    });
    batch.set(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "message",
      title: "Alice Student",
      body: "Thanks again!",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });

    // Attempting to send message & notification on completed thread: FAILS
    await assertFails(batch.commit());
  });

  // -------------------------------------------------------------
  // Exchange Request Notification Tests
  // -------------------------------------------------------------
  test("Exchange Requests: Valid request notification for actual listing owner succeeds", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_req_${listingId}_${aliceUid}`;

    // Seed the request thread (as done by getOrCreateThreadInFirestore)
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "pending",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Alice creates request notification for Bob (the verified owner): SUCCEEDS
    await assertSucceeds(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "request_received",
        title: "New Exchange Request",
        body: "You received an exchange request for your listing.",
        link: `/messages?thread=${threadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId,
        listingId,
      }),
    );
  });

  test("Exchange Requests: Request notification sent to non-owner is rejected", async () => {
    ensureEmulator();
    const listingId = "listing_macbook"; // Bob is the owner
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_req_${listingId}_${aliceUid}`;

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Alice attempting to send notification for Bob's listing to Eve: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${eveUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: eveUid,
        senderId: aliceUid,
        type: "request_received",
        title: "New Exchange Request",
        body: "Spoofed listing recipient",
        link: `/messages?thread=${threadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId,
        listingId,
      }),
    );
  });

  test("Exchange Requests: Duplicate notification creation is rejected (cannot overwrite)", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_req_${listingId}_${aliceUid}`;

    // Seed thread and original notification
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "pending",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(c.firestore(), `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "request_received",
        title: "Original Notification",
        body: "Original body",
        link: `/messages?thread=${threadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId,
        listingId,
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Alice attempting to overwrite the existing notification document via setDoc: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "request_received",
        title: "Spam Overwrite",
        body: "Overwriting original notification",
        link: `/messages?thread=${threadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId,
        listingId,
      }),
    );
  });

  test("Exchange Requests: Missing request thread or missing listing is rejected", async () => {
    ensureEmulator();
    const nonExistentListing = "listing_ghost_404";
    const nonExistentThread = `t_req_${nonExistentListing}_${aliceUid}`;
    const notifIdGhost = `notif_req_${nonExistentListing}_${aliceUid}`;

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Notification referencing non-existent listing and thread: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifIdGhost}`), {
        id: notifIdGhost,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "request_received",
        title: "Ghost Listing Request",
        body: "Listing does not exist",
        link: `/messages?thread=${nonExistentThread}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId: nonExistentThread,
        listingId: nonExistentListing,
      }),
    );

    // Notification referencing existing listing but non-existent thread: FAILS
    const missingThreadId = `t_req_listing_macbook_${aliceUid}`;
    const missingNotifId = `notif_req_listing_macbook_${aliceUid}`;
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${missingNotifId}`), {
        id: missingNotifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "request_received",
        title: "Missing Thread Request",
        body: "Thread does not exist in Firestore",
        link: `/messages?thread=${missingThreadId}`,
        read: false,
        createdAt: serverTimestamp(),
        threadId: missingThreadId,
        listingId: "listing_macbook",
      }),
    );
  });

  // -------------------------------------------------------------
  // Status Notification Tests
  // -------------------------------------------------------------
  test("Status Notifications: Valid pending -> accepted transition and notification", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_status_${threadId}_accepted`;

    // Seed pending request thread
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "pending",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const bobDb = testEnv!.authenticatedContext(bobUid).firestore();
    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Requester Alice attempting to accept her own request: FAILS
    const invalidBatch = writeBatch(aliceDb);
    invalidBatch.update(doc(aliceDb, `threads/${threadId}`), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    });
    invalidBatch.set(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "request_accepted",
      title: "Request Accepted",
      body: "Spoofed accept",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: serverTimestamp(),
      threadId,
    });
    await assertFails(invalidBatch.commit());

    // Listing Owner Bob accepting the request: SUCCEEDS
    const validBatch = writeBatch(bobDb);
    const now = serverTimestamp();
    validBatch.update(doc(bobDb, `threads/${threadId}`), {
      status: "accepted",
      updatedAt: now,
    });
    validBatch.set(doc(bobDb, `users/${aliceUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: aliceUid,
      senderId: bobUid,
      type: "request_accepted",
      title: "Exchange Request Accepted",
      body: "Your request was accepted.",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });
    await assertSucceeds(validBatch.commit());
  });

  test("Status Notifications: Valid pending -> declined transition and notification", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_status_${threadId}_declined`;

    // Seed pending request thread
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "pending",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const bobDb = testEnv!.authenticatedContext(bobUid).firestore();

    // Listing Owner Bob declining the request: SUCCEEDS
    const batch = writeBatch(bobDb);
    const now = serverTimestamp();
    batch.update(doc(bobDb, `threads/${threadId}`), {
      status: "declined",
      updatedAt: now,
    });
    batch.set(doc(bobDb, `users/${aliceUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: aliceUid,
      senderId: bobUid,
      type: "request_declined",
      title: "Exchange Request Declined",
      body: "Your request was declined.",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });
    await assertSucceeds(batch.commit());
  });

  test("Status Notifications: Valid accepted -> completed transition and notification", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_status_${threadId}_completed`;

    // Seed accepted request thread
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "accepted",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Participant Alice marking the accepted exchange as completed: SUCCEEDS
    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();
    batch.update(doc(aliceDb, `threads/${threadId}`), {
      status: "completed",
      updatedAt: now,
    });
    batch.set(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "exchange_completed",
      title: "Exchange Completed",
      body: "Exchange marked completed.",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });
    await assertSucceeds(batch.commit());
  });

  test("Status Notifications: Invalid pending -> completed jump is rejected", async () => {
    ensureEmulator();
    const listingId = "listing_macbook";
    const threadId = `t_req_${listingId}_${aliceUid}`;
    const notifId = `notif_status_${threadId}_completed`;

    // Seed pending request thread (not accepted yet)
    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `threads/${threadId}`), {
        id: threadId,
        creatorId: aliceUid,
        recipientId: bobUid,
        participantIds: [aliceUid, bobUid],
        listingId,
        kind: "request",
        status: "pending",
        subject: "Request: MacBook Pro 14",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const bobDb = testEnv!.authenticatedContext(bobUid).firestore();

    // Bob attempting to bypass "accepted" and jump directly from pending to completed: FAILS
    const batch = writeBatch(bobDb);
    const now = serverTimestamp();
    batch.update(doc(bobDb, `threads/${threadId}`), {
      status: "completed",
      updatedAt: now,
    });
    batch.set(doc(bobDb, `users/${aliceUid}/notifications/${notifId}`), {
      id: notifId,
      recipientId: aliceUid,
      senderId: bobUid,
      type: "exchange_completed",
      title: "Exchange Completed",
      body: "Premature completion alert",
      link: `/messages?thread=${threadId}`,
      read: false,
      createdAt: now,
      threadId,
    });
    await assertFails(batch.commit());
  });

  // -------------------------------------------------------------
  // Notification Integrity & Lifecycle Tests
  // -------------------------------------------------------------
  test("Notification Integrity: Malicious and external URLs are rejected", async () => {
    ensureEmulator();
    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();
    const threadId = "t_chat_listing_macbook_alice_bob";
    const notifId = `notif_msg_${threadId}_m_malicious`;

    // Link pointing to external domain: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "message",
        title: "Phishing",
        body: "Click here to login",
        link: "https://phishing.campus.com/login",
        read: false,
        createdAt: serverTimestamp(),
        threadId,
      }),
    );

    // Protocol-relative link: FAILS
    await assertFails(
      setDoc(doc(aliceDb, `users/${bobUid}/notifications/${notifId}`), {
        id: notifId,
        recipientId: bobUid,
        senderId: aliceUid,
        type: "message",
        title: "Phishing",
        body: "Click here",
        link: "//evil.example.com/messages",
        read: false,
        createdAt: serverTimestamp(),
        threadId,
      }),
    );
  });

  test("Notification Integrity: Recipient can update read, but cannot modify protected fields", async () => {
    ensureEmulator();
    const notifId = "notif_msg_test_1";
    const notifPath = `users/${aliceUid}/notifications/${notifId}`;

    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), notifPath), {
        id: notifId,
        recipientId: aliceUid,
        senderId: bobUid,
        type: "message",
        title: "Original Title",
        body: "Original Body",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Alice updating read: true -> SUCCEEDS
    await assertSucceeds(updateDoc(doc(aliceDb, notifPath), { read: true }));

    // Alice attempting to alter title -> FAILS
    await assertFails(updateDoc(doc(aliceDb, notifPath), { title: "Tampered Title" }));

    // Alice attempting to alter body -> FAILS
    await assertFails(updateDoc(doc(aliceDb, notifPath), { body: "Tampered Body" }));
  });

  test("Notification Lifecycle: Recipient can delete/dismiss their own notification", async () => {
    ensureEmulator();
    const notifId = "notif_msg_test_delete";
    const notifPath = `users/${aliceUid}/notifications/${notifId}`;

    await testEnv!.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), notifPath), {
        id: notifId,
        recipientId: aliceUid,
        senderId: bobUid,
        type: "message",
        title: "Delete Me",
        body: "Dismissible notification",
        link: "/messages?thread=t_chat_listing_macbook_alice_bob",
        read: false,
        createdAt: serverTimestamp(),
        threadId: "t_chat_listing_macbook_alice_bob",
      });
    });

    const aliceDb = testEnv!.authenticatedContext(aliceUid).firestore();

    // Alice deleting her own notification -> SUCCEEDS
    await assertSucceeds(deleteDoc(doc(aliceDb, notifPath)));
  });
});
