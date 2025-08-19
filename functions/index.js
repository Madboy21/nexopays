const functions = require("firebase-functions");
const admin = require("firebase-admin");
const corsLib = require("cors");
const { verifyTelegramInitData } = require("./verifyTelegram");

admin.initializeApp();
const db = admin.firestore();
const cors = corsLib({ origin: true });

// ===== Constants (keep consistent with frontend) =====
const SUBUNITS_PER_TOKEN = 1000;
const REWARD_PER_AD_SUBUNITS = 500; // 0.5 G
const REFERRAL_BONUS_SUBUNITS = Math.round(REWARD_PER_AD_SUBUNITS * 0.10); // 50
const DAILY_LIMIT = 25;
const MIN_WITHDRAW_SUBUNITS = 100 * SUBUNITS_PER_TOKEN; // 100,000

// Get bot token - set via: firebase functions:config:set tg.bot_token="8408802707:AAEHdYg-FM8G337r1_PwxhMjQzYk1ILWIjI"
const BOT_TOKEN = functions.config && functions.config().tg && functions.config().tg.bot_token
  ? functions.config().tg.bot_token
  : process.env.TG_BOT_TOKEN || "";

// Helper: YYYY-MM-DD in UTC
function todayStampUTC() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- 1) authWithTelegram (POST) ----------
exports.authWithTelegram = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "Method not allowed" });
      const { initData, initDataUnsafe, ref } = req.body;
      // validate initData (recommended)
      const ok = verifyTelegramInitData(BOT_TOKEN, initData);
      if (!ok) return res.status(403).json({ ok: false, error: "Invalid Telegram initData" });

      const telegramId = String(initDataUnsafe?.user?.id || "");
      if (!telegramId) return res.status(400).json({ ok: false, error: "No telegram user id" });

      const userRef = db.collection("users").doc(telegramId);
      const snap = await userRef.get();

      const base = {
        displayName: initDataUnsafe.user?.first_name || "",
        username: initDataUnsafe.user?.username || null,
        photoUrl: initDataUnsafe.user?.photo_url || null,
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!snap.exists) {
        // create new user with referredBy if provided
        await userRef.set({
          ...base,
          referredBy: ref || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          todayStamp: todayStampUTC(),
          todayAds: 0,
          balanceSubunits: 0,
          lifetimeAds: 0,
          isAdmin: false
        }, { merge: true });
      } else {
        await userRef.set(base, { merge: true });
        // do not overwrite referredBy on later logins
      }

      // ensure Firebase Auth user exists (uid = telegramId)
      try {
        await admin.auth().getUser(telegramId);
      } catch (e) {
        // create
        await admin.auth().createUser({ uid: telegramId, displayName: base.displayName });
      }

      // isAdmin flag from firestore if present
      const userSnap = await userRef.get();
      const isAdmin = !!(userSnap.exists && userSnap.data().isAdmin === true);

      // custom token to sign-in from frontend
      const customToken = await admin.auth().createCustomToken(telegramId, { isAdmin });

      res.json({ ok: true, uid: telegramId, customToken, isAdmin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });
});

// ---------- 2) getProfile (POST) ----------
exports.getProfile = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "Method not allowed" });
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ ok: false, error: "Missing uid" });

      const doc = await db.collection("users").doc(String(uid)).get();
      if (!doc.exists) return res.status(404).json({ ok: false, error: "Profile not found" });

      const data = doc.data();
      // convenience derived fields
      const profile = {
        uid: String(uid),
        displayName: data.displayName || null,
        username: data.username || null,
        photoUrl: data.photoUrl || null,
        referredBy: data.referredBy || null,
        todayStamp: data.todayStamp || null,
        todayAds: data.todayAds || 0,
        lifetimeAds: data.lifetimeAds || 0,
        balanceSubunits: data.balanceSubunits || 0,
        isAdmin: !!data.isAdmin
      };
      res.json({ ok: true, profile });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });
});

