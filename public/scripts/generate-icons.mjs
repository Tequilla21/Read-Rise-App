import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "logo-source.png"; // put a square image in project root
await mkdir("public/icons", { recursive: true });

// 192x192
await sharp(SRC)
  .resize(192, 192, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile("public/icons/icon-192.png");

// 512x512
await sharp(SRC)
  .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile("public/icons/icon-512.png");

// 512x512 maskable (adds generous padding to keep content safe)
await sharp(SRC)
  .extend({ // add transparent padding if needed
    top: 64, bottom: 64, left: 64, right: 64,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .resize(512, 512, { fit: "cover" })
  .png()
  .toFile("public/icons/maskable-512.png");

console.log("✅ Icons generated in public/icons/");
