#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const USER = process.env.GH_USER || "peterdsp";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": `${USER}-stars-sync`,
};
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

async function fetchRepos() {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out
    .filter((r) => !r.fork && !r.private && !r.archived)
    .map((r) => ({ name: r.name, stars: r.stargazers_count, description: r.description || "" }))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]),
  );

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function fetchProfile() {
  const res = await fetch(`https://api.github.com/users/${USER}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const user = await res.json();
  return { followers: user.followers, publicRepos: user.public_repos };
}

const PALETTE = ["#a78bfa", "#22d3ee"];
const TOP_COUNT = 2;
const SLICE_DIR = resolve(ROOT, "assets/stars-slices");

function slabDefs(w, h) {
  return `
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16161a"/>
      <stop offset="1" stop-color="#0a0a0b"/>
    </linearGradient>
    <radialGradient id="orbP" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbC" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbK" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#f472b6" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#f472b6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbM" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#B8B8BD"/>
    </linearGradient>
    <linearGradient id="barTrack" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.09"/>
    </linearGradient>
    <filter id="bigblur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.round(h * 0.16)}"/>
    </filter>
  `;
}

function slabBody({ x, y, w, h, r = 36 }) {
  return `
  <clipPath id="cardClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#base)"/>
  <g clip-path="url(#cardClip)">
    <g filter="url(#bigblur)">
      <circle cx="${x + w * 0.13}" cy="${y + h * 0.34}" r="${h * 0.55}" fill="url(#orbP)">
        <animate attributeName="cx" values="${x + w * 0.13};${x + w * 0.2};${x + w * 0.13}" dur="14s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${x + w * 0.86}" cy="${y + h * 0.6}" r="${h * 0.6}" fill="url(#orbC)">
        <animate attributeName="cy" values="${y + h * 0.6};${y + h * 0.4};${y + h * 0.6}" dur="12s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${x + w * 0.5}" cy="${y + h * 0.98}" r="${h * 0.5}" fill="url(#orbK)"/>
      <circle cx="${x + w * 0.66}" cy="${y + h * 0.08}" r="${h * 0.42}" fill="url(#orbM)">
        <animate attributeName="cx" values="${x + w * 0.66};${x + w * 0.58};${x + w * 0.66}" dur="16s" repeatCount="indefinite"/>
      </circle>
    </g>
    <rect x="${x}" y="${y}" width="${w}" height="1.5" fill="#FFFFFF" opacity="0.1"/>
  </g>
  <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12"/>`;
}

const MONO = "SFMono-Regular, ui-monospace, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const TEXT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";

function starPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function projectTile({ x, y, w, h, rank, project, total, color, descMaxChars }) {
  const share = total > 0 ? project.stars / total : 0;
  const pct = Math.round(share * 100);
  const trackX = x + 76;
  const trackW = w - 76 - 200;
  const fillW = Math.max(6, Math.round(share * trackW));
  const countX = x + w - 28;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#FFFFFF" fill-opacity="0.045"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="21.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.1"/>
    <rect x="${x + 22}" y="${y + 1}" width="${w - 44}" height="1" fill="#FFFFFF" fill-opacity="0.12"/>
    <circle cx="${x + 40}" cy="${y + h / 2}" r="18" fill="${color}" fill-opacity="0.14"/>
    <circle cx="${x + 40}" cy="${y + h / 2}" r="18" fill="none" stroke="${color}" stroke-opacity="0.45"/>
    <text x="${x + 40}" y="${y + h / 2 + 4}" fill="${color}" font-family="${MONO}" font-size="12" font-weight="700" text-anchor="middle">${String(rank).padStart(2, "0")}</text>
    <text x="${trackX}" y="${y + 38}" fill="#FFFFFF" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="-0.4">${esc(project.name)}</text>
    <text x="${trackX}" y="${y + 59}" fill="#8A8A8F" font-family="${TEXT}" font-size="13">${esc(truncate(project.description, descMaxChars))}</text>
    <rect x="${trackX}" y="${y + h - 22}" width="${trackW}" height="4" rx="2" fill="#FFFFFF" fill-opacity="0.08"/>
    <rect x="${trackX}" y="${y + h - 22}" width="${fillW}" height="4" rx="2" fill="${color}"/>
    <text x="${countX}" y="${y + 52}" fill="#FFFFFF" font-family="${SANS}" font-size="36" font-weight="700" letter-spacing="-1" text-anchor="end">${project.stars}</text>
    <path d="${starPath(countX - 12 - String(project.stars).length * 21, y + 40, 9)}" fill="${color}"/>
    <text x="${countX}" y="${y + h - 16}" fill="#6E6E73" font-family="${MONO}" font-size="11" letter-spacing="1.5" text-anchor="end">${pct}% OF STARS</text>
  </g>`;
}

const DESKTOP = { width: 1200, height: 320, rowTop: 60, rowHeight: 108 };
const MOBILE = { width: 720, height: 600, rowTop: 334, rowHeight: 112 };

function buildDesktop({ total, projects, top }) {
  const { width: w, height: h, rowTop, rowHeight } = DESKTOP;
  const tiles = top
    .map((project, i) =>
      projectTile({
        x: 492,
        y: rowTop + 6 + i * rowHeight,
        w: 644,
        h: 96,
        rank: i + 1,
        project,
        total,
        color: PALETTE[i % PALETTE.length],
        descMaxChars: 58,
      }),
    )
    .join("\n");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects, with the two most starred projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

${slabBody({ x: 24, y: 20, w: w - 48, h: h - 40, r: 36 })}

  <g transform="translate(76 70)">
    <text x="0" y="0" fill="#8A8A8F" font-family="${MONO}" font-size="11" letter-spacing="4">STARS · OPEN SOURCE</text>
    <text x="0" y="132" fill="url(#ink)" font-family="${SANS}" font-size="156" font-weight="700" letter-spacing="-5">${total}</text>
    <text x="0" y="164" fill="#C7C7CC" font-family="${TEXT}" font-size="15" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="186" fill="#6E6E73" font-family="${TEXT}" font-size="13">across ${projects.length} open-source projects</text>

    <g transform="translate(0 210)">
      <circle cx="4" cy="6" r="3" fill="#34d399"/>
      <circle cx="4" cy="6" r="6" fill="none" stroke="#34d399" stroke-opacity="0.5">
        <animate attributeName="r" values="4;10;4" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/>
      </circle>
      <text x="22" y="11" fill="#8A8A8F" font-family="${MONO}" font-size="11" letter-spacing="1.5">LIVE · GITHUB.COM/${esc(USER.toUpperCase())}</text>
    </g>
  </g>

  <line x1="452" y1="66" x2="452" y2="270" stroke="#FFFFFF" stroke-opacity="0.08"/>
${tiles}
</svg>
`;
}

function buildMobile({ total, projects, top }) {
  const { width: w, height: h, rowTop, rowHeight } = MOBILE;
  const tiles = top
    .map((project, i) =>
      projectTile({
        x: 56,
        y: rowTop + 6 + i * rowHeight,
        w: 608,
        h: 96,
        rank: i + 1,
        project,
        total,
        color: PALETTE[i % PALETTE.length],
        descMaxChars: 44,
      }),
    )
    .join("\n");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Mobile glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects, with the two most starred projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

${slabBody({ x: 20, y: 20, w: w - 40, h: h - 40, r: 36 })}

  <g transform="translate(56 82)">
    <text x="0" y="0" fill="#8A8A8F" font-family="${MONO}" font-size="13" letter-spacing="4">STARS · OPEN SOURCE</text>
    <text x="0" y="150" fill="url(#ink)" font-family="${SANS}" font-size="184" font-weight="700" letter-spacing="-6">${total}</text>
    <text x="0" y="188" fill="#C7C7CC" font-family="${TEXT}" font-size="20" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="216" fill="#6E6E73" font-family="${TEXT}" font-size="15">across ${projects.length} open-source projects</text>
  </g>
${tiles}
</svg>
`;
}

function buildStats({ total, followers, publicRepos }) {
  const items = [
    { label: "STARS", value: total, color: "#a78bfa" },
    { label: "FOLLOWERS", value: followers, color: "#22d3ee" },
    { label: "REPOS", value: publicRepos, color: "#f472b6" },
  ];
  const cellW = 200, h = 64, pad = 6;
  const w = items.length * cellW + pad * 2;
  const cells = items
    .map(({ label, value, color }, i) => {
      const x = pad + i * cellW;
      const divider = i > 0
        ? `<line x1="${x}" y1="18" x2="${x}" y2="${h - 18}" stroke="#FFFFFF" stroke-opacity="0.1"/>`
        : "";
      return `  ${divider}
  <circle cx="${x + 30}" cy="${h / 2}" r="4" fill="${color}"/>
  <circle cx="${x + 30}" cy="${h / 2}" r="9" fill="${color}" fill-opacity="0.18"/>
  <text x="${x + 50}" y="${h / 2 + 4}" fill="#8A8A8F" font-family="${MONO}" font-size="11" letter-spacing="2.5">${label}</text>
  <text x="${x + cellW - 26}" y="${h / 2 + 8}" fill="#FFFFFF" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="-0.5" text-anchor="end">${value}</text>`;
    })
    .join("\n");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${total} stars, ${followers} followers, ${publicRepos} public repositories">
  <defs>
    <linearGradient id="statsBase" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#16161a"/>
      <stop offset="1" stop-color="#0a0a0b"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="${h / 2}" fill="url(#statsBase)"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${h / 2 - 0.5}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <rect x="${h / 2}" y="0.5" width="${w - h}" height="1" fill="#FFFFFF" fill-opacity="0.12"/>
${cells}
</svg>
`;
}

function updateReadmeLinks(top) {
  const path = resolve(ROOT, "README.md");
  const prev = readFileSync(path, "utf8");
  let next = prev;
  top.forEach((project, i) => {
    const pattern = new RegExp(
      `<a href="[^"]*"><img src="\\./assets/stars-slices/desktop-row-${i + 1}\\.png" alt="[^"]*"`,
    );
    next = next.replace(
      pattern,
      `<a href="https://github.com/${USER}/${project.name}"><img src="./assets/stars-slices/desktop-row-${i + 1}.png" alt="Open the ${esc(project.name)} repository"`,
    );
  });
  if (next === prev) return false;
  writeFileSync(path, next);
  return true;
}

function writeIfChanged(path, content) {
  let prev = "";
  try {
    prev = readFileSync(path, "utf8");
  } catch {}
  if (prev === content) return false;
  writeFileSync(path, content);
  return true;
}

function renderPngIfChanged(svgPath, pngPath) {
  const result = spawnSync("rsvg-convert", [svgPath], {
    encoding: null,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`rsvg-convert failed: ${result.stderr.toString().trim()}`);
  }

  let prev;
  try {
    prev = readFileSync(pngPath);
  } catch {}
  if (prev?.equals(result.stdout)) return false;
  writeFileSync(pngPath, result.stdout);
  return true;
}

function renderPngSliceIfChanged(svgPath, pngPath, { width, top, height }) {
  const result = spawnSync(
    "rsvg-convert",
    [
      `--top=${-top}`,
      `--page-width=${width}`,
      `--page-height=${height}`,
      svgPath,
    ],
    {
      encoding: null,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`rsvg-convert failed: ${result.stderr.toString().trim()}`);
  }

  let prev;
  try {
    prev = readFileSync(pngPath);
  } catch {}
  if (prev?.equals(result.stdout)) return false;
  writeFileSync(pngPath, result.stdout);
  return true;
}

function renderSlices(svgPath, prefix, { width, height, rowTop, rowHeight }) {
  mkdirSync(SLICE_DIR, { recursive: true });
  const slices = [
    { name: "top", top: 0, height: rowTop },
    ...Array.from({ length: TOP_COUNT }, (_, index) => ({
      name: `row-${index + 1}`,
      top: rowTop + index * rowHeight,
      height: rowHeight,
    })),
    {
      name: "bottom",
      top: rowTop + TOP_COUNT * rowHeight,
      height: height - rowTop - TOP_COUNT * rowHeight,
    },
  ];

  const changes = slices.map(({ name, top, height: sliceHeight }) =>
    renderPngSliceIfChanged(
      svgPath,
      resolve(SLICE_DIR, `${prefix}-${name}.png`),
      { width, top, height: sliceHeight },
    ),
  );
  return changes.some(Boolean);
}

const projects = (await fetchRepos()).filter((p) => p.stars > 0);
const profile = await fetchProfile();
const total = projects.reduce((a, p) => a + p.stars, 0);
const top = projects.slice(0, TOP_COUNT);

const changedA = writeIfChanged(
  resolve(ROOT, "assets/stars.svg"),
  buildDesktop({ total, projects, top }),
);
const changedB = writeIfChanged(
  resolve(ROOT, "assets/stars-mobile.svg"),
  buildMobile({ total, projects, top }),
);
const changedC = renderPngIfChanged(
  resolve(ROOT, "assets/stars.svg"),
  resolve(ROOT, "assets/stars.png"),
);
const changedD = renderPngIfChanged(
  resolve(ROOT, "assets/stars-mobile.svg"),
  resolve(ROOT, "assets/stars-mobile.png"),
);
const changedE = renderSlices(resolve(ROOT, "assets/stars.svg"), "desktop", DESKTOP);
const changedF = renderSlices(resolve(ROOT, "assets/stars-mobile.svg"), "mobile", MOBILE);
const changedG = writeIfChanged(
  resolve(ROOT, "assets/stats.svg"),
  buildStats({ total, ...profile }),
);
const changedH = updateReadmeLinks(top);

console.log(
  `total=${total} projects=${projects.length} followers=${profile.followers} changed=${[changedA, changedB, changedC, changedD, changedE, changedF, changedG, changedH].some(Boolean)}`,
);
