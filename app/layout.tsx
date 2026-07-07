import type { Metadata, Viewport } from "next";
import { Amiri, Noto_Naskh_Arabic } from "next/font/google";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

// خط كلاسيكي نسخي أنيق للعناوين (نفس خط الطباعة)
const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

// نسخي واضح جداً على الشاشة للنصوص
const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-naskh",
});

export const metadata: Metadata = {
  title: "الماهر — حلقات التحفيظ",
  description: "متابعة حلقات حفظ القرآن الكريم — جمعية الماهر بالقرآن وعلومه",
};

export const viewport: Viewport = {
  themeColor: "#7d5a6c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${amiri.variable} ${naskh.variable}`}>
      <body className="pattern-bg font-body antialiased">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
