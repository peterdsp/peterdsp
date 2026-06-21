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

const DEFS = `
    <radialGradient id="halo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 -60) rotate(72) scale(420 920)">
      <stop stop-color="#FFFFFF" stop-opacity="0.10"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.025"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1100 40) rotate(140) scale(320 520)">
      <stop stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.015"/>
    </linearGradient>
    <linearGradient id="hairline" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="barTrack" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#8E8E93"/>
    </linearGradient>
`;

function buildDesktop({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const nameX = 0;
  const barX = 240;
  const barW = 380;
  const valueX = barX + barW + 24;
  const rowH = 36;

  const rows = top
    .map((p, i) => {
      const w = Math.max(4, Math.round((p.stars / max) * barW));
      const opacity = (0.95 - i * 0.07).toFixed(2);
      return `    <g transform="translate(0 ${i * rowH})">
      <text x="${nameX}" y="14" fill="#E5E5EA" font-size="13" font-weight="500">${esc(truncate(p.name, 26))}</text>
      <rect x="${barX}" y="3" width="${barW}" height="10" rx="5" fill="url(#barTrack)"/>
      <rect x="${barX}" y="3" width="${w}" height="10" rx="5" fill="url(#bar)" opacity="${opacity}"/>
      <text x="${valueX}" y="14" fill="#FFFFFF" font-size="13" font-weight="700">${p.stars}</text>
    </g>`;
    })
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `    <g transform="translate(0 ${top.length * rowH})">
      <text x="${nameX}" y="14" fill="#6E6E73" font-size="12">+ ${remainingCount} more</text>
      <text x="${valueX}" y="14" fill="#8E8E93" font-size="12" font-weight="600">${remainingStars}</text>
    </g>`
      : "";

  return `<svg width="1200" height="340" viewBox="0 0 1200 340" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">OLED-black minimal liquid-glass panel showing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${DEFS}</defs>

  <rect width="1200" height="340" rx="32" fill="#000000"/>
  <rect width="1200" height="340" rx="32" fill="url(#halo)"/>
  <rect width="1200" height="340" rx="32" fill="url(#halo2)"/>
  <rect x="0.5" y="0.5" width="1199" height="339" rx="31.5" stroke="url(#hairline)"/>

  <g transform="translate(72 72)">
    <text x="0" y="0" fill="#8E8E93" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="12" letter-spacing="3.5">STARS · OPEN SOURCE</text>
    <text x="0" y="138" fill="url(#totalGrad)" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="168" font-weight="700" letter-spacing="-5">${total}</text>
    <text x="0" y="172" fill="#E5E5EA" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="16" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="194" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="13">across ${projects.length} open-source projects</text>

    <g transform="translate(0 226)">
      <circle cx="4" cy="6" r="3" fill="#FFFFFF"/>
      <circle cx="4" cy="6" r="6" fill="none" stroke="#FFFFFF" stroke-opacity="0.35">
        <animate attributeName="r" values="4;10;4" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite"/>
      </circle>
      <text x="20" y="11" fill="#8E8E93" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="11" letter-spacing="1.5">LIVE · GITHUB.COM/${esc(USER.toUpperCase())}</text>
    </g>
  </g>

  <g transform="translate(488 76)" font-family="SFMono-Regular, ui-monospace, Consolas, monospace">
    <text x="0" y="-10" fill="#8E8E93" font-size="11" letter-spacing="2.5">TOP PROJECTS</text>
    <line x1="0" y1="-2" x2="644" y2="-2" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g transform="translate(0 20)">
${rows}
${more}
    </g>
  </g>
</svg>
`;
}

function buildMobile({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const nameX = 0;
  const barX = 240;
  const barW = 296;
  const valueX = barX + barW + 24;
  const rowH = 38;

  const rows = top
    .map((p, i) => {
      const w = Math.max(4, Math.round((p.stars / max) * barW));
      const opacity = (0.95 - i * 0.08).toFixed(2);
      return `    <g transform="translate(0 ${i * rowH})">
      <text x="${nameX}" y="14" fill="#E5E5EA" font-size="14" font-weight="500">${esc(truncate(p.name, 22))}</text>
      <rect x="${barX}" y="3" width="${barW}" height="10" rx="5" fill="url(#barTrack)"/>
      <rect x="${barX}" y="3" width="${w}" height="10" rx="5" fill="url(#bar)" opacity="${opacity}"/>
      <text x="${valueX}" y="14" fill="#FFFFFF" font-size="14" font-weight="700">${p.stars}</text>
    </g>`;
    })
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `    <g transform="translate(0 ${top.length * rowH})">
      <text x="${nameX}" y="14" fill="#6E6E73" font-size="13">+ ${remainingCount} more</text>
      <text x="${valueX}" y="14" fill="#8E8E93" font-size="13" font-weight="600">${remainingStars}</text>
    </g>`
      : "";

  return `<svg width="720" height="600" viewBox="0 0 720 600" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Mobile OLED-black minimal panel showing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${DEFS}</defs>

  <rect width="720" height="600" rx="32" fill="#000000"/>
  <rect width="720" height="600" rx="32" fill="url(#halo)"/>
  <rect x="0.5" y="0.5" width="719" height="599" rx="31.5" stroke="url(#hairline)"/>

  <g transform="translate(56 88)">
    <text x="0" y="0" fill="#8E8E93" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="13" letter-spacing="3.5">STARS · OPEN SOURCE</text>
    <text x="0" y="148" fill="url(#totalGrad)" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="180" font-weight="700" letter-spacing="-5">${total}</text>
    <text x="0" y="186" fill="#E5E5EA" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="20" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="212" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="15">across ${projects.length} open-source projects</text>
  </g>

  <g transform="translate(56 360)" font-family="SFMono-Regular, ui-monospace, Consolas, monospace">
    <text x="0" y="-10" fill="#8E8E93" font-size="12" letter-spacing="2.5">TOP PROJECTS</text>
    <line x1="0" y1="-2" x2="608" y2="-2" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g transform="translate(0 22)">
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
