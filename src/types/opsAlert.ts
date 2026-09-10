export type OpsAlertType = "NEW_BOOKING";

export interface OpsAlert {
  id: string;
  type: OpsAlertType;
  bookingId: string;
  title: string;
  meta: string;
  /** null / missing = unread (visible to all admins until dismissed) */
  dismissedAt: string | null;
  createdAt: string;
}
