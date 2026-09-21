import { describe, expect, it } from "vitest";
import {
  buildAssignmentBoard,
  collectionsForAssignmentDay,
  customerSurname,
  isAssignmentBoardStatus,
} from "@/lib/assignmentBoard";
import type { AssignmentBoardJob } from "@/lib/assignmentBoard";

function job(
  partial: Partial<AssignmentBoardJob> & Pick<AssignmentBoardJob, "id">
): AssignmentBoardJob {
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

describe("collectionsForAssignmentDay", () => {
  it("keeps BOOKED/SCHEDULED jobs on that Johannesburg day", () => {
    const rows = collectionsForAssignmentDay(
      [
        job({ id: "a", status: "BOOKED" }),
        job({ id: "b", status: "SCHEDULED", collectionSlot: "AFTERNOON" }),
        job({ id: "c", status: "COLLECTED" }),
        job({ id: "d", collectionDate: "2026-09-16" }),
        job({
          id: "e",
          collectionDate: "2026-09-16T22:30:00.000Z",
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
        }),
        job({ id: "t-am", assignedDriverId: "d1" }),
        job({
          id: "t-pm",
          assignedDriverId: "d1",
          collectionSlot: "AFTERNOON",
        }),
        job({ id: "inactive", assignedDriverId: "inactive_1" }),
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
    const jobs = Array.from({ length: 7 }, (_, index) =>
      job({ id: `over-${index}`, assignedDriverId: "d1" })
    );
    const columns = buildAssignmentBoard(jobs, drivers, 6);
    const thabo = columns.find((col) => col.driverId === "d1")!;
    expect(thabo.slots.MORNING).toHaveLength(7);
    expect(thabo.overCapacity.MORNING).toBe(true);
    expect(thabo.overCapacity.AFTERNOON).toBe(false);
    expect(columns[0].overCapacity.MORNING).toBe(false);
  });
});
