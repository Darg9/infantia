import sharp from 'sharp';

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Provide at least one image path');
  process.exit(1);
}

const run = async () => {
  let hasErrors = false;

  for (const file of files) {
    console.log(`\nValidating ${file}...`);
    try {
      if (file.toLowerCase().endsWith('.svg')) {
        const fs = await import('fs');
        const svg = fs.readFileSync(file, 'utf-8');
        
        if (!svg.includes('<svg')) {
          throw new Error(`❌ Invalid SVG format in ${file}`);
        }
        
        if (svg.includes('background') || svg.includes('rect fill')) {
          console.warn(`⚠️ Possible background detected in SVG ${file}`);
        }
        
        console.log(`✅ SVG Logo is valid: ${file}`);
        continue;
      }

      const img = sharp(file);
      const meta = await img.metadata();

      if (!meta.hasAlpha) {
        throw new Error(`❌ Image has NO transparency (alpha channel missing)`);
      }

      const { data, info } = await img
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let transparentPixels = 0;
      let semiTransparentPixels = 0;

      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];

        if (alpha === 0) transparentPixels++;
        if (alpha > 0 && alpha < 255) semiTransparentPixels++;
      }

      const totalPixels = info.width * info.height;

      if (transparentPixels < totalPixels * 0.05) {
        throw new Error(`❌ Not enough transparent pixels (probably fake background)`);
      }

      if (semiTransparentPixels > totalPixels * 0.1) {
        throw new Error(`❌ Too many semi-transparent pixels (possible halo or shadow)`);
      }

      console.log(`✅ Logo is valid. Dimensions: ${info.width}x${info.height}`);
    } catch (err) {
      console.error(err.message);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
};

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
