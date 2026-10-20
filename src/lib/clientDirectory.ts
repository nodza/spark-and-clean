import { accountIsDisabled } from "@/lib/adminAuth";
import {
  parseListPagination,
  type ListPagination,
  type PageSize,
} from "@/lib/listPagination";

/** Current client role, plus legacy rows stored as CUSTOMER. */
export const CLIENT_DIRECTORY_ROLES = ["client", "CUSTOMER"] as const;

export const CLIENT_DIRECTORY_SELECT =
  "name email phone preferredCity addresses.city addresses.isDefault disabledAt isActive role";

export type ClientDirectoryRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  inactive: boolean;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isClientDirectoryRole(role: unknown): boolean {
  return role === "client" || role === "CUSTOMER";
}

export function clientIsInactive(doc: {
  disabledAt?: unknown;
  isActive?: unknown;
}): boolean {
  if (
    accountIsDisabled({
      disabledAt: doc.disabledAt as Date | string | null | undefined,
      isActive: typeof doc.isActive === "boolean" ? doc.isActive : undefined,
    })
  ) {
    return true;
  }
  return doc.isActive === false;
}

/** Account city. Blank when neither preferred city nor an address city is set. */
export function clientCity(doc: {
  preferredCity?: unknown;
  addresses?: unknown;
}): string {
  const preferred = clean(doc.preferredCity);
  if (preferred) return preferred;

  const addresses = Array.isArray(doc.addresses) ? doc.addresses : [];
  const records = addresses.filter(
    (address): address is Record<string, unknown> =>
      Boolean(address) && typeof address === "object"
  );
  const chosen =
    records.find((address) => address.isDefault === true) ?? records[0];
  return chosen ? clean(chosen.city) : "";
}

function rowId(doc: Record<string, unknown>): string {
  const raw = doc._id ?? doc.id;
  if (raw == null) return "";
  return String(raw);
}

/**
 * Whitelisted client row. Office staff and drivers return null.
 * Never copies passwordHash or other credential fields.
 */
export function toClientDirectoryRow(
  doc: Record<string, unknown>
): ClientDirectoryRow | null {
  if (!isClientDirectoryRole(doc.role)) return null;
  const id = rowId(doc);
  if (!id) return null;
  return {
    id,
    name: clean(doc.name),
    phone: clean(doc.phone),
    email: clean(doc.email),
    city: clientCity(doc),
    inactive: clientIsInactive(doc),
  };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive matchers for name, phone, and email.
 * A digit-only or mixed phone query also matches numbers stored with spaces.
 */
export function clientSearchMatchers(rawQuery: string): RegExp[] | null {
  const q = rawQuery.trim();
  if (!q) return null;

  const literal = new RegExp(escapeRegExp(q), "i");
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return [literal];

  const flexSource = digits.split("").map((digit) => escapeRegExp(digit)).join("\\D*");
  if (flexSource === escapeRegExp(q)) return [literal];
  return [literal, new RegExp(flexSource)];
}

export function clientMatchesSearch(
  row: Pick<ClientDirectoryRow, "name" | "phone" | "email">,
  rawQuery: string
): boolean {
  const matchers = clientSearchMatchers(rawQuery);
  if (!matchers) return true;
  const [literal, phoneFlex] = matchers;
  if (
    literal.test(row.name) ||
    literal.test(row.phone) ||
    literal.test(row.email)
  ) {
    return true;
  }
  return phoneFlex ? phoneFlex.test(row.phone) : false;
}

/** Full client list. Does not drop switched-off accounts or require a recent login. */
export function clientDirectoryFilter(rawQuery: string): Record<string, unknown> {
  const role = { role: { $in: [...CLIENT_DIRECTORY_ROLES] } };
  const matchers = clientSearchMatchers(rawQuery);
  if (!matchers) return role;

  const [literal, phoneFlex] = matchers;
  const or: Record<string, unknown>[] = [
    { name: literal },
    { phone: literal },
    { email: literal },
  ];
  if (phoneFlex) or.push({ phone: phoneFlex });
  return { ...role, $or: or };
}

export function directoryWindow(
  total: number,
  requested: ListPagination
): { page: number; limit: PageSize; skip: number } {
  const parsed = parseListPagination({
    get(name: string) {
      if (name === "page") return String(requested.page);
      if (name === "limit") return String(requested.limit);
      return null;
    },
  });
  const limit = parsed.limit;
  const totalPages = total <= 0 ? 1 : Math.max(1, Math.ceil(total / limit));
  const page = Math.min(parsed.page, totalPages);
  return { page, limit, skip: (page - 1) * limit };
}
