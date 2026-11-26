import { mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "apps/mobile/assets/images";
mkdirSync(OUT, { recursive: true });

const CREAM = "#F2EAE0";
const EMBER = "#E2603A";
const INK = "#0B0A09";
const SERIF = "Georgia, 'Times New Roman', serif";

const splash = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text x="512" y="540" text-anchor="middle" font-family="${SERIF}" font-size="210"
    letter-spacing="26" fill="${CREAM}">ASHES</text>
  <circle cx="512" cy="645" r="16" fill="${EMBER}"/>
</svg>`;

const icon = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${INK}"/>
  <circle cx="512" cy="512" r="372" fill="none" stroke="${CREAM}" stroke-opacity="0.12" stroke-width="2"/>
  <text x="512" y="660" text-anchor="middle" font-family="${SERIF}" font-size="560"
    fill="${CREAM}">A</text>
  <circle cx="512" cy="762" r="16" fill="${EMBER}"/>
</svg>`;

const foreground = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text x="512" y="620" text-anchor="middle" font-family="${SERIF}" font-size="460"
    fill="${CREAM}">A</text>
  <circle cx="512" cy="742" r="14" fill="${EMBER}"/>
</svg>`;

const monochrome = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text x="512" y="620" text-anchor="middle" font-family="${SERIF}" font-size="460"
    fill="#FFFFFF">A</text>
  <circle cx="512" cy="742" r="14" fill="#FFFFFF"/>
</svg>`;

await Promise.all([
  sharp(Buffer.from(splash)).png().toFile(`${OUT}/ashes-splash.png`),
  sharp(Buffer.from(icon)).png().toFile(`${OUT}/ashes-icon.png`),
  sharp(Buffer.from(foreground)).png().toFile(`${OUT}/ashes-foreground.png`),
  sharp(Buffer.from(monochrome)).png().toFile(`${OUT}/ashes-monochrome.png`),
  sharp(Buffer.from(icon)).resize(64, 64).png().toFile(`${OUT}/ashes-favicon.png`),
]);

console.log("brand assets written");
