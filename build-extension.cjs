#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('Building Aura Chrome Extension...\n');

// Copy manifest.json
fs.copyFileSync(
  path.join(__dirname, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);
console.log('✓ Copied manifest.json');

// Copy content.js
fs.copyFileSync(
  path.join(__dirname, 'content.js'),
  path.join(distDir, 'content.js')
);
console.log('✓ Copied content.js');

// Copy content.css
fs.copyFileSync(
  path.join(__dirname, 'content.css'),
  path.join(distDir, 'content.css')
);
console.log('✓ Copied content.css');

// Create icons directory
const iconsDir = path.join(distDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create PNG icons
const createPngIcon = (size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Purple gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Simple "A" letter
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.6}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
};

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), createPngIcon(16));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), createPngIcon(48));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), createPngIcon(128));
console.log('✓ Created icon files (16px, 48px, 128px)');

// Check if Vite built the popup HTML
const popupHtml = path.join(distDir, 'index.html');
if (fs.existsSync(popupHtml)) {
  console.log('✓ Popup HTML found (built by Vite)');
} else {
  console.log('⚠ Warning: index.html not found in dist/');
  console.log('  Make sure to run "npm run build" first');
}

console.log('\n✅ Extension build complete!\n');
console.log('To install:');
console.log('  1. Open Chrome and go to chrome://extensions/');
console.log('  2. Enable "Developer Mode" (toggle in top-right)');
console.log('  3. Click "Load unpacked"');
console.log('  4. Select the dist folder\n');
console.log('The extension will be ready to use on:');
console.log('  • WhatsApp Web');
console.log('  • Instagram DMs');
console.log('  • Tinder, Bumble, Hinge, and other dating apps\n');