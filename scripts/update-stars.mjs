#!/usr/bin/env node
import { writeFileSync, readFileSync } from "node:fs";
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
    .map((r) => ({ name: r.name, stars: r.stargazers_count }))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]),
  );

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function slabDefs(w, h) {
  return `
    <linearGradient id="dome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.04"/>
      <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="bodyTint" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.01"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="specular" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="0.65" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="dispR" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(${w * 0.32} ${h * 0.85})">
      <stop stop-color="#FF7AA2" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FF7AA2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="dispC" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${w} ${h}) scale(${w * 0.32} ${h * 0.85})">
      <stop stop-color="#7DD3FC" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#7DD3FC" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#B8B8BD"/>
    </linearGradient>
    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.62"/>
    </linearGradient>
    <linearGradient id="barTrack" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="drop" x="-10%" y="-20%" width="120%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
      <feOffset dy="12"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feComposite in="SourceGraphic" operator="over"/>
    </filter>
  `;
}

function slabBody({ x, y, w, h, r = 36, specularInsetX = 64, specularInsetX2 }) {
  const sx2 = specularInsetX2 ?? specularInsetX;
  return `
  <g filter="url(#drop)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#0A0A0B"/>
  </g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#bodyTint)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#dispR)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#dispC)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#dome)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#floor)"/>
  <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" stroke="url(#rim)"/>
  <path d="M${x + specularInsetX} ${y + 1}H${x + w - sx2}" stroke="url(#specular)" stroke-width="1"/>`;
}

function bar({ x, y, trackW, value, max, name, nameMaxChars, valueColor = "#FFFFFF" }) {
  const w = Math.max(8, Math.round((value / max) * trackW));
  const h = 14;
  return `      <text x="${x}" y="${y + 11}" fill="#E5E5EA" font-size="13" font-weight="500">${esc(truncate(name, nameMaxChars))}</text>
      <rect x="${x + 240}" y="${y + 2}" width="${trackW}" height="${h}" rx="${h / 2}" fill="url(#barTrack)"/>
      <rect x="${x + 240 + 0.5}" y="${y + 2.5}" width="${trackW - 1}" height="${h - 1}" rx="${(h - 1) / 2}" stroke="#FFFFFF" stroke-opacity="0.08" fill="none"/>
      <rect x="${x + 240}" y="${y + 2}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#barFill)"/>
      <path d="M${x + 240 + 4} ${y + 3.5}H${x + 240 + w - 4}" stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="0.75"/>
      <text x="${x + 240 + trackW + 24}" y="${y + 11}" fill="${valueColor}" font-size="13" font-weight="700" text-anchor="end">${value}</text>`;
}

function buildDesktop({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const w = 1200, h = 320;
  const trackW = 360;
  const rowH = 30;
  const valueRightX = 240 + trackW + 24;

  const rows = top
    .map((p, i) =>
      bar({
        x: 0,
        y: i * rowH,
        trackW,
        value: p.stars,
        max,
        name: p.name,
        nameMaxChars: 26,
      }),
    )
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `      <text x="0" y="${top.length * rowH + 11}" fill="#6E6E73" font-size="12">+ ${remainingCount} more</text>
      <text x="${valueRightX}" y="${top.length * rowH + 11}" fill="#8E8E93" font-size="12" font-weight="600" text-anchor="end">${remainingStars}</text>`
      : "";

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">OLED-black liquid-glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

  <rect width="${w}" height="${h}" fill="#000000"/>
${slabBody({ x: 24, y: 20, w: w - 48, h: h - 40, r: 36, specularInsetX: 64 })}

  <g transform="translate(76 76)">
    <text x="0" y="0" fill="#8A8A8F" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="11" letter-spacing="4">STARS · OPEN SOURCE</text>
    <text x="0" y="140" fill="url(#ink)" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="172" font-weight="700" letter-spacing="-6">${total}</text>
    <text x="0" y="172" fill="#C7C7CC" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="15" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="194" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="13">across ${projects.length} open-source projects</text>

    <g transform="translate(0 218)">
      <circle cx="4" cy="6" r="3" fill="#FFFFFF"/>
      <circle cx="4" cy="6" r="6" fill="none" stroke="#FFFFFF" stroke-opacity="0.4">
        <animate attributeName="r" values="4;10;4" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/>
      </circle>
      <text x="22" y="11" fill="#8A8A8F" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="11" letter-spacing="1.5">LIVE · GITHUB.COM/${esc(USER.toUpperCase())}</text>
    </g>
  </g>

  <g transform="translate(488 80)" font-family="SFMono-Regular, ui-monospace, Consolas, monospace">
    <text x="0" y="0" fill="#8A8A8F" font-size="11" letter-spacing="4">TOP PROJECTS</text>
    <line x1="0" y1="14" x2="${240 + trackW + 24}" y2="14" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g transform="translate(0 32)">
${rows}
${more}
    </g>
  </g>
</svg>
`;
}

function buildMobile({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const w = 720, h = 620;
  const trackW = 260;
  const rowH = 38;
  const valueRightX = 240 + trackW + 24;

  const rows = top
    .map((p, i) =>
      bar({
        x: 0,
        y: i * rowH,
        trackW,
        value: p.stars,
        max,
        name: p.name,
        nameMaxChars: 22,
      }),
    )
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `      <text x="0" y="${top.length * rowH + 11}" fill="#6E6E73" font-size="13">+ ${remainingCount} more</text>
      <text x="${valueRightX}" y="${top.length * rowH + 11}" fill="#8E8E93" font-size="13" font-weight="600" text-anchor="end">${remainingStars}</text>`
      : "";

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Mobile OLED-black liquid-glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

  <rect width="${w}" height="${h}" fill="#000000"/>
${slabBody({ x: 20, y: 20, w: w - 40, h: h - 40, r: 36, specularInsetX: 60 })}

  <g transform="translate(56 90)">
    <text x="0" y="0" fill="#8A8A8F" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="13" letter-spacing="4">STARS · OPEN SOURCE</text>
    <text x="0" y="150" fill="url(#ink)" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="184" font-weight="700" letter-spacing="-6">${total}</text>
    <text x="0" y="188" fill="#C7C7CC" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="20" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="216" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="15">across ${projects.length} open-source projects</text>
  </g>

  <g transform="translate(56 360)" font-family="SFMono-Regular, ui-monospace, Consolas, monospace">
    <text x="0" y="0" fill="#8A8A8F" font-size="12" letter-spacing="4">TOP PROJECTS</text>
    <line x1="0" y1="14" x2="${240 + trackW + 24}" y2="14" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g transform="translate(0 30)">
${rows}
${more}
    </g>
  </g>
</svg>
`;
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

const projects = (await fetchRepos()).filter((p) => p.stars > 0);
const total = projects.reduce((a, p) => a + p.stars, 0);
const top = projects.slice(0, 6);
const topMobile = projects.slice(0, 5);

const changedA = writeIfChanged(
  resolve(ROOT, "assets/stars.svg"),
  buildDesktop({ total, projects, top }),
);
const changedB = writeIfChanged(
  resolve(ROOT, "assets/stars-mobile.svg"),
  buildMobile({ total, projects, top: topMobile }),
);

console.log(`total=${total} projects=${projects.length} changed=${changedA || changedB}`);
