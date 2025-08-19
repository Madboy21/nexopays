import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  const { uid } = req.body;
  const doc = await admin.firestore().collection("users").doc(uid).get();
  const profile = doc.exists ? doc.data() : { uid, balanceSubunits:0, todayAds:0, lifetimeAds:0 };
  res.status(200).json({ ok:true, profile });
}