// ---------- 3) incrementAd (POST) ----------
exports.incrementAd = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "Method not allowed" });
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ ok: false, error: "Missing uid" });

      const userRef = db.collection("users").doc(String(uid));

      await db.runTransaction(async (tx) => {
        const doc = await tx.get(userRef);
        if (!doc.exists) throw new Error("USER_NOT_FOUND");
        const u = doc.data();

        const stamp = todayStampUTC();
        let todayAds = u.todayAds || 0;
        let todayStampField = u.todayStamp || "";

        if (todayStampField !== stamp) {
          todayAds = 0;
          todayStampField = stamp;
        }

        if (todayAds >= DAILY_LIMIT) {
          throw new Error("DAILY_LIMIT_REACHED");
        }

        const newTodayAds = todayAds + 1;
        const newBalance = (u.balanceSubunits || 0) + REWARD_PER_AD_SUBUNITS;
        const newLifetime = (u.lifetimeAds || 0) + 1;

        tx.update(userRef, {
          todayStamp: stamp,
          todayAds: newTodayAds,
          balanceSubunits: newBalance,
          lifetimeAds: newLifetime,
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // referral bonus
        const refId = u.referredBy;
        if (refId) {
          const refRef = db.collection("users").doc(String(refId));
          tx.set(refRef, {
            balanceSubunits: admin.firestore.FieldValue.increment(REFERRAL_BONUS_SUBUNITS),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      const msg = err.message || "SERVER_ERROR";
      if (msg === "DAILY_LIMIT_REACHED") return res.status(409).json({ ok: false, error: msg });
      res.status(400).json({ ok: false, error: msg });
    }
  });
});

// ---------- 4) createWithdraw (POST) ----------
exports.createWithdraw = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "Method not allowed" });
      const { uid, amountTokens, binanceUID } = req.body;
      if (!uid || !amountTokens || !binanceUID) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

      const amountSubunits = Math.floor(Number(amountTokens) * SUBUNITS_PER_TOKEN);
      if (amountSubunits < MIN_WITHDRAW_SUBUNITS) return res.status(400).json({ ok: false, error: "MIN_WITHDRAW_NOT_MET" });

      const userRef = db.collection("users").doc(String(uid));
      const reqRef = db.collection("withdrawRequests").doc();

      await db.runTransaction(async (tx) => {
        const doc = await tx.get(userRef);
        if (!doc.exists) throw new Error("USER_NOT_FOUND");
        const u = doc.data();
        const bal = u.balanceSubunits || 0;
        if (bal < amountSubunits) throw new Error("INSUFFICIENT_BALANCE");

        // lock funds by subtracting immediately
        tx.update(userRef, { balanceSubunits: bal - amountSubunits });
        tx.set(reqRef, {
          userId: String(uid),
          amountSubunits,
          amountTokens: Number(amountTokens),
          binanceUID: String(binanceUID),
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          decidedAt: null,
          decidedBy: null
        });
      });

      res.json({ ok: true, requestId: reqRef.id });
    } catch (err) {
      console.error(err);
      res.status(400).json({ ok: false, error: err.message || "SERVER_ERROR" });
    }
  });
});

// ---------- 5) listWithdraws (GET) - admin only ----------
exports.listWithdraws = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // adminUid passed as query param or header
      const adminUid = req.query.adminUid || req.headers["x-admin-uid"];
      if (!adminUid) return res.status(403).json({ ok: false, error: "MISSING_ADMIN" });

      const adminDoc = await db.collection("users").doc(String(adminUid)).get();
      if (!adminDoc.exists || !adminDoc.data().isAdmin) return res.status(403).json({ ok: false, error: "NOT_ADMIN" });

      const snap = await db.collection("withdrawRequests").where("status", "==", "pending").get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ ok: true, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });
});

// ---------- 6) decideWithdraw (POST) - admin only ----------
exports.decideWithdraw = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { adminUid, requestId, decision } = req.body;
      if (!adminUid || !requestId || !decision) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

      const adminDoc = await db.collection("users").doc(String(adminUid)).get();
      if (!adminDoc.exists || !adminDoc.data().isAdmin) return res.status(403).json({ ok: false, error: "NOT_ADMIN" });

      const reqRef = db.collection("withdrawRequests").doc(String(requestId));
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(reqRef);
        if (!snap.exists) throw new Error("REQUEST_NOT_FOUND");
        const r = snap.data();
        if (r.status !== "pending") throw new Error("ALREADY_DECIDED");

        tx.update(reqRef, {
          status: decision,
          decidedAt: admin.firestore.FieldValue.serverTimestamp(),
          decidedBy: String(adminUid)
        });

        if (decision === "rejected") {
          const userRef = db.collection("users").doc(String(r.userId));
          tx.update(userRef, { balanceSubunits: admin.firestore.FieldValue.increment(r.amountSubunits) });
        }

        tx.set(db.collection("adminLogs").doc(), {
          action: "decideWithdraw",
          meta: { requestId, decision },
          at: admin.firestore.FieldValue.serverTimestamp(),
          by: String(adminUid)
        });
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(400).json({ ok: false, error: err.message || "SERVER_ERROR" });
    }
  });
});

