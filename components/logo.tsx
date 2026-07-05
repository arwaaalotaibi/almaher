/**
 * شعار جمعية الماهر بالقرآن وعلومه — رسم SVG مطابق لتكوين الشعار الرسمي:
 * قوس مدبّب رمادي بداخله «الماهر»، كتاب مفتوح بنفسجي، وتحته شريطا علم الكويت.
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
      viewBox={`0 0 200 ${withWordmark ? 232 : 186}`}
      className={className}
      role="img"
      aria-label="جمعية الماهر بالقرآن وعلومه"
    >
      <defs>
        <linearGradient id="am-arch" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b7b7a9" />
          <stop offset="1" stopColor="#7e7f6d" />
        </linearGradient>
        <clipPath id="am-ribL">
          <path d="M100 154 L40 139 L52 152 L40 165 L100 180 Z" />
        </clipPath>
        <clipPath id="am-ribR">
          <path d="M100 154 L160 139 L148 152 L160 165 L100 180 Z" />
        </clipPath>
      </defs>

      {/* القوس المدبّب */}
      <path
        d="M58 132 L58 64 Q58 36 82 22 L100 6 L118 22 Q142 36 142 64 L142 132 L124 132 L124 66 Q124 47 110 39 L100 30 L90 39 Q76 47 76 66 L76 132 Z"
        fill="url(#am-arch)"
      />

      {/* الماهر داخل القوس */}
      <text
        x="100"
        y="112"
        textAnchor="middle"
        fontFamily="var(--font-kufi), var(--font-cairo), sans-serif"
        fontWeight="700"
        fontSize="20"
        textLength="44"
        lengthAdjust="spacingAndGlyphs"
        fill="#5e5e52"
      >
        الماهر
      </text>

      {/* الكتاب المفتوح البنفسجي */}
      <path d="M100 132 C76 121 52 115 34 113 L34 127 C52 129 76 135 100 146 Z" fill="#7b5a6e" />
      <path d="M100 132 C124 121 148 115 166 113 L166 127 C148 129 124 135 100 146 Z" fill="#7b5a6e" />
      <path d="M100 146 C78 136 56 131 40 129 L40 134 C58 136 80 141 100 152 Z" fill="#eceae5" />
      <path d="M100 146 C122 136 144 131 160 129 L160 134 C142 136 120 141 100 152 Z" fill="#eceae5" />

      {/* شريطا علم الكويت */}
      <g clipPath="url(#am-ribL)">
        <path d="M100 154 L40 139 L40 147.7 L100 162.7 Z" fill="#3f7d4f" />
        <path d="M100 162.7 L40 147.7 L40 156.3 L100 171.3 Z" fill="#ffffff" stroke="#d8d5cf" strokeWidth="0.5" />
        <path d="M100 171.3 L40 156.3 L40 165 L100 180 Z" fill="#b23a45" />
      </g>
      <g clipPath="url(#am-ribR)">
        <path d="M100 154 L160 139 L160 147.7 L100 162.7 Z" fill="#3f7d4f" />
        <path d="M100 162.7 L160 147.7 L160 156.3 L100 171.3 Z" fill="#ffffff" stroke="#d8d5cf" strokeWidth="0.5" />
        <path d="M100 171.3 L160 156.3 L160 165 L100 180 Z" fill="#b23a45" />
      </g>
      <polygon points="100,157 92,155 100,172 108,155" fill="#26251f" />
      <path d="M100 146 L94 143.5 L100 153 L106 143.5 Z" fill="#ffffff" />

      {withWordmark && (
        <>
          <text
            x="100"
            y="205"
            textAnchor="middle"
            fontFamily="var(--font-kufi), var(--font-cairo), sans-serif"
            fontWeight="700"
            fontSize="16"
            textLength="176"
            lengthAdjust="spacingAndGlyphs"
            fill="#1f1e1a"
          >
            جمعية الماهر بالقرآن وعلومه
          </text>
          <text
            x="100"
            y="222"
            textAnchor="middle"
            fontFamily="var(--font-cairo), sans-serif"
            fontWeight="600"
            fontSize="9"
            letterSpacing="2.5"
            fill="#8a857e"
          >
            Almahr BilQuran
          </text>
        </>
      )}
    </svg>
  );
}
