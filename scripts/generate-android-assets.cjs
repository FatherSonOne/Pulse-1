/**
 * Generate Android app icons and splash screens from Pulse SVG
 * Run: node scripts/generate-android-assets.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Pulse logo SVG - the heartbeat line on dark navy background
const pulseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="coral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f43f5e"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0f172a"/>
  <path d="M64 256 L144 256 L192 128 L256 384 L320 192 L384 320 L448 256" stroke="url(#coral-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

// Foreground SVG (just the heartbeat, transparent background) for adaptive icons
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="coral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f43f5e"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <path d="M64 256 L144 256 L192 128 L256 384 L320 192 L384 320 L448 256" stroke="url(#coral-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

// Background color for adaptive icons
const backgroundColor = '#0f172a';

// Splash screen SVG (centered logo on black background)
const splashSvg = (width, height) => {
  const logoSize = Math.min(width, height) * 0.3; // Logo takes 30% of smallest dimension
  const x = (width - logoSize) / 2;
  const y = (height - logoSize) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">
    <rect width="${width}" height="${height}" fill="#09090b"/>
    <svg x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="coral-grad-splash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f43f5e"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#0f172a"/>
      <path d="M64 256 L144 256 L192 128 L256 384 L320 192 L384 320 L448 256" stroke="url(#coral-grad-splash)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  </svg>`;
};

// Android icon sizes (in dp, scaled by density)
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Foreground sizes for adaptive icons (larger to account for safe zone)
const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
};

// Splash screen sizes
const splashSizes = {
  'drawable': { width: 480, height: 800 },
  'drawable-port-mdpi': { width: 320, height: 480 },
  'drawable-port-hdpi': { width: 480, height: 800 },
  'drawable-port-xhdpi': { width: 720, height: 1280 },
  'drawable-port-xxhdpi': { width: 960, height: 1600 },
  'drawable-port-xxxhdpi': { width: 1280, height: 1920 },
  'drawable-land-mdpi': { width: 480, height: 320 },
  'drawable-land-hdpi': { width: 800, height: 480 },
  'drawable-land-xhdpi': { width: 1280, height: 720 },
  'drawable-land-xxhdpi': { width: 1600, height: 960 },
  'drawable-land-xxxhdpi': { width: 1920, height: 1280 }
};

const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  console.log('Generating Android app icons...\n');

  for (const [folder, size] of Object.entries(iconSizes)) {
    const outputPath = path.join(androidResPath, folder);

    // Ensure directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Generate main icon (with rounded rect background)
    await sharp(Buffer.from(pulseSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(outputPath, 'ic_launcher.png'));

    // Generate round icon
    await sharp(Buffer.from(pulseSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(outputPath, 'ic_launcher_round.png'));

    console.log(`  Created ${folder}/ic_launcher.png (${size}x${size})`);
  }

  // Generate adaptive icon foreground
  console.log('\nGenerating adaptive icon foreground...\n');

  for (const [folder, size] of Object.entries(foregroundSizes)) {
    const outputPath = path.join(androidResPath, folder);

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Foreground with the heartbeat line only (centered with padding for safe zone)
    await sharp(Buffer.from(foregroundSvg))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputPath, 'ic_launcher_foreground.png'));

    // Background solid color
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 255 } // #0f172a
      }
    })
      .png()
      .toFile(path.join(outputPath, 'ic_launcher_adaptive_back.png'));

    // Adaptive foreground (same as regular foreground)
    await sharp(Buffer.from(foregroundSvg))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputPath, 'ic_launcher_adaptive_fore.png'));

    console.log(`  Created ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }
}

async function generateSplashScreens() {
  console.log('\nGenerating splash screens...\n');

  for (const [folder, dimensions] of Object.entries(splashSizes)) {
    const outputPath = path.join(androidResPath, folder);

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const svg = splashSvg(dimensions.width, dimensions.height);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(outputPath, 'splash.png'));

    console.log(`  Created ${folder}/splash.png (${dimensions.width}x${dimensions.height})`);
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Pulse Android Asset Generator');
  console.log('='.repeat(50));
  console.log(`\nOutput directory: ${androidResPath}\n`);

  try {
    await generateIcons();
    await generateSplashScreens();

    console.log('\n' + '='.repeat(50));
    console.log('Asset generation complete!');
    console.log('='.repeat(50));
    console.log('\nNext steps:');
    console.log('1. Run: cd android && ./gradlew clean');
    console.log('2. Rebuild the app: npx cap sync android');
    console.log('3. Build new AAB: cd android && ./gradlew bundleRelease');
    console.log('');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
