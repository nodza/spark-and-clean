import { describe, expect, it } from "vitest";
import {
  applyListPaginationParams,
  DEFAULT_LIST_PAGINATION,
  paginateList,
  parseListPagination,
} from "@/lib/listPagination";

describe("list pagination query", () => {
  it("defaults to page 1 and limit 10", () => {
    expect(parseListPagination(new URLSearchParams())).toEqual(
      DEFAULT_LIST_PAGINATION
    );
  });

  it("reads page and limit from the URL", () => {
    expect(
      parseListPagination(new URLSearchParams("page=2&limit=20"))
    ).toEqual({ page: 2, limit: 20 });
  });

  it("falls back when page or limit is invalid", () => {
    expect(
      parseListPagination(new URLSearchParams("page=0&limit=15"))
    ).toEqual(DEFAULT_LIST_PAGINATION);
  });

  it("omits page and limit at the default view", () => {
    const params = applyListPaginationParams(new URLSearchParams(), {
      page: 1,
      limit: 10,
    });
    expect(params.toString()).toBe("");
  });

  it("writes page=2&limit=10 when leaving the first page", () => {
    const params = applyListPaginationParams(new URLSearchParams(), {
      page: 2,
      limit: 10,
    });
    expect(params.toString()).toBe("page=2&limit=10");
  });

  it("keeps filters and only writes limit when page stays 1", () => {
    const params = applyListPaginationParams(
      new URLSearchParams("payment=UNPAID"),
      { page: 1, limit: 20 }
    );
    expect(params.toString()).toBe("payment=UNPAID&limit=20");
  });
});

describe("paginateList", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  it("returns the second page of 10", () => {
    const result = paginateList(rows, { page: 2, limit: 10 });
    expect(result.items).toEqual([11, 12]);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.total).toBe(12);
  });

  it("clamps a page past the end onto the last page", () => {
    const result = paginateList(rows, { page: 9, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.items).toEqual([11, 12]);
  });
});
