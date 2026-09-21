export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type ListPagination = {
  page: number;
  limit: PageSize;
};

export const DEFAULT_LIST_PAGINATION: ListPagination = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_PAGE_SIZE,
};

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function parseListPagination(
  params: URLSearchParams | { get(name: string): string | null }
): ListPagination {
  const pageRaw = Number.parseInt((params.get("page") || "").trim(), 10);
  const limitRaw = Number.parseInt((params.get("limit") || "").trim(), 10);

  return {
    page: Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE,
    limit: isPageSize(limitRaw) ? limitRaw : DEFAULT_PAGE_SIZE,
  };
}

/**
 * Writes `page` and `limit` onto an existing query.
 * Omits both when page is 1 and limit is 10. Otherwise includes `limit`,
 * and `page` only when it is not 1 — e.g. `?page=2&limit=10`.
 */
export function applyListPaginationParams(
  params: URLSearchParams,
  pagination: ListPagination
): URLSearchParams {
  params.delete("page");
  params.delete("limit");

  const page = pagination.page >= 1 ? pagination.page : DEFAULT_PAGE;
  const limit = isPageSize(pagination.limit)
    ? pagination.limit
    : DEFAULT_PAGE_SIZE;

  if (page === DEFAULT_PAGE && limit === DEFAULT_PAGE_SIZE) {
    return params;
  }

  if (page !== DEFAULT_PAGE) {
    params.set("page", String(page));
  }
  params.set("limit", String(limit));
  return params;
}

export function paginateList<T>(
  items: T[],
  pagination: ListPagination
): {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  limit: PageSize;
} {
  const total = items.length;
  const limit = isPageSize(pagination.limit)
    ? pagination.limit
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const page = Math.min(Math.max(pagination.page, 1), totalPages);
  const start = (page - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    page,
    totalPages,
    total,
    limit,
  };
}
