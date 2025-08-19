export function getTelegramContext() {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  return { initData: tg.initData, initDataUnsafe: tg.initDataUnsafe };
}
