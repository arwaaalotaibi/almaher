"use client";

import { useEffect, useState } from "react";
import { STUDENT_PICK_KEY } from "@/lib/store";
import { PageHeader, useHydrated } from "@/components/ui";
import { RaceBoard } from "@/components/race-board";

/** 🏆 سباق الحلقات: منافسة تلقائية بين الطالبات — كل المساجد أو مسجد معين */
export default function RacePage() {
  const hydrated = useHydrated();
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
  }, []);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🏆 سباق الحلقات" back="/" />
      <p className="-mt-2 mb-4 text-sm text-silver-600">
        النقاط تُحسب تلقائياً من التسميع والحضور والقراءة والاختبارات
      </p>
      <RaceBoard myId={myId} />
    </main>
  );
}
