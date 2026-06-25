#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COLS = 30;
const ROWS = 7;
const SX = 14;
const SY = 8;
const ORIGIN_X = 600 - ((COLS - 1) * SX) / 2 + ((ROWS - 1) * SX) / 2;
const ORIGIN_Y = 70;
const CUBE_H = 10;
const CELL_TOP = `M0,-${SY} L${SX},0 L0,${SY} L-${SX},0 Z`;
const CELL_LEFT = `M-${SX},0 L0,${SY} L0,${SY + CUBE_H} L-${SX},${CUBE_H} Z`;
const CELL_RIGHT = `M${SX},0 L0,${SY} L0,${SY + CUBE_H} L${SX},${CUBE_H} Z`;

function isoToScreen(c, r) {
  const x = ORIGIN_X + (c - r) * SX;
  const y = ORIGIN_Y + (c + r) * SY;
  return [x, y];
}

const HEAT = [
  { top: "#0d1117", left: "#0a0d12", right: "#06090d", border: "rgba(255,255,255,0.06)" },
  { top: "#1f6feb33", left: "#1f6feb22", right: "#1f6feb1a", border: "rgba(34,211,238,0.18)" },
  { top: "#7c3aed66", left: "#7c3aed4d", right: "#7c3aed3a", border: "rgba(167,139,250,0.32)" },
  { top: "#22d3eeaa", left: "#22d3ee7a", right: "#22d3ee5a", border: "rgba(34,211,238,0.55)" },
  { top: "#f472b6e0", left: "#f472b6a8", right: "#f472b680", border: "rgba(244,114,182,0.85)" },
];

let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

const cells = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const noise = rand();
    const dist = Math.abs(c - COLS / 2) / (COLS / 2);
    const heat =
      noise > 0.85
        ? 4
        : noise > 0.7
        ? 3
        : noise > 0.5
        ? 2
        : noise > 0.3
        ? 1
        : 0;
    cells.push({ c, r, heat: Math.max(0, heat - Math.floor(dist * 1.5)) });
  }
}

const cubes = cells
  .map(({ c, r, heat }) => {
    const [x, y] = isoToScreen(c, r);
    const palette = HEAT[heat];
    return `    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <path d="${CELL_LEFT}" fill="${palette.left}"/>
      <path d="${CELL_RIGHT}" fill="${palette.right}"/>
      <path d="${CELL_TOP}" fill="${palette.top}" stroke="${palette.border}" stroke-width="0.6"/>
    </g>`;
  })
  .join("\n");

const path = [];
for (let r = 0; r < ROWS; r++) {
  const order = r % 2 === 0 ? [...Array(COLS).keys()] : [...Array(COLS).keys()].reverse();
  for (const c of order) {
    const [x, y] = isoToScreen(c, r);
    path.push([x, y]);
  }
}
const pathD = path
  .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${(y - 4).toFixed(1)}`)
  .join(" ");

const totalCells = path.length;
const cellDur = 0.35;
const totalDur = totalCells * cellDur;
const snakeSegments = 6;
const colors = ["#f472b6", "#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#fb7185"];

const snake = colors
  .slice(0, snakeSegments)
  .map((color, i) => {
    const begin = -(i * cellDur);
    return `    <g>
      <circle r="7" fill="${color}" opacity="${(1 - i * 0.12).toFixed(2)}">
        <animate attributeName="r" values="7;8;7" dur="0.9s" repeatCount="indefinite"/>
      </circle>
      <circle r="3" fill="#ffffff" opacity="0.7"/>
      <animateMotion dur="${totalDur.toFixed(1)}s" repeatCount="indefinite" begin="${begin.toFixed(2)}s" rotate="0" path="${pathD}"/>
    </g>`;
  })
  .join("\n");

const head = `    <g>
      <circle r="11" fill="#ffffff" opacity="0.18">
        <animate attributeName="r" values="11;14;11" dur="0.9s" repeatCount="indefinite"/>
      </circle>
      <circle r="9" fill="#ffffff"/>
      <circle r="6" fill="#0A0A0B"/>
      <circle cx="-2" cy="-2" r="2" fill="#22d3ee"/>
      <circle cx="2" cy="-2" r="2" fill="#22d3ee"/>
      <animateMotion dur="${totalDur.toFixed(1)}s" repeatCount="indefinite" begin="${cellDur.toFixed(2)}s" rotate="0" path="${pathD}"/>
    </g>`;

const width = 1200;
const height = ORIGIN_Y + (COLS + ROWS - 2) * SY + 60;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Isometric 3D commit grid with animated snake">
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>

  <g filter="url(#blur)" opacity="0.7">
    <ellipse cx="600" cy="${(ORIGIN_Y + (COLS + ROWS - 2) * SY / 2).toFixed(0)}" rx="520" ry="${((COLS + ROWS) * SY / 2).toFixed(0)}" fill="url(#glow)"/>
  </g>

  <g>
${cubes}
  </g>

  <g>
${snake}
${head}
  </g>
</svg>
`;

writeFileSync(resolve(ROOT, "assets/iso-grid.svg"), svg);
console.log(`Wrote assets/iso-grid.svg (${svg.length} bytes, ${cells.length} cubes, ${totalCells} path nodes)`);
