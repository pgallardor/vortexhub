import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const out = path.join(process.cwd(), "public/demo/platform-banners/platform");

const banners = [
  ["one-piece-tcg-default.webp", "ONE PIECE TCG", "#164e63", "#0f172a", "#38bdf8"],
  ["pokemon-tcg-default.webp", "POKEMON TCG", "#78350f", "#111827", "#facc15"],
  ["yugioh-default.webp", "YUGIOH", "#581c87", "#111827", "#c084fc"],
  ["default.webp", "VORTEXHUB", "#1e3a8a", "#111827", "#93c5fd"],
];

function bannerSvg(title, start, middle, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${start}"/>
        <stop offset="58%" stop-color="${middle}"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
      <radialGradient id="glow" cx="74%" cy="24%" r="56%">
        <stop offset="0%" stop-color="${accent}" stop-opacity=".72"/>
        <stop offset="46%" stop-color="${start}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${middle}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1400" height="720" fill="url(#bg)"/>
    <rect width="1400" height="720" fill="url(#glow)"/>
    <g opacity=".2" stroke="${accent}" stroke-width="2" fill="none">
      <path d="M-50 590 C 220 470, 370 720, 640 560 S 1040 390, 1450 520"/>
      <path d="M-80 210 C 240 80, 500 250, 710 160 S 1060 30, 1480 190"/>
    </g>
    <g transform="translate(790 120) rotate(-10)" opacity=".72">
      <rect x="0" y="0" width="250" height="350" rx="22" fill="#f8fafc" fill-opacity=".1" stroke="#fff" stroke-opacity=".22"/>
      <rect x="34" y="36" width="182" height="108" rx="14" fill="${accent}" fill-opacity=".38"/>
      <rect x="34" y="180" width="182" height="18" rx="9" fill="#fff" fill-opacity=".22"/>
      <rect x="34" y="220" width="138" height="18" rx="9" fill="#fff" fill-opacity=".16"/>
    </g>
    <g transform="translate(1010 210) rotate(8)" opacity=".54">
      <rect x="0" y="0" width="230" height="320" rx="22" fill="#020617" fill-opacity=".28" stroke="#fff" stroke-opacity=".18"/>
      <rect x="32" y="36" width="166" height="96" rx="14" fill="${accent}" fill-opacity=".26"/>
      <rect x="32" y="172" width="166" height="16" rx="8" fill="#fff" fill-opacity=".18"/>
      <rect x="32" y="210" width="126" height="16" rx="8" fill="#fff" fill-opacity=".13"/>
    </g>
    <g transform="translate(92 112)">
      <text x="0" y="0" fill="#ffffff" fill-opacity=".28" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="8">VORTEXHUB EVENT</text>
      <text x="0" y="86" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="900" letter-spacing="1">${title}</text>
      <rect x="0" y="132" width="420" height="4" rx="2" fill="${accent}"/>
      <text x="0" y="196" fill="#dbeafe" fill-opacity=".76" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">Calendario publico de tienda</text>
    </g>
  </svg>`;
}

await mkdir(out, { recursive: true });

for (const [fileName, title, start, middle, accent] of banners) {
  await sharp(Buffer.from(bannerSvg(title, start, middle, accent)))
    .webp({ quality: 86 })
    .toFile(path.join(out, fileName));
}

console.log((await readdir(out)).join("\n"));
