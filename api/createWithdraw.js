import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  const { uid, amountTokens, binanceUID } = req.body;
  await admin.firestore().collection("withdraws").add({
    uid, amountTokens, binanceUID, timestamp: Date.now()
  });
  res.status(200).json({ ok:true });
}
