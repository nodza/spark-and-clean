export { getAppBaseUrl, bookingPageUrl } from "@/lib/email/appUrl";
export { renderTransactionalEmail, escapeHtml } from "@/lib/email/layout";
export type {
  EmailLedgerRow,
  EmailTimelineStep,
  TransactionalEmail,
} from "@/lib/email/layout";
export { sendTransactionalEmail, passwordResetDedupeKey } from "@/lib/email/sendTransactionalEmail";
export type { SendEmailResult, SendTransactionalEmailInput } from "@/lib/email/sendTransactionalEmail";
export { runScheduledCustomerEmails } from "@/lib/email/scheduledCustomerEmails";
