// Renders the master SVGs in design/icon/ into every icon the apps need.
// Usage: node tools/generate-icons.mjs   (uses Playwright's Chromium)
//
// Android: launcher (legacy, round, adaptive foreground, monochrome), splash screens
// Web:     favicon, apple-touch-icon, PWA icons (any + maskable)
// Stores:  Play Store 512, iOS App Store 1024 (design/icon/out/)

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "design", "icon");
const res = join(root, "apps", "client", "android", "app", "src", "main", "res");
const pub = join(root, "apps", "client", "public");
const out = join(src, "out");
const TEAL = "#2C6A63";

const svg = (name) => `data:image/svg+xml;base64,${readFileSync(join(src, name)).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Renders `file` at w×h. shape: "square" | "rounded" | "circle"; background fills the canvas behind a centred image of size `inner`. */
async function render(file, target, { w, h = w, shape = "square", background = null, inner = null }) {
  const size = inner ?? w;
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? "18%" : "0";
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:${background ?? "transparent"}">
      <img src="${svg(file)}" style="width:${size}px;height:${size}px;display:block;border-radius:${radius}">
    </div></body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(dirname(target), { recursive: true });
  await page.screenshot({ path: target, omitBackground: !background, clip: { x: 0, y: 0, width: w, height: h } });
}

// ---- Android launcher icons
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, f] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${d}`);
  await render("icon-full.svg", join(dir, "ic_launcher.png"), { w: 48 * f, shape: "rounded" });
  await render("icon-maskable.svg", join(dir, "ic_launcher_round.png"), { w: 48 * f, shape: "circle" });
  await render("icon-foreground.svg", join(dir, "ic_launcher_foreground.png"), { w: 108 * f });
  await render("icon-monochrome.svg", join(dir, "ic_launcher_monochrome.png"), { w: 108 * f });
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
writeFileSync(join(res, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptive);
writeFileSync(join(res, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptive);
writeFileSync(join(res, "values", "ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${TEAL}</color>
</resources>
`);

// ---- Android splash screens: same size as Capacitor's placeholders, teal with the heart
for (const dir of readdirSync(res).filter((d) => d.startsWith("drawable"))) {
  const file = join(res, dir, "splash.png");
  let dims;
  try {
    dims = execFileSync("identify", ["-format", "%w %h", file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(" ").map(Number);
  } catch {
    continue;
  }
  const [w, h] = dims;
  await render("icon-foreground.svg", file, { w, h, background: TEAL, inner: Math.round(Math.min(w, h) * 0.55) });
}

// ---- Web / PWA
copyFileSync(join(src, "favicon.svg"), join(pub, "favicon.svg"));
await render("icon-full.svg", join(pub, "apple-touch-icon.png"), { w: 180 });
await render("icon-full.svg", join(pub, "icon-192.png"), { w: 192 });
await render("icon-full.svg", join(pub, "icon-512.png"), { w: 512 });
await render("icon-maskable.svg", join(pub, "icon-maskable-512.png"), { w: 512 });

// ---- Store artwork
await render("icon-full.svg", join(out, "play-store-512.png"), { w: 512 });
await render("icon-full.svg", join(out, "ios-appicon-1024.png"), { w: 1024, background: TEAL });

await browser.close();
console.log("icons generated");
