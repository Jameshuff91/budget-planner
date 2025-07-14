import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const publicDir = path.join(__dirname, '../public');

  const sizes = [
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
  ];

  try {
    const svgBuffer = fs.readFileSync(svgPath);

    for (const { size, name } of sizes) {
      await sharp(svgBuffer).resize(size, size).png().toFile(path.join(publicDir, name));

      console.log(`Generated ${name}`);
    }

    // Also create a favicon.ico from the 32x32 PNG
    const favicon32 = path.join(publicDir, 'favicon-32x32.png');
    const faviconIco = path.join(publicDir, 'favicon.ico');

    await sharp(favicon32).resize(32, 32).toFile(faviconIco.replace('.ico', '.png'));

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);

    // Fallback: create simple colored squares as icons
    console.log('Creating fallback icons...');

    for (const { size, name } of sizes) {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="${size}" height="${size}" fill="#3B82F6"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
                fill="white" font-size="${size * 0.3}px" font-family="Arial">
            BP
          </text>
        </svg>
      `;

      try {
        await sharp(Buffer.from(svg)).png().toFile(path.join(publicDir, name));
        console.log(`Generated fallback ${name}`);
      } catch (err) {
        console.error(`Failed to generate ${name}:`, err);
      }
    }
  }
}

generateIcons().catch(console.error);
