import sharp from "sharp";
import fs from "fs";

const PUBLIC = "./public";

async function generate() {
  // OG IMAGE (1200x630)
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      {
        input: await sharp(`${PUBLIC}/logo.svg`)
          .resize({ width: 500 }) // Logo width ≈ 40–50% del canvas
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toFile(`${PUBLIC}/og.png`);

  // FAVICON PNG
  await sharp(`${PUBLIC}/logo-icon.svg`)
    .resize(32, 32)
    .png()
    .toFile(`${PUBLIC}/favicon.png`);

  // APPLE TOUCH
  await sharp(`${PUBLIC}/logo-icon.svg`)
    .resize(180, 180)
    .png()
    .toFile(`${PUBLIC}/apple-touch-icon.png`);

  console.log("✔ Brand assets generated");
}

generate().catch((err) => {
  console.error("Error generating brand assets:", err);
  process.exit(1);
});
