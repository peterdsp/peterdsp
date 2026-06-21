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

function buildDesktop({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const trackW = 460;
  const rows = top
    .map((p, i) => {
      const w = Math.max(6, Math.round((p.stars / max) * trackW));
      const color = i === 0 ? "#7EE787" : i === 1 ? "#79C0FF" : "#A5D6FF";
      const opacity = (0.95 - i * 0.04).toFixed(2);
      return `    <g transform="translate(0 ${i * 36})">
      <text x="0" y="14" fill="#F0F6FC" font-size="14" font-weight="600">${esc(p.name)}</text>
      <rect x="170" y="2" width="${trackW}" height="14" rx="7" fill="url(#barTrack)"/>
      <rect x="170" y="2" width="${w}" height="14" rx="7" fill="url(#bar)" opacity="${opacity}"/>
      <text x="640" y="14" fill="${color}" font-size="13" font-weight="700">${p.stars} ★</text>
    </g>`;
    })
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `    <g transform="translate(0 ${top.length * 36})">
      <text x="0" y="14" fill="#8B949E" font-size="12">+${remainingCount} more</text>
      <text x="640" y="14" fill="#8B949E" font-size="12" font-weight="600">${remainingStars} ★</text>
    </g>`
      : "";

  return `<svg width="1200" height="340" viewBox="0 0 1200 340" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Liquid-glass panel summarizing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>
    <linearGradient id="sbg" x1="0" y1="0" x2="1200" y2="340" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#05070D"/>
      <stop offset="0.5" stop-color="#081526"/>
      <stop offset="1" stop-color="#070A12"/>
    </linearGradient>
    <radialGradient id="saqua" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(220 40) rotate(72) scale(320 760)">
      <stop stop-color="#58A6FF" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#7DD3FC" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#58A6FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sglass" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1020 60) rotate(140) scale(280 460)">
      <stop stop-color="#D2E9FF" stop-opacity="0.28"/>
      <stop offset="0.55" stop-color="#58A6FF" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#58A6FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#58A6FF"/>
      <stop offset="0.55" stop-color="#79C0FF"/>
      <stop offset="1" stop-color="#7EE787"/>
    </linearGradient>
    <linearGradient id="barTrack" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#F0F6FC"/>
      <stop offset="1" stop-color="#A5D6FF"/>
    </linearGradient>
    <pattern id="sgrid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0V34" stroke="#A5D6FF" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
    <filter id="sGlow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.345 0 0 0 0 0.651 0 0 0 0 1 0 0 0 0.5 0"/>
      <feBlend in2="SourceGraphic" mode="screen"/>
    </filter>
  </defs>

  <rect width="1200" height="340" rx="34" fill="url(#sbg)"/>
  <rect width="1200" height="340" rx="34" fill="url(#saqua)"/>
  <rect width="1200" height="340" rx="34" fill="url(#sglass)"/>
  <rect width="1200" height="340" rx="34" fill="url(#sgrid)"/>
  <rect x="20" y="20" width="1160" height="300" rx="28" stroke="#FFFFFF" stroke-opacity="0.13"/>

  <g transform="translate(72 70)">
    <text x="0" y="0" fill="#8B949E" font-family="SFMono-Regular, Consolas, monospace" font-size="13" letter-spacing="3">STARS / OPEN SOURCE</text>
    <text x="0" y="118" fill="url(#totalGrad)" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="148" font-weight="800" letter-spacing="-4">${total}</text>
    <g transform="translate(2 30)" filter="url(#sGlow)" opacity="0.55">
      <path d="M0 0L228 0" stroke="#58A6FF" stroke-width="1.5"/>
    </g>
    <text x="0" y="156" fill="#A5D6FF" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="17" font-weight="600">cumulative GitHub stars</text>
    <text x="0" y="180" fill="#8B949E" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14">across ${projects.length} shipped open-source projects</text>

    <g transform="translate(0 214)">
      <circle cx="6" cy="6" r="3" fill="#7EE787"/>
      <circle cx="6" cy="6" r="8" fill="none" stroke="#7EE787" stroke-opacity="0.3">
        <animate attributeName="r" values="6;12;6" dur="2.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0.05;0.6" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      <text x="22" y="11" fill="#C9D1D9" font-family="SFMono-Regular, Consolas, monospace" font-size="12">live · github.com/${esc(USER)}</text>
    </g>
  </g>

  <g transform="translate(540 64)" font-family="SFMono-Regular, Consolas, monospace">
${rows}
${more}
  </g>
</svg>
`;
}

function buildMobile({ total, projects, top }) {
  const max = Math.max(1, top[0]?.stars || 1);
  const trackW = 380;
  const rows = top
    .map((p, i) => {
      const w = Math.max(6, Math.round((p.stars / max) * trackW));
      const color = i === 0 ? "#7EE787" : i === 1 ? "#79C0FF" : "#A5D6FF";
      const opacity = (0.95 - i * 0.05).toFixed(2);
      return `    <g transform="translate(0 ${i * 36})">
      <text x="0" y="14" fill="#F0F6FC" font-size="15" font-weight="600">${esc(p.name)}</text>
      <rect x="180" y="2" width="${trackW}" height="14" rx="7" fill="url(#barTrack)"/>
      <rect x="180" y="2" width="${w}" height="14" rx="7" fill="url(#bar)" opacity="${opacity}"/>
      <text x="572" y="14" fill="${color}" font-size="14" font-weight="700">${p.stars} ★</text>
    </g>`;
    })
    .join("\n");

  const remainingCount = projects.length - top.length;
  const remainingStars = projects.slice(top.length).reduce((a, p) => a + p.stars, 0);
  const more =
    remainingCount > 0
      ? `    <g transform="translate(0 ${top.length * 36})">
      <text x="0" y="14" fill="#8B949E" font-size="13">+${remainingCount} more</text>
      <text x="572" y="14" fill="#8B949E" font-size="13" font-weight="600">${remainingStars} ★</text>
    </g>`
      : "";

  return `<svg width="720" height="560" viewBox="0 0 720 560" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Total GitHub stars across ${esc(USER)}'s open-source projects</title>
  <desc id="desc">Mobile liquid-glass panel showing ${total} cumulative GitHub stars across ${projects.length} projects.</desc>
  <defs>
    <linearGradient id="sbg" x1="0" y1="0" x2="720" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#05070D"/>
      <stop offset="0.5" stop-color="#081526"/>
      <stop offset="1" stop-color="#070A12"/>
    </linearGradient>
    <radialGradient id="saqua" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 30) rotate(72) scale(280 580)">
      <stop stop-color="#58A6FF" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#7DD3FC" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#58A6FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#58A6FF"/>
      <stop offset="0.55" stop-color="#79C0FF"/>
      <stop offset="1" stop-color="#7EE787"/>
    </linearGradient>
    <linearGradient id="barTrack" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#F0F6FC"/>
      <stop offset="1" stop-color="#A5D6FF"/>
    </linearGradient>
    <pattern id="sgrid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M30 0H0V30" stroke="#A5D6FF" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="720" height="560" rx="34" fill="url(#sbg)"/>
  <rect width="720" height="560" rx="34" fill="url(#saqua)"/>
  <rect width="720" height="560" rx="34" fill="url(#sgrid)"/>
  <rect x="18" y="18" width="684" height="524" rx="28" stroke="#FFFFFF" stroke-opacity="0.13"/>

  <g transform="translate(56 80)">
    <text x="0" y="0" fill="#8B949E" font-family="SFMono-Regular, Consolas, monospace" font-size="15" letter-spacing="3">STARS / OPEN SOURCE</text>
    <text x="0" y="136" fill="url(#totalGrad)" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="168" font-weight="800" letter-spacing="-4">${total}</text>
    <text x="0" y="178" fill="#A5D6FF" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="20" font-weight="600">cumulative GitHub stars</text>
    <text x="0" y="206" fill="#8B949E" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="16">across ${projects.length} shipped open-source projects</text>
  </g>

  <g transform="translate(56 314)" font-family="SFMono-Regular, Consolas, monospace">
${rows}
${more}
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
const topMobile = projects.slice(0, 4);

const changedA = writeIfChanged(
  resolve(ROOT, "assets/stars.svg"),
  buildDesktop({ total, projects, top }),
);
const changedB = writeIfChanged(
  resolve(ROOT, "assets/stars-mobile.svg"),
  buildMobile({ total, projects, top: topMobile }),
);

console.log(`total=${total} projects=${projects.length} changed=${changedA || changedB}`);
