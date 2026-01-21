/**
 * Generate PNG icons from SVG for Chrome Extension
 * Requires: sharp package (already installed)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 48, 128];
const svgPath = path.join(__dirname, 'icons', 'icon.svg');
const iconsDir = path.join(__dirname, 'icons');

async function generateIcons() {
  console.log('Generating PNG icons from SVG...');

  // Read SVG file
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate each size
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}.png`);

    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${size}x${size} icon: icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
    }
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
