export const OPEN_SUPPORT_CHAT_EVENT = "spark:open-support-chat";

export function openSupportChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT));
}
