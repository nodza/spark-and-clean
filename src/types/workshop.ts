export const WORKSHOP_ACTIVITY_ACTIONS = ["RECEIVED", "CLEANED"] as const;
export type WorkshopActivityAction =
  (typeof WORKSHOP_ACTIVITY_ACTIONS)[number];

export type WorkshopActivityEntry = {
  id: string;
  bookingId: string;
  tagCode: string;
  action: WorkshopActivityAction;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  occurredAt: string;
};
