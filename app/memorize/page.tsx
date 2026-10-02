"use client";

import { PageHeader } from "@/components/ui";
import { MemorizePanel } from "@/components/memorize-panel";

/** 🎧 مسمّعي (صفحة مستقلة) — المحتوى نفسه في تبويب «مسمّعي» بصفحة الطالبة */
export default function MemorizePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🎧 مسمّعي" back="/" />
      <MemorizePanel />
    </main>
  );
}
