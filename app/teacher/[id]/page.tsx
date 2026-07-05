"use client";

import { use } from "react";
import { TeacherView } from "@/components/teacher-view";
import { useRole } from "@/components/auth-gate";
import { useHydrated } from "@/components/ui";

export default function TeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const role = useRole();
  const hydrated = useHydrated();

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  return (
    <TeacherView
      teacherId={id}
      isAdmin={role === "admin"}
      back={role === "admin" ? "/teachers" : "/"}
    />
  );
}
