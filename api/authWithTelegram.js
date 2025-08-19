import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  const { initData, ref } = req.body;
  const uid = "tg_" + Date.now();
  const customToken = await admin.auth().createCustomToken(uid);
  res.status(200).json({ ok:true, customToken, uid });
}
