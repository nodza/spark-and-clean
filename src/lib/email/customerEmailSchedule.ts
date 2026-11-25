import { johannesburgCalendarDate } from "@/lib/localCalendarDate";
import {
  CUSTOMER_EMAIL_LOCAL_HOUR,
  CUSTOMER_EMAIL_LOCAL_MINUTE,
  runScheduledCustomerEmails,
  shiftCalendarDate,
} from "@/lib/email/scheduledCustomerEmails";

const SAST_OFFSET_HOURS = 2;
const BOOT_WINDOW_MINUTES = 15;
const FLAG = "__sparkCustomerEmailSchedule";

function utcInstantForLocalMorning(isoDay: string): Date {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      CUSTOMER_EMAIL_LOCAL_HOUR - SAST_OFFSET_HOURS,
      CUSTOMER_EMAIL_LOCAL_MINUTE,
      0,
      0
    )
  );
}

/** Next 08:00 Africa/Johannesburg strictly after `now`. */
export function nextCustomerEmailRun(now: Date): Date {
  const today = johannesburgCalendarDate(now);
  const todayRun = utcInstantForLocalMorning(today);
  if (todayRun.getTime() > now.getTime()) return todayRun;
  return utcInstantForLocalMorning(shiftCalendarDate(today, 1));
}

export function johannesburgClock(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
}

/** A process that starts just after 08:00 still sends today's batch. */
export function shouldRunCustomerEmailsOnBoot(now: Date): boolean {
  const clock = johannesburgClock(now);
  if (clock.hour !== CUSTOMER_EMAIL_LOCAL_HOUR) return false;
  return clock.minute < BOOT_WINDOW_MINUTES;
}

function schedulerEnabled(): boolean {
  if (process.env.EMAIL_SCHEDULER === "off") return false;
  if (process.env.EMAIL_SCHEDULER === "on") return true;
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase();
  // Dev stays quiet. A local run must not claim the send log for real customers.
  // Production uses this timer and the 06:00 UTC Vercel cron; the log dedupes them.
  return env === "production" || env === "staging" || env === "prod";
}

export function startCustomerEmailSchedule(): void {
  if (!schedulerEnabled()) return;
  const globalState = globalThis as typeof globalThis & Record<string, boolean>;
  if (globalState[FLAG]) return;
  globalState[FLAG] = true;

  if (shouldRunCustomerEmailsOnBoot(new Date())) {
    void runScheduledCustomerEmails().catch((err) => {
      console.error("[email] startup send failed", err);
    });
  }

  const arm = () => {
    const delay = Math.max(1000, nextCustomerEmailRun(new Date()).getTime() - Date.now());
    const timer = setTimeout(() => {
      void runScheduledCustomerEmails()
        .catch((err) => {
          console.error("[email] scheduled send failed", err);
        })
        .finally(arm);
    }, delay);
    timer.unref?.();
  };
  arm();
}
