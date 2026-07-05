"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "./auth-gate";
import type { Role } from "@/lib/supabase";

/** يعيد التوجيه للرئيسية إن لم يكن الدور مسموحاً به */
export function RoleOnly({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const role = useRole();
  const router = useRouter();
  const allowed = roles.includes(role);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
