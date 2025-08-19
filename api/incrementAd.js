import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  const { uid } = req.body;
  const ref = admin.firestore().collection("users").doc(uid);
  await ref.set({
    todayAds: admin.firestore.FieldValue.increment(1),
    lifetimeAds: admin.firestore.FieldValue.increment(1)
  }, { merge:true });
  res.status(200).json({ ok:true });
}
