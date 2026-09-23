const fs = require('fs');
const Tesseract = require('tesseract.js');
// Mocking a large base64 string
const buf = Buffer.alloc(3840 * 2160 * 4); // ~33MB uncompressed
console.log("Memory test...");
