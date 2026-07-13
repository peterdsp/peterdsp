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

const PALETTE = ["#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#a78bfa", "#22d3ee"];

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
    <filter id="drop" x="-10%" y="-20%" width="120%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
      <feOffset dy="12"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      <feComposite in="SourceGraphic" operator="over"/>
    </filter>
  `;
}

function slabBody({ x, y, w, h, r = 36 }) {
  return `
  <clipPath id="cardClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
  <g filter="url(#drop)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#base)"/>
  </g>
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

function bar({ x, y, trackW, value, max, name, nameMaxChars, color = "#a78bfa" }) {
  const w = Math.max(8, Math.round((value / max) * trackW));
  const h = 14;
  return `      <text x="${x}" y="${y + 11}" fill="#E5E5EA" font-size="13" font-weight="500">${esc(truncate(name, nameMaxChars))}</text>
      <rect x="${x + 240}" y="${y + 2}" width="${trackW}" height="${h}" rx="${h / 2}" fill="url(#barTrack)"/>
      <rect x="${x + 240}" y="${y + 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}"/>
      <path d="M${x + 240 + 4} ${y + 3.5}H${x + 240 + w - 4}" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="0.75"/>
      <text x="${x + 240 + trackW + 24}" y="${y + 11}" fill="${color}" font-size="13" font-weight="700" text-anchor="end">${value}</text>`;
}

function buildDesktop({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const w = 1200, h = 320;
  const trackW = 360;
  const rowH = 26;

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
        color: PALETTE[i % PALETTE.length],
      }),
    )
    .join("\n");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

  <rect width="${w}" height="${h}" fill="#000000"/>
${slabBody({ x: 24, y: 20, w: w - 48, h: h - 40, r: 36 })}

  <g transform="translate(76 70)">
    <text x="0" y="0" fill="#8A8A8F" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="11" letter-spacing="4">STARS · OPEN SOURCE</text>
    <text x="0" y="132" fill="url(#ink)" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="156" font-weight="700" letter-spacing="-5">${total}</text>
    <text x="0" y="164" fill="#C7C7CC" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="15" font-weight="500">cumulative GitHub stars</text>
    <text x="0" y="186" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="13">across ${projects.length} open-source projects</text>

    <g transform="translate(0 210)">
      <circle cx="4" cy="6" r="3" fill="#34d399"/>
      <circle cx="4" cy="6" r="6" fill="none" stroke="#34d399" stroke-opacity="0.5">
        <animate attributeName="r" values="4;10;4" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/>
      </circle>
      <text x="22" y="11" fill="#8A8A8F" font-family="SFMono-Regular, ui-monospace, Consolas, monospace" font-size="11" letter-spacing="1.5">LIVE · GITHUB.COM/${esc(USER.toUpperCase())}</text>
    </g>
  </g>

  <g transform="translate(488 74)" font-family="SFMono-Regular, ui-monospace, Consolas, monospace">
    <text x="0" y="0" fill="#8A8A8F" font-size="11" letter-spacing="4">TOP PROJECTS</text>
    <line x1="0" y1="14" x2="${240 + trackW + 24}" y2="14" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g transform="translate(0 32)">
${rows}
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
        color: PALETTE[i % PALETTE.length],
      }),
    )
    .join("\n");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Mobile glass slab summarizing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>${slabDefs(w, h)}</defs>

  <rect width="${w}" height="${h}" fill="#000000"/>
${slabBody({ x: 20, y: 20, w: w - 40, h: h - 40, r: 36 })}

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
