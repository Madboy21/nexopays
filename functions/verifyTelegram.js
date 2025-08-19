import crypto from "crypto";

/**
 * Verify Telegram WebApp initData
 * @param {string} botToken - Bot token from @BotFather
 * @param {string} initDataRaw - raw initData query string from tg.initData
 * @returns {boolean}
 */
export function verifyTelegramInitData(botToken, initDataRaw) {
  if (!botToken || !initDataRaw) return false;

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  // build data_check_string
  const dataCheckArr = [];
  for (const [k, v] of params.entries()) {
    dataCheckArr.push(`${k}=${v}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  // secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  // compute HMAC-SHA256 of data_check_string using secret_key
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return hmac === hash;
}
