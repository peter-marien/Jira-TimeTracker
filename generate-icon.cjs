const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const buildDir = path.join(__dirname, 'build');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
}

async function generateIcons() {
    // Generate main ICO for Windows build
    console.log('Generating icon.ico...');
    await sharp(path.join(publicDir, 'logo.svg'))
        .resize(256, 256)
        .png()
        .toFile(path.join(buildDir, 'icon.png'));

    const convert = pngToIco.default || pngToIco;
    const icoBuffer = await convert([path.join(buildDir, 'icon.png')]);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
    console.log('Created: build/icon.ico');

    // Generate tray icons as PNGs (16x16 and 32x32 for different DPIs)
    console.log('Generating tray icons...');

    // Standard tray icon (idle)
    await sharp(path.join(publicDir, 'logo.svg'))
        .resize(32, 32)
        .png()
        .toFile(path.join(publicDir, 'tray-icon.png'));
    console.log('Created: public/tray-icon.png');

    // Active tray icon (green ring)
    await sharp(path.join(publicDir, 'logo-active.svg'))
        .resize(32, 32)
        .png()
        .toFile(path.join(publicDir, 'tray-icon-active.png'));
    console.log('Created: public/tray-icon-active.png');

    // App icon for window (larger)
    await sharp(path.join(publicDir, 'logo.svg'))
        .resize(256, 256)
        .png()
        .toFile(path.join(publicDir, 'app-icon.png'));
    console.log('Created: public/app-icon.png');

    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
