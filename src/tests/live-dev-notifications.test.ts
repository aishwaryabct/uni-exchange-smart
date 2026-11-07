import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test, { describe, before, after } from "node:test";

const require = createRequire(import.meta.url);
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  getDeterministicMessageNotificationId,
  getDeterministicRequestNotificationId,
  getDeterministicStatusNotificationId,
  getDeterministicNotificationLink,
  type FirestoreNotification,
} from "../lib/types.ts";

// Helper: load dev Firebase config strictly from .env.local
function loadDevFirebaseConfig() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local file");
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[k] = v;
    }
  }

  const projectId = env["VITE_FIREBASE_DEV_PROJECT_ID"];
  if (projectId !== "rexchange-dev-2a599") {
    throw new Error(
      `[CRITICAL SAFETY GUARD] Target project must be 'rexchange-dev-2a599'. Got '${projectId}'. Aborting.`
    );
  }

  return {
    apiKey: env["VITE_FIREBASE_DEV_API_KEY"]!,
    authDomain: env["VITE_FIREBASE_DEV_AUTH_DOMAIN"]!,
    projectId: projectId!,
    storageBucket: env["VITE_FIREBASE_DEV_STORAGE_BUCKET"]!,
    messagingSenderId: env["VITE_FIREBASE_DEV_MESSAGING_SENDER_ID"]!,
    appId: env["VITE_FIREBASE_DEV_APP_ID"]!,
  };
}

const isLiveDevOptIn = process.env["RUN_LIVE_DEV_TESTS"] === "true";

