import type { Metadata, Viewport } from "next";
import { Cairo, Reem_Kufi } from "next/font/google";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

const kufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  variable: "--font-kufi",
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
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${kufi.variable}`}>
      <body className="pattern-bg font-body antialiased">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
