/* 📲 بيان التطبيق المضاف للشاشة الرئيسية — يحمل رابط دخول صاحبة الجهاز.
   الآيفون يفصل التطبيق المضاف عن Safari (ذاكرة مستقلة) ويفتحه على start_url،
   فإن حمل start_url رمزها (?code= أو ?teacher=) دخلت مباشرة من الأيقونة. */

const BASE = {
  name: "الماهر بالقرآن",
  short_name: "الماهر",
  description: "منصة حلقات جمعية الماهر بالقرآن وعلومه",
  lang: "ar",
  dir: "rtl",
  scope: "/",
  display: "standalone",
  background_color: "#f2efec",
  theme_color: "#5d3f4e",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export async function GET(request: Request) {
  const start = new URL(request.url).searchParams.get("start") ?? "";
  const ok = /^\?(code|teacher)=\d{4,8}$/.test(start);
  return new Response(JSON.stringify({ ...BASE, start_url: ok ? `/${start}` : "/" }), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
