const fs = require('fs');
const path = require('path');

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy the worker file
const workerSrc = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs',
);
const workerDest = path.join(publicDir, 'pdf.worker.min.js');

fs.copyFileSync(workerSrc, workerDest);
console.log('PDF worker file copied successfully!');
