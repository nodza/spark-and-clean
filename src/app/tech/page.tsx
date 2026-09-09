import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Canonical tech login is /tech/login — keep /tech as a short alias. */
export default async function TechLoginAlias({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(query ? `/tech/login?${query}` : "/tech/login");
}
