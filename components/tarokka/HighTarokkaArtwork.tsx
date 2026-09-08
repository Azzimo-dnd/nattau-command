import { useId, type ReactNode } from "react";

// Original vector illustrations. The engraved, monochrome High Deck follows
// Tarokka's traditional subjects without embedding scans of published cards.
function Candle({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><path d="M-4 0h8v26h-8z" fill="#e7ddc9" /><path d="M0-2c-11-7 1-15 0-22 10 11 7 18 0 22Z" fill="#e7ddc9" /><path d="M-10 28h20M0 0v5" /></g>;
}
function Scene({ artKey }: { artKey: string }): ReactNode {
  switch (artKey) {
    case "high-artifact": return <>
      <path d="M62 254h116l-9-20H71Zm16-20 10-52h64l10 52" fill="#282326" />
      <path d="M119 64c-42 0-57 62-28 96l29 22 29-22c29-34 13-96-30-96Z" fill="#e7ddc9" />
      <path d="m120 76 26 30-9 43-17 17-17-17-9-43Z" fill="#282326" /><path d="m120 82-13 29 13 45 13-45Z" fill="#e7ddc9" />
      <path d="M120 42V24m-39 37L64 42m96 19 17-19M70 102H48m122 0h23M89 175l-18 15m80-15 18 15M89 205h62M85 216h71M92 242h56" />
      <Candle x={43} y={209} /><Candle x={198} y={209} />
    </>;
    case "high-beast": return <>
      <circle cx="155" cy="66" r="30" fill="#e7ddc9" />
      <path d="m60 246 5-70-18-54 24-60 28 30 33-5 34-27 8 58 18 39-25 13-3 48 19 28Z" fill="#282326" />
      <path d="m62 123 19-42 10 25 31-9 31-15 4 41 23 26-34 12-8 33-17 28-25-31-19-25Z" fill="#e7ddc9" />
      <path d="m73 125 24 3-8 11Zm57 1 26-4-15 16ZM100 156l31-2-15 17Zm-1 19 19 8 20-15-13 34-13 3Z" fill="#282326" />
      <path d="m88 151 10 3m-17-11 13 3m42 3 14-5m-48 49 1 13m8-16v17m8-20-1 14M69 193l19 45m-26-20 10 25m80-43-13 41m25-26-15 31" />
    </>;
    case "high-broken-one": return <>
      <path d="M35 243h170M41 250h158M47 257h146M54 265h132" />
      <path d="M93 240c-30-41-14-69 11-81l31-2 18 40 30 34-20 14-40-36 12 42Z" fill="#282326" />
      <path d="M91 149c-21-10-15-45 12-49 30-5 46 21 28 40l-14 15Z" fill="#e7ddc9" />
      <path d="m115 109-14 19 13 7-4 17M109 174l-37 22 2 40-14 2-4-49 39-38M130 167l27-11 11-38 13 4-7 47-25 20" fill="#e7ddc9" />
      <path d="m156 53 13-14 20 7 4 16-23 33-29-26 1-13Z" fill="#e7ddc9" /><path d="m166 43-8 17 14 6-8 15 7 11" />
      <path d="m41 120 11-3m-7-10 3 23m141 62 12 4m-6-10-3 20" />
    </>;
    case "high-darklord": return <>
      <path d="M60 247V67l16-23 13 25h62l13-25 16 23v180Z" fill="#282326" />
      <path d="M85 233V88h70v145M63 174h25m64 0h26" />
      <path d="m97 87-5-29 17 10 11-24 12 24 17-10-6 29Z" fill="#e7ddc9" />
      <path d="M102 94h37l-4 29-14 12-16-12Z" fill="#e7ddc9" /><path d="m109 105 7 1m10 0 7-1m-17 16h10" />
      <path d="m99 131-24 61 23-14-11 66h69l-14-66 24 14-26-61-20 14Z" fill="#e7ddc9" /><path d="m106 145 13 72 17-72m-33 44-8 45m41-45 11 44M120 145v-10" />
      <path d="M46 261h147M35 274h170M36 203v-51l-10-18 10-7m168 76v-51l10-18-10-7" />
    </>;
    case "high-donjon": return <>
      <path d="M45 254V81l16-11V49h17v21h18V49h17v21h20V49h17v21h17V49h17v28l13 4v173Z" fill="#282326" />
      <path d="M79 249v-83c0-58 82-58 82 0v83Z" fill="#e7ddc9" /><path d="M89 249v-84c0-46 62-46 62 0v84Z" fill="#282326" />
      <path d="M101 140v109m19-120v120m19-109v109M90 176h60M90 213h60M47 94h149M48 115h39m65 0h43M48 136h22m100 0h24M58 94v21m120-21v21M64 230h14m85 0h18" />
      <path d="M119 227v-30c-15-15-9-35 2-35s16 18 4 35v30" fill="#e7ddc9" />
      <path d="M32 263h178M43 272h152" />
    </>;
    case "high-executioner": return <>
      <path d="M48 252h115l-10-30H59ZM99 237l-5-36 34-38 21 39-9 36" fill="#282326" />
      <path d="m86 142 22-65 29 1 24 70-26-10-16 11Z" fill="#282326" /><path d="m115 107 9-2 8 3m-19 17 20-1" stroke="#e7ddc9" />
      <path d="m95 150-26 39 15 9 25-29 28 18 29-32-11-10-23 19Z" fill="#e7ddc9" />
      <path d="M175 65 151 229" strokeWidth="6" /><path d="m179 68 12-18 30 37-44 28Z" fill="#e7ddc9" />
      <path d="m39 196 12-38 8 38Zm6 10h9m-11 5h14M100 248h35m-45 8h59" />
    </>;
    case "high-ghost": return <>
      <path d="M56 242V77q64-94 128 0v165M65 242V81q55-80 110 0v161M72 249h95" />
      <path d="M87 185c-15-24-6-53 4-72-3-51 63-55 60-4 23 42 4 62 20 89l-23-8 9 31-26-19-12 31-11-26-26 11Z" fill="#e7ddc9" />
      <path d="M108 103c1-13 22-13 23 0l-6 31h-13Z" fill="#282326" /><path d="m99 136-8 35m15-20-6 30m40-42 10 29m-18-23 6 48M105 192l12-49 13 47" />
      <path d="M30 219c33-17 65 12 91-1s57-18 91-2M27 234c35-14 59 16 90 3s61-12 94-3M38 262c38-8 111-8 158 0" />
    </>;
    case "high-horseman": return <>
      <circle cx="75" cy="63" r="31" fill="#e7ddc9" />
      <path d="m49 161 26-29 52 3 19-38 27-17 19 18-5 37-24-9-12 43-17 23-4 60h-16l-4-63-30-4-21 30-5 39H40l2-46 15-26-23 5-12-13Z" fill="#282326" />
      <path d="m93 123 7-27 23-10 18 45-22 31-24-8 14-25Z" fill="#e7ddc9" /><path d="m117 84-3-35 13-19 14 20-9 36Z" fill="#282326" />
      <path d="M118 60h14m-6 8h4M140 110l17 5 14-11M160 79l-2-23M72 145l47 5M52 170l29-15m72-24-7 29m19-58 18 4M35 261h167" />
      <path d="M151 47v99" strokeWidth="3" /><path d="m153 47 45 9-20 10 16 14-41-8Z" fill="#e7ddc9" />
    </>;
    case "high-innocent": return <>
      <path d="M44 250c3-56-20-104-13-159m15 69 18-36M197 250c-3-56 20-104 13-159m-15 69-18-36" />
      <path d="M77 244c10-37 8-65 26-91l-2-30 33-5 5 38 23 88Z" fill="#e7ddc9" />
      <path d="M97 125c-13-25 1-42 20-42 21 0 34 21 21 42l-10 12h-18Z" fill="#e7ddc9" /><path d="M100 108c13 0 22-8 25-16 1 16 10 15 16 21l-4-21-12-11-17 2-10 15Z" fill="#282326" />
      <path d="m95 161 20 22 27-14 7 10-31 21-30-22M116 198l-7 38m14-36 13 35" /><Candle x={143} y={143} />
      <path d="m142 100 1-14m-23 23-9-9m50 10 8-9M51 236l14-9m-17-5 10-1m128 15-14-9m17-5-10-1" />
    </>;
    case "high-marionette": return <>
      <path d="m47 49 22-13 29 11 20-7 24 9 23-4 26 22-9 11-21-10-16 7-18-14-17 5-23-11-14 8-18-3Z" fill="#e7ddc9" />
      <path d="M78 61 72 170M120 63v70m41-63 9 102M92 58l12 152m43-140-10 140" />
      <circle cx="120" cy="146" r="16" fill="#e7ddc9" /><path d="M107 166h26l6 44-19 8-20-8Z" fill="#e7ddc9" />
      <path d="m105 172-27 22-15-30-9 5 18 41 32-22m30-16 27 22 15-30 9 5-18 41-32-22M105 217l-19 33-15 12m61-45 19 33 15 12" strokeWidth="6" />
      <path d="m111 145 5 1m9 0 5-1m-16 9h12M44 274h152" />
    </>;
    case "high-mists": return <>
      <path d="M30 238V96l21-28 20 28v123m98 0V96l21-28 20 28v142M53 110V40m134 70V40M76 98q44-66 88 0" />
      <path d="m120 124-19 29-4 55 23-9 24 9-6-55Z" fill="#282326" /><circle cx="120" cy="118" r="12" fill="#282326" />
      <path d="M32 157c31-24 70 20 105-4s47-17 74-3M24 181c45-19 55 13 101 0s61-20 88-10M23 210c39-24 87 12 121-4s46-17 74-12M34 235c33-12 59 13 83 0s65-9 87-5M57 257c48-12 83-13 131-2" strokeWidth="4" />
      <path d="m106 266 14-50 15 50M69 150l1-36m99 36-1-36" />
    </>;
    case "high-raven": return <>
      <circle cx="98" cy="82" r="39" fill="#e7ddc9" />
      <path d="M43 218c33-13 70-3 111-21l57-3M78 211l-25-22m82 14 25 21m-27-27-1-39" strokeWidth="5" />
      <path d="m66 189 16-25c4-32 26-58 55-60-8-23 18-43 37-26l23 16-20 6c2 22-8 33-15 38-10 33-49 61-96 51Z" fill="#282326" />
      <path d="M93 174c18-11 33-29 53-55M104 180c22-11 33-30 44-48M89 183c22-5 41-17 50-31m-9-23 19-18" stroke="#e7ddc9" /><circle cx="162" cy="88" r="3" fill="#e7ddc9" />
      <path d="m127 186-5 21 14-6m9-23-1 22 13-5M37 252c47-17 124-16 166-5M54 264c34-13 96-14 136-5" />
    </>;
    case "high-seer": return <>
      <path d="M71 210c-2-41-10-104 21-135 20-22 38-22 58 0 31 31 23 94 20 135Z" fill="#282326" />
      <path d="M98 106c0-43 46-43 46 0l-7 36-16 14-16-14Z" fill="#e7ddc9" /><path d="M95 111h52" strokeWidth="8" /><path d="M110 139h23" />
      <path d="m93 151-26 42 26 29 14-7-19-24 18-15m41-25 26 42-26 29-14-7 19-24-18-15" fill="#e7ddc9" />
      <circle cx="120" cy="218" r="30" fill="#e7ddc9" /><path d="M99 218q21-23 42 0-21 23-42 0Z" /><circle cx="120" cy="218" r="7" fill="#282326" />
      <path d="M48 251h145l12 20H36Zm44-8 5-10m45 10-5-10M120 43V27m-22 22-9-13m53 13 9-13" />
    </>;
    case "high-tempter": return <>
      <path d="M41 250c9-80 16-126 11-173m0 36 27-27m-28 51-19-18M194 253c-4-48 18-68 4-103" />
      <path d="M79 249 92 153l-11-36 15-40 44-2 28 35-21 43 20 96Z" fill="#282326" />
      <path d="M104 90c-18-33-22-41-17-55l28 40m18 13c18-31 23-39 20-53l-29 41" />
      <path d="m103 92 31-1 9 20-11 24-13 7-15-14-8-20Z" fill="#e7ddc9" /><path d="m103 108 10 3m14 0 10-3m-25 17 16-1M99 160l20 33 23-33" />
      <path d="m99 157-23 29-23-13-9 10 35 22 30-25m32-23 24 21 21-10 8 12-32 17-34-20" fill="#e7ddc9" />
      <path d="M178 134h22l-4 22-7 5-7-5Zm11 27v17m-10 0h20" fill="#e7ddc9" /><path d="M65 254c37-5 64-8 102-1M91 224l8-27m48 27-8-27" />
    </>;
    default: return null;
  }
}

export function HighTarokkaArtwork({ artKey }: { artKey: string }) {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="0 0 240 300" className="h-full w-full" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><path d="M0 0v5" stroke="#272225" strokeWidth=".5" /></pattern>
      <clipPath id={`${id}-arch`}><path d="M19 283V84Q20 35 120 7q100 28 101 77v199Z" /></clipPath>
    </defs>
    <g clipPath={`url(#${id}-arch)`}>
      <path d="M0 0h240v300H0Z" fill="#d5c8af" />
      <path d="M0 0h240v300H0Z" fill={`url(#${id}-hatch)`} />
      <g fill="none" stroke="#514449" strokeWidth=".9" opacity=".5">
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${12 + i * 22} 290V${45 + (i % 3) * 18}m0 58-12-15m12-3 11-20`} />)}
      </g>
      <g fill="none" stroke="#282326" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><Scene artKey={artKey} /></g>
      <path d="M0 278q60-14 120 0t120 0v22H0Z" fill="#282326" />
    </g>
    <path d="M19 283V84Q20 35 120 7q100 28 101 77v199Z" fill="none" stroke="#282326" strokeWidth="3" />
    <path d="M12 290V84Q12 27 120 0q108 27 108 84v206Z" fill="none" stroke="#7b645d" />
  </svg>;
}
