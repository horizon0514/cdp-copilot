import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "assets");
const mock = path.join(__dirname, "screenshot-mock.html");

const shots = [
  // English
  { scene: "automate", size: 1280, lang: "en", file: "screenshot-1280x800.png" },
  { scene: "inspect", size: 1280, lang: "en", file: "screenshot-inspect-1280x800.png" },
  { scene: "private", size: 1280, lang: "en", file: "screenshot-private-1280x800.png" },
  { scene: "automate", size: 640, lang: "en", file: "screenshot-640x400.png" },
  // Chinese (zh-CN locale on Chrome Web Store)
  { scene: "automate", size: 1280, lang: "zh", file: "screenshot-zh-1280x800.png" },
  { scene: "inspect", size: 1280, lang: "zh", file: "screenshot-zh-inspect-1280x800.png" },
  { scene: "private", size: 1280, lang: "zh", file: "screenshot-zh-private-1280x800.png" },
  { scene: "automate", size: 640, lang: "zh", file: "screenshot-zh-640x400.png" },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const shot of shots) {
  const w = shot.size;
  const h = shot.size === 1280 ? 800 : 400;
  await page.setViewportSize({ width: w, height: h });
  const url = `file://${mock}?scene=${shot.scene}&size=${shot.size}&lang=${shot.lang}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const out = path.join(outDir, shot.file);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
  console.log("wrote", out);
}

await browser.close();
