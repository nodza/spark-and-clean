"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" className="w-fit">
      <Link href={href}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {children}
      </Link>
    </Button>
  );
}
