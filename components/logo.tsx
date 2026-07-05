/**
 * شعار جمعية الماهر بالقرآن وعلومه — رسم SVG مستوحى من الشعار الرسمي:
 * قوس محراب رمادي، بداخله «الماهر»، وتحته كتاب مفتوح صفحته بألوان علم الكويت.
 */
export function AssocLogo({
  className = "",
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 200 ${withWordmark ? 224 : 178}`}
      className={className}
      role="img"
      aria-label="جمعية الماهر بالقرآن وعلومه"
    >
      {/* قوس المحراب */}
      <path
        d="M62 128 L62 60 Q62 37 100 23 Q138 37 138 60 L138 128"
        fill="none"
        stroke="#918b84"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M69 128 L69 62 Q69 44 100 32 Q131 44 131 62 L131 128"
        fill="none"
        stroke="#b2aca4"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* الماهر داخل القوس */}
      <text
        x="100"
        y="97"
        textAnchor="middle"
        fontFamily="var(--font-kufi), var(--font-cairo), sans-serif"
        fontWeight="700"
        fontSize="27"
        fill="#7d5a6c"
      >
        الماهر
      </text>

      {/* الكتاب المفتوح */}
      <defs>
        {/* الصفحة اليمنى (جهة البداية بالعربي) — علم الكويت */}
        <clipPath id="flagPage">
          <path d="M100 141 C116 132 136 131 148 137 L148 166 C136 162 116 161 100 169 Z" />
        </clipPath>
      </defs>

      {/* الصفحة اليسرى — أسطر */}
      <path
        d="M100 141 C84 132 64 131 52 137 L52 166 C64 162 84 161 100 169 Z"
        fill="#f6f4f1"
        stroke="#6e6862"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M62 142 C72 139 84 139 94 143" stroke="#b2aca4" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M62 149 C72 146 84 146 94 150" stroke="#b2aca4" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M62 156 C72 153 84 153 94 157" stroke="#b2aca4" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* الصفحة اليمنى — علم الكويت */}
      <g clipPath="url(#flagPage)">
        <rect x="100" y="128" width="50" height="14.5" fill="#007a3d" />
        <rect x="100" y="141.5" width="50" height="13" fill="#ffffff" />
        <rect x="100" y="154" width="50" height="16" fill="#ce1126" />
        <polygon points="100,128 114,138 114,160 100,170" fill="#1f1a17" />
      </g>
      <path
        d="M100 141 C116 132 136 131 148 137 L148 166 C136 162 116 161 100 169 Z"
        fill="none"
        stroke="#6e6862"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* وسط الكتاب */}
      <path d="M100 141 L100 169" stroke="#6e6862" strokeWidth="2" />

      {withWordmark && (
        <>
          <text
            x="100"
            y="194"
            textAnchor="middle"
            fontFamily="var(--font-kufi), var(--font-cairo), sans-serif"
            fontWeight="600"
            fontSize="14"
            fill="#6b655f"
          >
            جمعية الماهر بالقرآن وعلومه
          </text>
          <text
            x="100"
            y="210"
            textAnchor="middle"
            fontFamily="var(--font-cairo), sans-serif"
            fontWeight="600"
            fontSize="8.5"
            letterSpacing="2"
            fill="#a39c93"
          >
            Almahr BilQuran
          </text>
        </>
      )}
    </svg>
  );
}
