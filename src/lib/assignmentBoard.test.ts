import { describe, expect, it } from "vitest";
import {
  buildAssignmentBoard,
  collectionsForAssignmentDay,
  customerSurname,
  isAssignmentBoardStatus,
  jobsForAssignmentDay,
} from "@/lib/assignmentBoard";
import type { AssignmentBoardJob } from "@/lib/assignmentBoard";
import type { Booking } from "@/types/booking";

function base(
  partial: Partial<Booking> & Pick<Booking, "id">
): Omit<AssignmentBoardJob, "stopKind" | "boardSlot" | "boardDriverId"> {
  return {
    suburb: "Sandton",
    customer: { id: "c1", name: "Nomsa Khumalo", phone: "", email: "" },
    status: "SCHEDULED",
    paymentStatus: "PAID",
    collectionDate: "2026-09-17",
    collectionSlot: "MORNING",
    ...partial,
  };
}

function job(
  partial: Partial<AssignmentBoardJob> & Pick<AssignmentBoardJob, "id">
): AssignmentBoardJob {
  const row = {
    suburb: "Sandton",
    customer: { id: "c1", name: "Nomsa Khumalo", phone: "", email: "" },
    status: "SCHEDULED" as const,
    paymentStatus: "PAID" as const,
    collectionDate: "2026-09-17",
    collectionSlot: "MORNING" as const,
    stopKind: "collection" as const,
    boardSlot: "MORNING" as const,
    ...partial,
  };
  return {
    ...row,
    boardDriverId: row.boardDriverId ?? row.assignedDriverId,
    boardSlot:
      row.boardSlot ??
      (row.collectionSlot === "AFTERNOON" ? "AFTERNOON" : "MORNING"),
  };
}

const drivers = [
  { id: "d1", name: "Thabo Mokoena" },
  { id: "d2", name: "Sipho Dube" },
];

describe("isAssignmentBoardStatus", () => {
  it("includes BOOKED and SCHEDULED only", () => {
    expect(isAssignmentBoardStatus("BOOKED")).toBe(true);
    expect(isAssignmentBoardStatus("SCHEDULED")).toBe(true);
    expect(isAssignmentBoardStatus("COLLECTED")).toBe(false);
    expect(isAssignmentBoardStatus("CANCELLED")).toBe(false);
  });
});

describe("customerSurname", () => {
  it("uses the last name token", () => {
    expect(customerSurname("Nomsa Khumalo")).toBe("Khumalo");
    expect(customerSurname("Patel")).toBe("Patel");
  });
});

describe("jobsForAssignmentDay", () => {
  it("keeps BOOKED/SCHEDULED collections and READY deliveries on that day", () => {
    const rows = jobsForAssignmentDay(
      [
        base({ id: "a", status: "BOOKED" }),
        base({ id: "b", status: "SCHEDULED", collectionSlot: "AFTERNOON" }),
        base({ id: "c", status: "COLLECTED" }),
        base({ id: "d", collectionDate: "2026-09-16" }),
        base({
          id: "e",
          collectionDate: "2026-09-16T22:30:00.000Z",
        }),
        base({
          id: "f",
          status: "READY",
          deliveryDate: "2026-09-17",
          deliverySlot: "AFTERNOON",
          deliveryDriverId: "d2",
          assignedDriverId: "d1",
        }),
        base({
          id: "g",
          status: "READY",
          deliveryDate: "2026-09-18",
          deliverySlot: "MORNING",
        }),
        base({
          id: "h",
          status: "READY",
        }),
      ],
      "2026-09-17"
    );
    expect(rows.map((row) => row.id).sort()).toEqual(["a", "b", "e", "f"]);
    const delivery = rows.find((row) => row.id === "f");
    expect(delivery?.stopKind).toBe("delivery");
    expect(delivery?.boardSlot).toBe("AFTERNOON");
    expect(delivery?.boardDriverId).toBe("d2");
  });
});

describe("collectionsForAssignmentDay", () => {
  it("keeps BOOKED/SCHEDULED jobs on that Johannesburg day", () => {
    const rows = collectionsForAssignmentDay(
      [
        base({ id: "a", status: "BOOKED" }),
        base({ id: "b", status: "SCHEDULED", collectionSlot: "AFTERNOON" }),
        base({ id: "c", status: "COLLECTED" }),
        base({ id: "d", collectionDate: "2026-09-16" }),
        base({
          id: "e",
          collectionDate: "2026-09-16T22:30:00.000Z",
        }),
        base({
          id: "f",
          status: "READY",
          deliveryDate: "2026-09-17",
          deliverySlot: "MORNING",
        }),
      ],
      "2026-09-17"
    );
    expect(rows.map((row) => row.id).sort()).toEqual(["a", "b", "e"]);
  });
});

describe("buildAssignmentBoard", () => {
  it("puts Unassigned first, then active drivers, grouped by slot", () => {
    const columns = buildAssignmentBoard(
      [
        job({ id: "u-am", assignedDriverId: undefined }),
        job({
          id: "u-pm",
          assignedDriverId: "",
          collectionSlot: "AFTERNOON",
          boardSlot: "AFTERNOON",
        }),
        job({ id: "t-am", assignedDriverId: "d1", boardDriverId: "d1" }),
        job({
          id: "t-pm",
          assignedDriverId: "d1",
          boardDriverId: "d1",
          collectionSlot: "AFTERNOON",
          boardSlot: "AFTERNOON",
        }),
        job({
          id: "inactive",
          assignedDriverId: "inactive_1",
          boardDriverId: "inactive_1",
        }),
      ],
      drivers
    );

    expect(columns.map((col) => col.title)).toEqual([
      "Unassigned",
      "Thabo Mokoena",
      "Sipho Dube",
    ]);
    expect(columns[0].slots.MORNING.map((row) => row.id)).toEqual([
      "u-am",
      "inactive",
    ]);
    expect(columns[0].slots.AFTERNOON.map((row) => row.id)).toEqual(["u-pm"]);
    expect(columns[1].slots.MORNING.map((row) => row.id)).toEqual(["t-am"]);
    expect(columns[1].slots.AFTERNOON.map((row) => row.id)).toEqual(["t-pm"]);
    expect(columns[2].slots.MORNING).toEqual([]);
  });

  it("warns when a driver exceeds slot capacity without dropping jobs", () => {
    const overloaded = Array.from({ length: 7 }, (_, index) =>
      job({
        id: `over-${index}`,
        assignedDriverId: "d1",
        boardDriverId: "d1",
      })
    );
    const columns = buildAssignmentBoard(overloaded, drivers, 6);
    expect(columns[1].slots.MORNING).toHaveLength(7);
    expect(columns[1].overCapacity.MORNING).toBe(true);
    expect(columns[1].overCapacity.AFTERNOON).toBe(false);
  });
});
