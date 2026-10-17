export default function GroceryIllustration() {
  return (
    <svg
      className="grocery-illustration"
      viewBox="0 0 600 370"
      role="img"
      aria-label="A FreshMart shopping basket filled with fresh vegetables, bread, and groceries"
    >
      <defs>
        <linearGradient id="basket" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#19b571" />
          <stop offset="1" stopColor="#00763f" />
        </linearGradient>
        <linearGradient id="bread" x1="0" x2="1">
          <stop stopColor="#f7be59" />
          <stop offset="1" stopColor="#db8732" />
        </linearGradient>
        <filter id="basket-shadow">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <ellipse
        cx="302"
        cy="329"
        rx="166"
        ry="15"
        fill="#17643f"
        opacity=".14"
        filter="url(#basket-shadow)"
      />
      <circle cx="295" cy="183" r="146" fill="#dff4e6" />
      <circle cx="458" cy="80" r="35" fill="#eaf8df" />
      <path d="M87 281Q40 206 87 160Q136 223 87 281" fill="#a9dfb6" />
      <path d="M500 283Q552 214 515 167Q466 226 500 283" fill="#b9e8c3" />
      <path d="M479 290Q514 240 558 250Q541 302 479 290" fill="#83d4a2" />
      <g transform="rotate(18 377 151)">
        <rect
          x="355"
          y="47"
          width="58"
          height="197"
          rx="29"
          fill="url(#bread)"
        />
        <path
          d="M364 78l28 14m-28 19 28 14m-28 20 28 14m-28 20 28 14"
          stroke="#ffe0a1"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <g transform="rotate(-13 220 181)">
        <rect x="184" y="110" width="62" height="129" rx="8" fill="#fffefa" />
        <path d="M184 110l14-24h36l12 24" fill="#daebf1" />
        <path d="M198 86V72h36v14" fill="#1486ca" />
        <rect x="184" y="133" width="62" height="58" fill="#d6f0fe" />
        <text
          x="215"
          y="164"
          textAnchor="middle"
          fill="#2581af"
          fontSize="16"
          fontWeight="800"
        >
          MILK
        </text>
        <path
          d="M197 179q20-15 36 0"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
        />
      </g>
      <g fill="#319747">
        <ellipse
          cx="287"
          cy="131"
          rx="33"
          ry="63"
          transform="rotate(-28 287 131)"
        />
        <ellipse
          cx="319"
          cy="126"
          rx="29"
          ry="69"
          transform="rotate(18 319 126)"
        />
        <ellipse
          cx="268"
          cy="164"
          rx="25"
          ry="49"
          transform="rotate(-48 268 164)"
        />
        <ellipse
          cx="342"
          cy="165"
          rx="32"
          ry="48"
          transform="rotate(36 342 165)"
        />
      </g>
      <g stroke="#99d57b" fill="none" strokeWidth="3">
        <path d="M308 218L319 76m-10 96 28-46m-27 30-27-49m26 82-47-25" />
      </g>
      <g transform="rotate(20 419 220)">
        <path d="M403 168q18-17 35 0l-11 98q-5 14-10 0z" fill="#f8a024" />
        <path
          d="M418 164l-5-35m12 35 15-30m-19 30 2-43"
          stroke="#57ad4a"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
      <circle cx="191" cy="213" r="35" fill="#ec5848" />
      <path
        d="M184 177l8 10 12-10-7 13 10 5-17-1-9 9 4-15-10-4z"
        fill="#428b42"
      />
      <circle cx="264" cy="218" r="29" fill="#f6b02d" />
      <path d="M253 194q8-15 20-6" fill="#479849" />
      <path
        d="M140 219h325l-30 95q-3 12-18 12H187q-15 0-20-12z"
        fill="url(#basket)"
      />
      <path
        d="M149 215h307"
        stroke="#30c780"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M186 212q9-94 112-94t113 94"
        fill="none"
        stroke="#086b3b"
        strokeWidth="10"
      />
      <path
        d="M186 212q9-94 112-94t113 94"
        fill="none"
        stroke="#30a76c"
        strokeWidth="5"
      />
      <g stroke="#b6e6b4" strokeWidth="7" strokeLinecap="round" opacity=".65">
        <path d="M179 241l4 15m22-15 3 15m23-15 2 15m24-15 1 15m25-15v15m26-15v15m26-15-1 15m27-15-2 15m27-15-3 15m28-15-4 15" />
        <path d="M188 292l3 13m25-13 2 13m25-13 1 13m26-13v13m26-13v13m26-13-1 13m27-13-2 13m27-13-3 13m26-13-4 13" />
      </g>
      <text
        x="302"
        y="282"
        textAnchor="middle"
        fill="#fff"
        fontSize="24"
        fontWeight="800"
        fontFamily="Arial,sans-serif"
        letterSpacing="1"
      >
        FreshMart
      </text>
      <circle cx="128" cy="114" r="6" fill="#f9c84e" />
      <circle cx="476" cy="142" r="4" fill="#80c693" />
      <path
        d="M151 59v14m-7-7h14"
        stroke="#9cceaf"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