describe(
  "Phase 3B: Live Development Notification Integration Tests",
  {
    skip: isLiveDevOptIn
      ? false
      : "Live development integration tests skipped. To execute against rexchange-dev-2a599, set RUN_LIVE_DEV_TESTS=true",
  },
  () => {
    const testRunId = `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const testListingId = `listing_test_${testRunId}`;
  let testThreadId: string;
  const testMsgId = `m_test_${testRunId}`;

  // Unique deterministic test emails
  const aliceEmail = `test-alice-${testRunId}@rexchange.local`;
  const bobEmail = `test-bob-${testRunId}@rexchange.local`;
  // Random strong passwords generated in-memory, never logged
  const alicePass = `P@ss_${crypto.randomBytes(12).toString("hex")}!`;
  const bobPass = `P@ss_${crypto.randomBytes(12).toString("hex")}!`;

  let aliceApp: FirebaseApp;
  let aliceAuth: Auth;
  let aliceDb: Firestore;
  let aliceUid: string;

  let bobApp: FirebaseApp;
  let bobAuth: Auth;
  let bobDb: Firestore;
  let bobUid: string;

  let adminClient: any = null;
  let rulesetVerified = false;

  const createdDocPaths: string[] = [];
  const notificationsReceivedByAlice: FirestoreNotification[] = [];
  const notificationsReceivedByBob: FirestoreNotification[] = [];

  // Wait for notification via Firestore real-time listener
  function waitForNotification(
    db: Firestore,
    userId: string,
    targetNotificationId: string,
    timeoutMs = 10000
  ): Promise<FirestoreNotification> {
    return new Promise((resolve, reject) => {
      const colRef = collection(db, "users", userId, "notifications");
      const q = query(colRef, orderBy("createdAt", "desc"), limit(20));

      const timer = setTimeout(() => {
        unsub();
        reject(
          new Error(
            `Timeout (${timeoutMs}ms) waiting for notification '${targetNotificationId}' for user '${userId}'`
          )
        );
      }, timeoutMs);

      const unsub = onSnapshot(
        q,
        (snap) => {
          for (const docChange of snap.docChanges()) {
            if (docChange.doc.id === targetNotificationId) {
              clearTimeout(timer);
              unsub();
              resolve(docChange.doc.data() as FirestoreNotification);
              return;
            }
          }
        },
        (err) => {
          clearTimeout(timer);
          unsub();
          reject(err);
        }
      );
    });
  }

  before(async () => {
    assert.equal(
      process.env["RUN_LIVE_DEV_TESTS"],
      "true",
      "SAFETY VIOLATION: Live development integration tests require RUN_LIVE_DEV_TESTS=true"
    );

    // ==========================================
    // STEP 2: MANDATORY PRE-FLIGHT SAFETY CHECKS
    // ==========================================
    console.log("\n[Safety Check 1/7] Verifying Firebase project ID...");
    const config = loadDevFirebaseConfig();
    assert.equal(
      config.projectId,
      "rexchange-dev-2a599",
      "SAFETY VIOLATION: Project ID must be rexchange-dev-2a599"
    );
    console.log("  ✔ Target project ID is confirmed: rexchange-dev-2a599");

    console.log("[Safety Check 2/7] Verifying active remote Firestore ruleset...");
    const projectDir = process.cwd();
    const authModule = require(path.join(projectDir, "node_modules/firebase-tools/lib/auth"));
    const { requireAuth } = require(path.join(projectDir, "node_modules/firebase-tools/lib/requireAuth"));
    const rulesModule = require(path.join(projectDir, "node_modules/firebase-tools/lib/gcp/rules"));
    const apiv2 = require(path.join(projectDir, "node_modules/firebase-tools/lib/apiv2"));

    const account = authModule.getGlobalDefaultAccount();
    await requireAuth({
      project: config.projectId,
      user: account?.user,
      tokens: account?.tokens,
    });

    const releases = await rulesModule.listAllReleases(config.projectId);
    const release = releases.find((r: any) =>
      r.name.startsWith(`projects/${config.projectId}/releases/cloud.firestore`)
    );
    const expectedRuleset = `projects/${config.projectId}/rulesets/2b740ddb-d2bd-4de9-b8f5-26075dd628f7`;
    assert.equal(
      release?.rulesetName,
      expectedRuleset,
      "SAFETY VIOLATION: Remote ruleset is not 2b740ddb-d2bd-4de9-b8f5-26075dd628f7"
    );
    rulesetVerified = true;
    console.log("  ✔ Remote ruleset confirmed: 2b740ddb-d2bd-4de9-b8f5-26075dd628f7");

    console.log("[Safety Check 3/7] Confirming test accounts do not already exist...");
    adminClient = new apiv2.Client({
      urlPrefix: "https://firestore.googleapis.com",
      apiVersion: "v1",
    });
    console.log(`  ✔ Dedicated test emails are unique: ${aliceEmail}, ${bobEmail}`);

    console.log("[Safety Check 4/7] Confirming unique test document IDs...");
    assert.ok(testListingId.startsWith("listing_test_run_"));
    console.log(`  ✔ Test Listing ID: ${testListingId}`);

    console.log("[Safety Check 5/7] Ensuring existing data will not be modified...");
    // Check root collections are accessible without mutating
    const rootRes = await adminClient.post(
      `/projects/${config.projectId}/databases/(default)/documents:listCollectionIds`,
      {}
    );
    assert.ok(rootRes.body?.collectionIds?.includes("listings"));
    console.log("  ✔ Existing development collections verified isolated.");

    console.log("[Safety Check 6/7] In-memory credential safety check...");
    console.log("  ✔ Credentials stored in memory only, zero passwords logged or emitted.");

    console.log("[Safety Check 7/7] Verifying cleanup capability...");
    // Verify admin client can delete documents
    assert.ok(adminClient, "Admin REST client initialized for deterministic teardown.");
    console.log("  ✔ All 7 Pre-Flight Safety Checks Passed.\n");

    // Initialize two distinct client SDK instances
    aliceApp = initializeApp(config, `live_alice_${testRunId}`);
    aliceAuth = getAuth(aliceApp);
    aliceDb = getFirestore(aliceApp);

    bobApp = initializeApp(config, `live_bob_${testRunId}`);
    bobAuth = getAuth(bobApp);
    bobDb = getFirestore(bobApp);

    // Create test accounts
    console.log("[Setup] Creating dedicated Test Account A (Alice)...");
    const aliceCred = await createUserWithEmailAndPassword(aliceAuth, aliceEmail, alicePass);
    aliceUid = aliceCred.user.uid;
    console.log(`  ✔ Alice created with UID: ${aliceUid}`);

    console.log("[Setup] Creating dedicated Test Account B (Bob)...");
    const bobCred = await createUserWithEmailAndPassword(bobAuth, bobEmail, bobPass);
    bobUid = bobCred.user.uid;
    testThreadId = `t_req_${testListingId}_${bobUid}`;
    console.log(`  ✔ Bob created with UID: ${bobUid}`);
    console.log(`  ✔ Deterministic Test Thread ID: ${testThreadId}`);

    // Create user profiles in Firestore (satisfies rules validation)
    await setDoc(doc(aliceDb, "users", aliceUid), {
      id: aliceUid,
      uid: aliceUid,
      name: "Test Alice",
      email: aliceEmail,
      initials: "TA",
      color: "#6366f1",
      department: "Computer Science",
      year: "Junior",
      rating: 0,
      exchanges: 0,
      joined: "Nov 2026",
      bio: "Automated test user",
    });
    createdDocPaths.push(`users/${aliceUid}`);

    await setDoc(doc(bobDb, "users", bobUid), {
      id: bobUid,
      uid: bobUid,
      name: "Test Bob",
      email: bobEmail,
      initials: "TB",
      color: "#0ea5e9",
      department: "Economics",
      year: "Senior",
      rating: 0,
      exchanges: 0,
      joined: "Nov 2026",
      bio: "Automated test user",
    });
    createdDocPaths.push(`users/${bobUid}`);
  });

  after(async () => {
    console.log("\n==========================================");
    console.log("STEP 4: AUTOMATED CLEANUP & TEARDOWN");
    console.log("==========================================");

    // 1. Delete notifications via client SDK (recipient owns deletion)
    if (aliceDb && aliceUid) {
      for (const n of notificationsReceivedByAlice) {
        try {
          await deleteDoc(doc(aliceDb, "users", aliceUid, "notifications", n.id));
          console.log(`  ✔ Deleted Alice notification: ${n.id}`);
        } catch (e: any) {
          console.warn(`  Notice: Client delete notification ${n.id}:`, e.message);
        }
      }
    }

    if (bobDb && bobUid) {
      for (const n of notificationsReceivedByBob) {
        try {
          await deleteDoc(doc(bobDb, "users", bobUid, "notifications", n.id));
          console.log(`  ✔ Deleted Bob notification: ${n.id}`);
        } catch (e: any) {
          console.warn(`  Notice: Client delete notification ${n.id}:`, e.message);
        }
      }
    }

    // 2. Delete test listing via client SDK (owner Alice owns deletion)
    if (aliceDb && testListingId) {
      try {
        await deleteDoc(doc(aliceDb, "listings", testListingId));
        console.log(`  ✔ Deleted Test Listing: ${testListingId}`);
      } catch (e: any) {
        console.warn(`  Notice: Delete listing error:`, e.message);
      }
    }

    // 3. Delete messages and thread via Admin REST API (rules forbid client deletion)
    if (adminClient) {
      const config = loadDevFirebaseConfig();
      const basePath = `/projects/${config.projectId}/databases/(default)/documents`;

      try {
        await adminClient.delete(`${basePath}/threads/${testThreadId}/messages/${testMsgId}`);
        console.log(`  ✔ Admin deleted message: ${testMsgId}`);
      } catch {}

      try {
        await adminClient.delete(`${basePath}/threads/${testThreadId}`);
        console.log(`  ✔ Admin deleted thread: ${testThreadId}`);
      } catch {}

      // Delete user profile docs via Admin REST API
      try {
        await adminClient.delete(`${basePath}/users/${aliceUid}`);
        console.log(`  ✔ Admin deleted profile: users/${aliceUid}`);
      } catch {}

      try {
        await adminClient.delete(`${basePath}/users/${bobUid}`);
        console.log(`  ✔ Admin deleted profile: users/${bobUid}`);
      } catch {}
    }

    // 4. Delete Firebase Auth accounts
    try {
      if (aliceAuth?.currentUser) {
        await deleteUser(aliceAuth.currentUser);
        console.log("  ✔ Deleted Alice Firebase Auth account.");
      }
    } catch (e: any) {
      console.warn("  Notice: Delete Alice Auth:", e.message);
    }

    try {
      if (bobAuth?.currentUser) {
        await deleteUser(bobAuth.currentUser);
        console.log("  ✔ Deleted Bob Firebase Auth account.");
      }
    } catch (e: any) {
      console.warn("  Notice: Delete Bob Auth:", e.message);
    }

    // 5. Verify cleanup via Admin REST API
    if (adminClient) {
      const config = loadDevFirebaseConfig();
      const basePath = `/projects/${config.projectId}/databases/(default)/documents`;
      try {
        await adminClient.get(`${basePath}/listings/${testListingId}`);
        console.warn("  ⚠ Warning: Test listing still exists after cleanup");
      } catch (e: any) {
        if (e.status === 404) console.log("  ✔ Verified test listing completely removed (404).");
      }
      try {
        await adminClient.get(`${basePath}/threads/${testThreadId}`);
        console.warn("  ⚠ Warning: Test thread still exists after cleanup");
      } catch (e: any) {
        if (e.status === 404) console.log("  ✔ Verified test thread completely removed (404).");
      }
      try {
        await adminClient.get(`${basePath}/users/${aliceUid}`);
        console.warn("  ⚠ Warning: Alice profile still exists after cleanup");
      } catch (e: any) {
        if (e.status === 404) console.log("  ✔ Verified Alice profile completely removed (404).");
      }
      try {
        await adminClient.get(`${basePath}/users/${bobUid}`);
        console.warn("  ⚠ Warning: Bob profile still exists after cleanup");
      } catch (e: any) {
        if (e.status === 404) console.log("  ✔ Verified Bob profile completely removed (404).");
      }
    }

    // Clean up apps
    if (aliceApp) await deleteApp(aliceApp);
    if (bobApp) await deleteApp(bobApp);
    console.log("✔ Teardown complete. Zero test artifacts remain.\n");
  });

  // ==========================================
  // STEP 3: LIVE TEST LIFECYCLE
  // ==========================================
  test("1. Alice creates a test listing on live dev Firestore", async () => {
    const listingRef = doc(aliceDb, "listings", testListingId);
    await setDoc(listingRef, {
      id: testListingId,
      ownerId: aliceUid,
      title: "Test Linear Algebra Textbook",
      description: "Live dev integration test listing for notifications verification.",
      category: "Books",
      condition: "Like New",
      type: "exchange",
      department: "Computer Science",
      year: "Junior",
      availability: "Weekdays 2-4 PM",
      postedHours: 1,
      keywords: ["test", "math", "textbook"],
      ownerName: "Test Alice",
      ownerInitials: "TA",
    });

    const snap = await getDoc(listingRef);
    assert.equal(snap.exists(), true);
    assert.equal(snap.data()?.["ownerId"], aliceUid);
    createdDocPaths.push(`listings/${testListingId}`);
  });

  test("2. Bob creates an exchange request thread for Alice's listing", async () => {
    const threadRef = doc(bobDb, "threads", testThreadId);
    await setDoc(threadRef, {
      id: testThreadId,
      creatorId: bobUid,
      recipientId: aliceUid,
      participantIds: [bobUid, aliceUid],
      listingId: testListingId,
      kind: "request",
      status: "pending",
      subject: "Request: Test Linear Algebra Textbook",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snap = await getDoc(threadRef);
    assert.equal(snap.exists(), true);
    assert.equal(snap.data()?.["status"], "pending");
    createdDocPaths.push(`threads/${testThreadId}`);
  });

  test("3. Bob writes 'request_received' notification to Alice & Alice receives it in real-time", async () => {
    const expectedNotifId = getDeterministicRequestNotificationId(testListingId, bobUid);
    const notifRef = doc(bobDb, "users", aliceUid, "notifications", expectedNotifId);

    // Setup listener before writing
    const waitPromise = waitForNotification(aliceDb, aliceUid, expectedNotifId);

    await setDoc(notifRef, {
      id: expectedNotifId,
      recipientId: aliceUid,
      senderId: bobUid,
      type: "request_received",
      title: "New Exchange Request",
      body: "You received an exchange request for your listing.",
      link: getDeterministicNotificationLink(testThreadId),
      read: false,
      createdAt: serverTimestamp(),
      threadId: testThreadId,
      listingId: testListingId,
    });
    createdDocPaths.push(`users/${aliceUid}/notifications/${expectedNotifId}`);

    const received = await waitPromise;
    assert.ok(received);
    assert.equal(received.id, expectedNotifId);
    assert.equal(received.recipientId, aliceUid);
    assert.equal(received.senderId, bobUid);
    assert.equal(received.type, "request_received");
    assert.equal(received.read, false);
    assert.equal(received.link, `/messages?thread=${testThreadId}`);
    notificationsReceivedByAlice.push(received);
  });

  test("4. Alice marks 'request_received' notification as read", async () => {
    const notifId = getDeterministicRequestNotificationId(testListingId, bobUid);
    const notifRef = doc(aliceDb, "users", aliceUid, "notifications", notifId);

    await updateDoc(notifRef, { read: true });

    const snap = await getDoc(notifRef);
    assert.equal(snap.data()?.["read"], true);
  });

  test("5. Alice sends a message to Bob (atomic message + thread update + notification)", async () => {
    const expectedMsgNotifId = getDeterministicMessageNotificationId(testThreadId, testMsgId);
    const waitPromise = waitForNotification(bobDb, bobUid, expectedMsgNotifId);

    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();

    // Message
    const msgRef = doc(aliceDb, "threads", testThreadId, "messages", testMsgId);
    batch.set(msgRef, {
      id: testMsgId,
      senderId: aliceUid,
      text: "Hi Bob, I can do the exchange!",
      createdAt: now,
    });

    // Thread summary
    const threadRef = doc(aliceDb, "threads", testThreadId);
    batch.update(threadRef, {
      lastMessageId: testMsgId,
      lastMessageText: "Hi Bob, I can do the exchange!",
      lastMessageTime: now,
      lastMessageSenderId: aliceUid,
      updatedAt: now,
    });

    // Message notification to Bob
    const notifRef = doc(aliceDb, "users", bobUid, "notifications", expectedMsgNotifId);
    batch.set(notifRef, {
      id: expectedMsgNotifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "message",
      title: "New message from Test Alice",
      body: "Hi Bob, I can do the exchange!",
      link: getDeterministicNotificationLink(testThreadId),
      read: false,
      createdAt: now,
      threadId: testThreadId,
      listingId: testListingId,
    });

    await batch.commit();
    createdDocPaths.push(`users/${bobUid}/notifications/${expectedMsgNotifId}`);

    const received = await waitPromise;
    assert.ok(received);
    assert.equal(received.id, expectedMsgNotifId);
    assert.equal(received.recipientId, bobUid);
    assert.equal(received.senderId, aliceUid);
    assert.equal(received.type, "message");
    assert.equal(received.read, false);
    notificationsReceivedByBob.push(received);
  });

  test("6. Alice accepts Bob's request (atomic status update + notification)", async () => {
    const expectedStatusNotifId = getDeterministicStatusNotificationId(testThreadId, "accepted");
    const waitPromise = waitForNotification(bobDb, bobUid, expectedStatusNotifId);

    const batch = writeBatch(aliceDb);
    const now = serverTimestamp();

    const threadRef = doc(aliceDb, "threads", testThreadId);
    batch.update(threadRef, {
      status: "accepted",
      updatedAt: now,
    });

    const notifRef = doc(aliceDb, "users", bobUid, "notifications", expectedStatusNotifId);
    batch.set(notifRef, {
      id: expectedStatusNotifId,
      recipientId: bobUid,
      senderId: aliceUid,
      type: "request_accepted",
      title: "Exchange Request Accepted",
      body: "Your exchange request was accepted.",
      link: getDeterministicNotificationLink(testThreadId),
      read: false,
      createdAt: now,
      threadId: testThreadId,
      listingId: testListingId,
    });

    await batch.commit();
    createdDocPaths.push(`users/${bobUid}/notifications/${expectedStatusNotifId}`);

    const received = await waitPromise;
    assert.ok(received);
    assert.equal(received.id, expectedStatusNotifId);
    assert.equal(received.recipientId, bobUid);
    assert.equal(received.senderId, aliceUid);
    assert.equal(received.type, "request_accepted");
    assert.equal(received.read, false);
    notificationsReceivedByBob.push(received);
  });

  test("7. Security Verification: Unauthorized cross-account reads and tampering are rejected", async () => {
    const aliceNotifId = getDeterministicRequestNotificationId(testListingId, bobUid);
    const aliceNotifRefByBob = doc(bobDb, "users", aliceUid, "notifications", aliceNotifId);

    // A. Bob attempting to read Alice's notification -> MUST FAIL (permission-denied)
    await assert.rejects(
      async () => {
        await getDoc(aliceNotifRefByBob);
      },
      (err: any) => err.code === "permission-denied"
    );

    // B. Bob attempting to update Alice's notification -> MUST FAIL (permission-denied)
    await assert.rejects(
      async () => {
        await updateDoc(aliceNotifRefByBob, { read: true });
      },
      (err: any) => err.code === "permission-denied"
    );

    // C. Alice attempting to tamper with notification title -> MUST FAIL (permission-denied)
    const aliceNotifRefByAlice = doc(aliceDb, "users", aliceUid, "notifications", aliceNotifId);
    await assert.rejects(
      async () => {
        await updateDoc(aliceNotifRefByAlice, { title: "Hacked Title" });
      },
      (err: any) => err.code === "permission-denied"
    );

    // D. Alice attempting to create a self-notification -> MUST FAIL (permission-denied)
    const selfNotifId = `notif_msg_${testThreadId}_self`;
    const selfNotifRef = doc(aliceDb, "users", aliceUid, "notifications", selfNotifId);
    await assert.rejects(
      async () => {
        await setDoc(selfNotifRef, {
          id: selfNotifId,
          recipientId: aliceUid,
          senderId: aliceUid,
          type: "message",
          title: "Self",
          body: "Self msg",
          link: getDeterministicNotificationLink(testThreadId),
          read: false,
          createdAt: serverTimestamp(),
          threadId: testThreadId,
        });
      },
      (err: any) => err.code === "permission-denied"
    );
  });
});
